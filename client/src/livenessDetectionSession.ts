'use strict';

import { Observable, from, of, throwError } from "rxjs"
import { FaceRecognition } from "./faceRecognition"
import { LivenessDetectionSessionResult } from "./faceDetection"
import { LivenessDetectionSessionEventType, LivenessDetectionSessionUI, VerIDLivenessDetectionSessionUI } from "./faceDetectionUI"
import { Face, FaceCapture, Rect, Angle, FaceExtents, Bearing, FaceAlignmentStatus, FaceRequirements, RecognizableFaceDetectionInput, RecognizableFaceDetectionOutput, Size, FaceRequirementListener, FaceCaptureCallback, RecognizableFace } from "./types"
import { AngleBearingEvaluation, AngleSmoothing, CircularBuffer, RectSmoothing } from "./utils"
import { FaceDetector } from "./faceDetector"
import { LivenessCheck } from "./livenessCheck"

/**
 * @category Face detection
 */
export class LivenessDetectionSession {
    public readonly ui: LivenessDetectionSessionUI
    public readonly startTime: number = new Date().getTime()
    public readonly settings: LivenessDetectionSessionSettings
    /**
     * @internal
     */
    readonly controlFaceCaptures: FaceCapture[] = []
    public faceRecognition: FaceRecognition
    public faceDetector!: FaceDetector
    public faceDetectionCallback: FaceCaptureCallback|undefined
    public faceCaptureCallback: FaceCaptureCallback|undefined
    public livenessCheck: LivenessCheck|undefined
    /**
     * @internal
     */
    lastCaptureTime: number | null = null

    private readonly faceBuffer: CircularBuffer<Face>
    private faceAlignmentStatus: FaceAlignmentStatus = FaceAlignmentStatus.FOUND
    private fixTime: number | null = null
    private alignedFaceCount = 0
    private angleHistory: Angle[] = []
    private bearingGenerator: IterableIterator<Bearing>
    private bearingIterator: IteratorResult<unknown, any>
    private previousBearing: Bearing = Bearing.STRAIGHT
    private closed = false
    private readonly angleBearingEvaluation: AngleBearingEvaluation
    private readonly faceBoundsSmoothing: RectSmoothing = new RectSmoothing(5)
    private readonly faceAngleSmoothing: AngleSmoothing = new AngleSmoothing(5)
    private hasFaceBeenAligned = false
    // @ts-ignore
    private mediaRecorder!: MediaRecorder
    private videoType: string | undefined
    private faceRequirementListeners: Set<FaceRequirementListener> = new Set<FaceRequirementListener>()
    private imageSize!: Size
    private pendingFaceRequirementsNotificationBearing: Bearing|null = null
    private videoTrack!: MediaStreamTrack
    private previousFaceAngle: Angle|null = null

    public constructor(settings?: LivenessDetectionSessionSettings, faceRecognition?: FaceRecognition) {
        if (!settings) {
            settings = new LivenessDetectionSessionSettings()
        }
        this.settings = settings
        this.ui = settings.createUI()
        this.faceRecognition = faceRecognition || new FaceRecognition()
        this.faceBuffer =  new CircularBuffer<Face>(settings.faceCaptureFaceCount)
        this.angleBearingEvaluation = new AngleBearingEvaluation(settings, 5, 5)
        this.bearingGenerator = this.nextCaptureBearing.apply(this)
        this.bearingIterator = this.bearingGenerator.next()
    }

    public readonly registerFaceRequirementListener = (listener: FaceRequirementListener) => {
        this.faceRequirementListeners.add(listener)
        if (this.imageSize) {
            listener.onChange(this.faceRequirements(this.imageSize, this.bearingIterator.value))
        }
    }

    public readonly unregisterFaceRequirementListener = (listener: FaceRequirementListener) => {
        this.faceRequirementListeners.delete(listener)
    }

    /**
     * @internal
     */
    get requestedBearing(): Bearing {
        return this.bearingIterator.value || Bearing.STRAIGHT
    }
    /**
     * @internal
     */
    readonly setupVideo = async (): Promise<void> => {
        if (!("mediaDevices" in navigator)) {
            return Promise.reject(new Error("Unsupported browser"))
        }

        const constraints: MediaTrackSupportedConstraints = navigator.mediaDevices.getSupportedConstraints();
        const getUserMediaOptions: MediaStreamConstraints = {
            "audio": false,
            "video": true
        }
        if (constraints.facingMode) {
            getUserMediaOptions.video = {
                "facingMode": this.settings.useFrontCamera ? "user" : "environment"
            }
        }
        if (constraints.width) {
            const videoHeight = 720
            if (typeof(getUserMediaOptions.video) === "boolean") {
                getUserMediaOptions.video = {
                    "height": videoHeight
                }
            } else {
                getUserMediaOptions.video!.height = videoHeight
            }
        }
        const stream = await navigator.mediaDevices.getUserMedia(getUserMediaOptions)
        this.videoTrack = stream.getVideoTracks()[0]
        const videoSize: Size = {
            width: this.videoTrack.getSettings().width!,
            height: this.videoTrack.getSettings().height!
        }
        if ("srcObject" in this.ui.video) {
            this.ui.video.srcObject = stream;
        } else {
            // @ts-ignore: Alternative API
            this.ui.video.src = URL.createObjectURL(stream);
        }
        this.onVideoSize(videoSize)
        this.onMediaStreamAvailable(stream)
    }

    /**
     * @internal
     */
    readonly faceAngleMatchesRequirements = (angle: Angle, requirements: FaceRequirements): boolean => {
        return angle.yaw >= requirements.accepted.yaw.from && angle.yaw <= requirements.accepted.yaw.to && angle.pitch >= requirements.accepted.pitch.from && angle.pitch <= requirements.accepted.pitch.to
    }

    /**
     * @internal
     */
    readonly faceRequirements = (imageSize: Size, bearing: Bearing = this.bearingIterator.value): FaceRequirements => {
        const minAngle = this.angleBearingEvaluation.minAngleForBearing(bearing)
        const maxAngle = this.angleBearingEvaluation.maxAngleForBearing(bearing)
        const requirements: FaceRequirements = {
            imageSize: imageSize,
            ideal: {
                bounds: this.settings.expectedFaceRect(imageSize),
                angle: this.angleBearingEvaluation.angleForBearing(bearing)
            },
            accepted: {
                left: {
                    from: Number.NEGATIVE_INFINITY,
                    to: Number.POSITIVE_INFINITY
                },
                top: {
                    from: Number.NEGATIVE_INFINITY,
                    to: Number.POSITIVE_INFINITY
                },
                right: {
                    from: Number.NEGATIVE_INFINITY,
                    to: Number.POSITIVE_INFINITY
                },
                bottom: {
                    from: Number.NEGATIVE_INFINITY,
                    to: Number.POSITIVE_INFINITY
                },
                yaw: {
                    from: minAngle.yaw,
                    to: maxAngle.yaw
                },
                pitch: {
                    from: minAngle.pitch,
                    to: maxAngle.pitch
                }
            }
        }
        if (!this.hasFaceBeenAligned) {
            const expectedFaceBounds = this.settings.expectedFaceRect(imageSize)
            const maxRect: Rect = new Rect(0, 0, imageSize.width, imageSize.height)
            const inset = expectedFaceBounds.width * 0.25
            const minRect: Rect = new Rect(expectedFaceBounds.x + inset, expectedFaceBounds.y + inset, expectedFaceBounds.width - inset * 2, expectedFaceBounds.height - inset * 2)
            requirements.accepted.left.from = maxRect.x
            requirements.accepted.left.to = minRect.x
            requirements.accepted.top.from = maxRect.y
            requirements.accepted.top.to = minRect.y
            requirements.accepted.right.from = minRect.right
            requirements.accepted.right.to = maxRect.right
            requirements.accepted.bottom.from = minRect.bottom
            requirements.accepted.bottom.to = maxRect.bottom
        }
        return requirements
    }

    /**
     * @internal
     */
    readonly isFaceFixedInImageSize = (actualFaceBounds: Rect, imageSize: Size): boolean => {
        const requirements = this.faceRequirements(imageSize)
        return actualFaceBounds.x >= requirements.accepted.left.from 
            && actualFaceBounds.x <= requirements.accepted.left.to 
            && actualFaceBounds.y >= requirements.accepted.top.from 
            && actualFaceBounds.y <= requirements.accepted.top.to
            && actualFaceBounds.right >= requirements.accepted.right.from
            && actualFaceBounds.right <= requirements.accepted.right.to
            && actualFaceBounds.bottom >= requirements.accepted.bottom.from
            && actualFaceBounds.bottom <= requirements.accepted.bottom.to;
    }

    /**
     * @internal
     */
    readonly detectFacePresence = (capture: FaceCapture): FaceCapture => {
        if (capture.face) {
            this.faceBuffer.enqueue(capture.face)
            this.faceBoundsSmoothing.addSample(capture.face.bounds)
            this.faceAngleSmoothing.addSample(capture.face.angle)
        } else if (this.alignedFaceCount > 0 && this.alignedFaceCount < this.settings.faceCaptureFaceCount) {
            const isFaceBufferEmpty = this.faceBuffer.isEmpty
            this.faceBuffer.dequeue()
            if (!isFaceBufferEmpty && this.faceBuffer.isEmpty) {
                throw new Error("Face lost")
            }
            this.faceBoundsSmoothing.removeFirstSample()
            this.faceAngleSmoothing.removeFirstSample()
        }
        capture.faceBounds = this.faceBoundsSmoothing.smoothedValue
        capture.faceAngle = this.faceAngleSmoothing.smoothedValue
        this.recordAngleDistanceAndTrajectory(capture)
        return capture
    }

    /**
     * @internal
     */
    readonly detectFaceAlignment = (capture: FaceCapture): FaceCapture => {
        if (!this.faceBuffer.isEmpty) {
            this.setFaceAlignmentFromFace(this.faceBuffer.lastElement!, capture)
        } else {
            this.faceAlignmentStatus = FaceAlignmentStatus.FOUND
        }
        capture.faceAlignmentStatus = this.faceAlignmentStatus
        return capture
    }

    /**
     * @internal
     */
    readonly detectSpoofAttempt = (capture: FaceCapture): FaceCapture => {
        const face: Face|undefined = this.faceBuffer.lastElement
        if (!face) {
            this.angleHistory = []
            return capture
        }
        if (capture.faceAlignmentStatus != FaceAlignmentStatus.ALIGNED) {
            this.angleHistory.push(face.angle)
            return capture
        }
        if (this.movedOpposite()) {
            throw new Error("Moved opposite")
        }
        this.angleHistory = []
        return capture
    }

    /**
     * @internal
     */
    readonly createFaceCapture = (capture: FaceCapture): Observable<FaceCapture> => {
        if (capture.requestedBearing == Bearing.STRAIGHT && (!capture.face || !capture.face.template)) {
            const bounds: Rect|undefined = capture.face ? capture.face.bounds : undefined
            return from(this.faceRecognition.detectRecognizableFace(capture.image, bounds).then((recognizableFace: RecognizableFace) => {
                if (capture.face) {
                    capture.face.template = recognizableFace.template
                }
                return capture
            }))
        } else {
            return of(capture)
        }
    }

    /**
     * @internal
     */
    readonly checkLiveness = (result: LivenessDetectionSessionResult): Observable<LivenessDetectionSessionResult> => {
        if (!this.livenessCheck) {
            return of(result)
        }
        const capture = result.faceCaptures.find(capture => capture.requestedBearing == Bearing.STRAIGHT)
        if (!capture) {
            return throwError(() => new Error("Failed to extract face capture"))
        }
        return from(this.livenessCheck.checkLiveness(capture.image).then(score => {
            result.livenessScore = score
            if (score < 0.5) {
                throw new Error("Liveness check failed (score "+score.toFixed(2)+")")
            }
            return result
        }))
    }

    /**
     * @internal
     */
    readonly resultFromCaptures = (captures: FaceCapture[]): Observable<LivenessDetectionSessionResult> => {
        let promise: Promise<any> = Promise.resolve()
        if (this.controlFaceCaptures.length > 0) {
            const faceDetectionInput: RecognizableFaceDetectionInput = {}
            try {
                let i = 1
                this.controlFaceCaptures.forEach(capture => {
                    faceDetectionInput["image_"+(i++)] = {image: capture.image, faceRect: capture.face?.bounds}
                })
            } catch (error) {
                return throwError(() => error)
            }
            promise = this.faceRecognition.detectRecognizableFacesInImages(faceDetectionInput).then((response: RecognizableFaceDetectionOutput) => {
                if (Object.values(response).length == 0) {
                    return this.settings.controlFaceSimilarityThreshold
                }
                if (captures.filter(capture => capture.face && capture.face.template && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED).length == 0) {
                    return this.settings.controlFaceSimilarityThreshold
                }
                return this.compareControlFacesToCaptureFaces(response, captures)
            }).then((score: number) => {
                if (score < this.settings.controlFaceSimilarityThreshold) {
                    throw new Error("Detected possible spoof attempt")
                }
            })
        }
        captures.sort((a: FaceCapture, b: FaceCapture) => {
            return a.time - b.time
        })
        if (this.settings.recordSessionVideo && this.mediaRecorder) {
            promise = promise.then(() => this.getVideoURL()).then(videoURL => new LivenessDetectionSessionResult(new Date(this.startTime), captures, videoURL))
        } else {
            promise = promise.then(() => new LivenessDetectionSessionResult(new Date(this.startTime), captures))
        }
        return from(promise)
    }

    /**
     * @internal
     */
    readonly onVideoSize = (videoSize: Size) => {
        this.imageSize = videoSize
        if (this.pendingFaceRequirementsNotificationBearing !== null) {
            const bearing = this.pendingFaceRequirementsNotificationBearing
            this.pendingFaceRequirementsNotificationBearing = null
            this.notifyFaceRequirementListeners(bearing)
        }
    }

    /**
     * @internal
     */
    readonly onMediaStreamAvailable = (stream: MediaStream) => {        
        if (!this.settings.recordSessionVideo || !("MediaRecorder" in window)) {
            return
        }
        const videoTypes = ["video/mp4", "video/mpeg"]
        for (let videoType of videoTypes) {
            // @ts-ignore
            if (MediaRecorder.isTypeSupported(videoType)) {
                this.videoType = videoType
                break
            }
        }
        if (!this.videoType) {
            return
        }
        // @ts-ignore
        this.mediaRecorder = new MediaRecorder(stream)
        this.mediaRecorder.start()
    }

    public readonly close = () => {
        if (!this.closed) {
            this.closed = true
            this.cleanup()
            requestAnimationFrame(() => {
                this.ui.trigger({"type":LivenessDetectionSessionEventType.CLOSE})
            })
        }
    }

    public get isClosed(): boolean {
        return this.closed
    }

    protected cleanup = (): void => {
        if (this.videoTrack) {
            this.videoTrack.stop()
        }
        this.faceAlignmentStatus = FaceAlignmentStatus.FOUND
        // this.faces.clear()
        this.faceBuffer.clear()
        this.angleHistory = []
        this.alignedFaceCount = 0
        this.fixTime = null
        this.hasFaceBeenAligned = false
        this.previousBearing = Bearing.STRAIGHT
        this.previousFaceAngle = null
        this.bearingGenerator = this.nextCaptureBearing()
        this.bearingIterator = this.bearingGenerator.next()
    }

    protected selectNextBearing = (availableBearings: Bearing[]): Bearing => {
        return availableBearings[Math.floor(Math.random()*availableBearings.length)]
    }

    private getVideoURL = (): Promise<string> => {
        if (!this.settings.recordSessionVideo || !("MediaRecorder" in window) || !this.mediaRecorder) {
            return Promise.reject(new Error("Video recording disabled or unavailable"))
        }
        return new Promise((resolve, reject) => {
            this.mediaRecorder.ondataavailable = (event: any) => {
                const blob = new Blob([event.data], {
                    type: this.videoType
                })
                const fileReader: FileReader = new FileReader()
                fileReader.onloadend = () => {
                    resolve(fileReader.result as string)
                }
                fileReader.onerror = () => {
                    reject(new Error("Failed to read video"))
                }
                fileReader.readAsDataURL(blob)
            }
            this.mediaRecorder.onerror = () => {
                reject(new Error("Failed to record video"))
            }
            this.mediaRecorder.stop()
        })
    }

    private async compareControlFacesToCaptureFaces(controlFaces: RecognizableFaceDetectionOutput, captures: FaceCapture[]): Promise<number> {
        const captureTemplates: string[] = captures.filter(capture => capture.face && capture.face.template && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED).map(capture => capture.face?.template).filter(val => val !== undefined) as string[]
        const controlTemplates: string[] = Object.values(controlFaces).map(face => face.template)
        const scores = await Promise.all(captureTemplates.map(template => this.faceRecognition.compareFaceTemplateToTemplates(template, controlTemplates)))
        if (scores.length == 0) {
            return 0
        }
        if (scores.length == 1) {
            return scores[0]
        }
        return scores.reduce((previous, current) => Math.min(previous, current))
    }

    // private movedTooFast = (): boolean => {
    //     if (this.previousBearing != this.bearingIterator.value) {
    //         const previousAngle: Angle = this.angleBearingEvaluation.angleForBearing(this.previousBearing)
    //         const currentAngle: Angle = this.angleBearingEvaluation.angleForBearing(this.bearingIterator.value)
    //         const startYaw: number = Math.min(previousAngle.yaw, currentAngle.yaw)
    //         const endYaw: number = Math.max(previousAngle.yaw, currentAngle.yaw)
    //         const yawTolerance: number = this.angleBearingEvaluation.thresholdAngleToleranceForAxis(Axis.YAW)
    //         let movedTooFast: boolean = this.angleHistory.length > 1
    //         for (const angle of this.angleHistory) {
    //             if (angle.yaw > startYaw - yawTolerance && angle.yaw < endYaw + yawTolerance) {
    //                 movedTooFast = false
    //             }
    //         }
    //         return movedTooFast
    //     }
    //     return false
    // }

    private movedOpposite = (): boolean => {
        if (this.previousBearing != this.bearingIterator.value) {
            for (const angle of this.angleHistory) {
                if (!this.angleBearingEvaluation.isAngleBetweenBearings(angle, this.previousBearing, this.bearingIterator.value)) {
                    return true
                }
            }
        }
        return false
    }

    private areAllBufferedFacesAligned = (capture: FaceCapture): boolean => {
        for (let i=0; i<this.faceBuffer.length; i++) {
            const f: Face|undefined = this.faceBuffer.get(i)
            if (!f)  {
                return false
            }
            if (!this.faceAngleMatchesRequirements(f.angle, this.faceRequirements(capture.imageSize))) {
                return false
            }
        }
        return true
    }

    private setFaceAlignmentFromFace = (face: Face, capture: FaceCapture): void => {
        const now: number = new Date().getTime()/1000
        if (this.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED) {
            this.faceAlignmentStatus = FaceAlignmentStatus.FIXED
            this.fixTime = now
        }
        // this.faces.enqueue(face)
        if (this.faceAlignmentStatus == FaceAlignmentStatus.FOUND && this.isFaceFixedInImageSize(face.bounds, capture.imageSize)) {
            this.fixTime = now
            this.faceAlignmentStatus = FaceAlignmentStatus.FIXED
        } else if (this.fixTime && now - this.fixTime > this.settings.pauseDuration && this.faceBuffer.isFull) {
            if (!this.areAllBufferedFacesAligned(capture)) {
                this.faceAlignmentStatus = FaceAlignmentStatus.MISALIGNED
                capture.offsetAngleFromBearing = this.angleBearingEvaluation.offsetFromAngleToBearing(capture.faceAngle ? capture.faceAngle : new Angle(), this.bearingIterator.value)
            } else {
                // this.faces.clear()
                this.faceBuffer.clear()
                this.faceAlignmentStatus = FaceAlignmentStatus.ALIGNED
                this.fixTime = now
                this.alignedFaceCount += 1
                this.previousBearing = this.bearingIterator.value
                this.bearingIterator = this.bearingGenerator.next()
            }
        }
    }

    // private hasFaceMovedTooFar = (faceAngle: Angle, faceBounds: Rect, imageSize: Size): boolean => {
    //     const requestedAngle: number = this.angleBearingEvaluation.angleForBearing(this.bearingIterator.value).screenAngle
    //     const detectedAngle: number = faceAngle.screenAngle
    //     const deg45: number = 45 * (Math.PI/180)
    //     const inset: number = 0 - Math.min(imageSize.width, imageSize.height) * 0.05
    //     const rect: Rect = new Rect(0, 0, imageSize.width, imageSize.height)
    //     rect.inset(inset, inset)
    //     return rect.contains(faceBounds) && detectedAngle > requestedAngle - deg45 && detectedAngle < requestedAngle + deg45
    // }

    private recordAngleDistanceAndTrajectory = (capture: FaceCapture): void => {
        capture.angleTrajectory = undefined
        capture.angleDistance = 0
        if (capture.faceAngle) {
            if (this.previousFaceAngle) {
                const target = this.angleBearingEvaluation.angleForBearing(this.bearingIterator.value)
                const previousToTarget = Math.atan2(this.previousFaceAngle.pitch-target.pitch, this.previousFaceAngle.yaw-target.yaw)
                const previousToCurrent = Math.atan2(this.previousFaceAngle.pitch-capture.faceAngle.pitch, this.previousFaceAngle.yaw-capture.faceAngle.yaw)
                const previousBearingAngle = this.angleBearingEvaluation.angleForBearing(this.previousBearing)
                const requestedBearingAngle = this.angleBearingEvaluation.angleForBearing(this.bearingIterator.value)
                const angleDistance = Math.hypot(requestedBearingAngle.pitch-previousBearingAngle.pitch, requestedBearingAngle.yaw-previousBearingAngle.yaw)
                if (angleDistance != 0) {
                    const faceAngleDistance = Math.hypot(requestedBearingAngle.pitch-capture.faceAngle.pitch, requestedBearingAngle.yaw-capture.faceAngle.yaw)                    
                    capture.angleDistance = Math.min(faceAngleDistance / angleDistance, 1)
                }
                capture.angleTrajectory = 1 - Math.abs((previousToTarget - previousToCurrent) / Math.PI)
            }
            this.previousFaceAngle = capture.faceAngle
        } else {
            this.previousFaceAngle = null;
        }
    }

    private *nextCaptureBearing(): IterableIterator<Bearing> {
        let nextBearing: Bearing = Bearing.STRAIGHT
        this.notifyFaceRequirementListeners(nextBearing)
        yield nextBearing
        for (let i=1; i<this.settings.faceCaptureCount; i++) {
            let availableBearings = this.settings.bearings.filter((bearing: Bearing) => bearing != nextBearing && this.angleBearingEvaluation.angleForBearing(bearing).yaw != this.angleBearingEvaluation.angleForBearing(nextBearing).yaw)
            if (availableBearings.length == 0) {
                availableBearings = this.settings.bearings.filter((bearing: Bearing) => bearing != nextBearing)
            }
            if (availableBearings.length > 0) {
                nextBearing = this.selectNextBearing(availableBearings)
            }
            this.notifyFaceRequirementListeners(nextBearing)
            if (i < this.settings.faceCaptureCount - 1) {
                yield nextBearing
            } else {
                return nextBearing
            }
        }
    }

    private notifyFaceRequirementListeners = (bearing: Bearing) => {
        if (!this.imageSize) {
            this.pendingFaceRequirementsNotificationBearing = bearing
            return
        }
        for (const listener of this.faceRequirementListeners) {
            listener.onChange(this.faceRequirements(this.imageSize, bearing))
        }
    }
}

/**
 * @category Face detection testing
 */
export class MockLivenessDetectionSession extends LivenessDetectionSession {

    readonly setupVideo = (): Promise<void> => {
        const videoURL = "/images/camera_placeholder.mp4"
        return new Promise((resolve, reject) => {
            this.ui.video.onloadedmetadata = () => {
                const videoSize = {
                    width: this.ui.video.videoWidth,
                    height: this.ui.video.videoHeight
                }
                this.onVideoSize(videoSize)
            }
            this.ui.video.oncanplaythrough = () => {
                this.ui.video.play().then(resolve).catch(reject)
            }
            this.ui.video.onerror = () => {
                reject(new Error("Failed to load video from "+videoURL))
            }
            fetch(videoURL).then(response => {
                if (!response.ok) {
                    throw new Error("Received status "+response.status+" when fetching video")
                }
                return response.blob()
            }).then(videoBlob => {
                if ("srcObject" in this.ui.video) {
                    this.ui.video.srcObject = videoBlob;
                } else {
                    // @ts-ignore: Alternative API
                    this.ui.video.src = URL.createObjectURL(videoBlob);
                }
                resolve()
            }).catch(reject)
        })
    }
}

/**
 * Liveness detection session settings
 * @category Face detection
 */

export class LivenessDetectionSessionSettings {
    /**
     * Whether to use the device's front-facing (selfie) camera
     * @defaultValue `true`
     */
    useFrontCamera = true;
    /**
     * How many face captures should be collected in a session
     * @defaultValue `2`
     */
    faceCaptureCount = 2;
    /**
     * Maximum session duration (seconds)
     * @defaultValue `30`
     */
    maxDuration = 30;
    /**
     * Horizontal (yaw) threshold where face is considered to be at an angle
     *
     * For example, a value of 15 indicates that a face with yaw -15 and below is oriented left and a face with yaw 15 or above is oriented right
     * @defaultValue `28`
     */
    yawThreshold = 28;
    /**
     * Vertical (pitch) threshold where face is considered to be at an angle
     *
     * For example, a value of 15 indicates that a face with pitch -15 and below is oriented up and a face with pitch 15 or above is oriented down
     * @defaultValue `10`
     */
    pitchThreshold = 10;
    /**
     * Number of faces to collect per face capture
     * @defaultValue `2`
     */
    faceCaptureFaceCount = 3;
    /**
     * When the face is fixed the face detection will pause to allow enough time for the user to read the on-screen instructions
     *
     * Decreasing the pause time will shorten the session but may lead to a frustrating user experience if the user isn't allowed enough time to read the prompts
     * @defaultValue `0.5`
     */
    pauseDuration = 0.5;
    /**
     * Where a face is expected in relation to the camera frame
     * @defaultValue `FaceExtents(0.65, 0.85)`
     */
    expectedFaceExtents: FaceExtents = new FaceExtents(0.65, 0.85);
    /**
     * Bearings the user may be asked to assume during the session
     *
     * Note that the user will unlikely be asked to assume all the bearings in the set. The array is simply a pool from which the session will draw a random member.
     * @defaultValue `[Bearing.STRAIGHT, Bearing.LEFT, Bearing.RIGHT, Bearing.LEFT_UP, Bearing.RIGHT_UP]`
     */
    bearings = [Bearing.STRAIGHT, Bearing.LEFT, Bearing.RIGHT, Bearing.LEFT_UP, Bearing.RIGHT_UP];

    /**
     * Set to `true` to record a video of the session
     *
     * Note that some older browsers may not be capable of recording video
     * @defaultValue `false`
     */
    recordSessionVideo = false;

    /**
     * Background: Once the initial aligned face is detected the session will start capturing "control" faces at interval set in the `controlFaceCaptureInterval` property until `maxControlFaceCount` faces are collected or the session finishes.
     * These control faces are then compared to the aligned face to ensure that the person performing the liveness detection is the same person as the one on the aligned face.
     * This prevents attacks where a picture is presented to the camera and a live person finishes the liveness detection.
     * @defaultValue `3.7`
     */
    controlFaceSimilarityThreshold = 3.7;

    /**
     * Interval at which to capture "control" faces.
     * See `controlFaceSimilarityThreshold` for an explanation.
     * @defaultValue `500`
     */
    controlFaceCaptureInterval = 500;

    /**
     * Number of "control" faces to capture during a session.
     * See `controlFaceSimilarityThreshold` for an explanation.
     * @defaultValue `4`
     */
    maxControlFaceCount = 4;

    /**
     * Set your own function if you wish to supply your own graphical user interface for the session.
     * @returns Function that supplies an instance of `FaceCaptureUI`
     */
    createUI: () => LivenessDetectionSessionUI = () => new VerIDLivenessDetectionSessionUI(this);

    /**
     * @param imageSize Image size
     * @returns Boundary of where the session expects a face in a given image size.
     */
    readonly expectedFaceRect = (imageSize: Size): Rect => {
        const faceRect = new Rect(0, 0, 0, 0);
        if (imageSize.width > imageSize.height) {
            faceRect.height = imageSize.height * this.expectedFaceExtents.proportionOfViewHeight;
            faceRect.width = faceRect.height / 1.25;
        } else {
            faceRect.width = imageSize.width * this.expectedFaceExtents.proportionOfViewWidth;
            faceRect.height = faceRect.width * 1.25;
        }
        faceRect.x = imageSize.width / 2 - faceRect.width / 2;
        faceRect.y = imageSize.height / 2 - faceRect.height / 2;
        return faceRect;
    };

    /**
     * Minimum face detection speed in frames per second.
     * If the device cannot detect faces fast enough the session will fail with an error.
     * @defaultValue `3.5`
     */
    minFPS = 3.5;
}
