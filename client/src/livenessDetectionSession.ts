import { Observable, from, of } from "rxjs"
import { FaceRecognition } from "./faceRecognition"
import { Face, LivenessDetectionSessionSettings, FaceCapture, LivenessDetectionSessionResult } from "./faceDetection"
import { LivenessDetectionSessionEventType, LivenessDetectionSessionUI } from "./faceDetectionUI"
import { Axis, Bearing, FaceAlignmentStatus, FaceRequirements, RecognizableFaceDetectionInput, RecognizableFaceDetectionOutput, Size, FaceRequirementListener, FaceCaptureCallback } from "./types"
import { Angle, AngleBearingEvaluation, AngleSmoothing, CircularBuffer, Rect, RectSmoothing } from "./utils"
import { FaceDetector } from "./faceDetector"

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
    public faceDetector: FaceDetector
    public faceDetectionCallback: FaceCaptureCallback = null
    public faceCaptureCallback: FaceCaptureCallback = null

    private readonly faceBuffer: CircularBuffer<Face>
    private faceAlignmentStatus: FaceAlignmentStatus = FaceAlignmentStatus.FOUND
    private fixTime: number = null
    private alignedFaceCount: number = 0
    private angleHistory: Angle[] = []
    private bearingGenerator: IterableIterator<Bearing>
    private bearingIterator: IteratorResult<unknown, any>
    private previousBearing: Bearing = Bearing.STRAIGHT
    private closed = false
    private readonly angleBearingEvaluation: AngleBearingEvaluation
    private readonly faceBoundsSmoothing: RectSmoothing = new RectSmoothing(5)
    private readonly faceAngleSmoothing: AngleSmoothing = new AngleSmoothing(5)
    private hasFaceBeenAligned = false
    private mediaRecorder: MediaRecorder
    private videoType: string
    private faceRequirementListeners: Set<FaceRequirementListener> = new Set()
    private imageSize: Size
    private pendingFaceRequirementsNotificationBearing: Bearing = null
    private videoTrack: MediaStreamTrack
    private previousFaceAngle: Angle = null

    public constructor(settings?: LivenessDetectionSessionSettings, faceRecognition?: FaceRecognition) {
        if (!settings) {
            settings = new LivenessDetectionSessionSettings()
        }
        this.settings = settings
        this.ui = settings.createUI()
        this.faceRecognition = faceRecognition
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
        return this.bearingIterator.value
    }
    /**
     * @internal
     */
    readonly setupVideo = async (): Promise<void> => {
        if (!navigator.mediaDevices) {
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
            const videoWidth: number = 480
            if (typeof(getUserMediaOptions.video) === "boolean") {
                getUserMediaOptions.video = {
                    "width": videoWidth
                }
            } else {
                getUserMediaOptions.video.width = videoWidth
            }
        }
        const stream = await navigator.mediaDevices.getUserMedia(getUserMediaOptions)
        this.videoTrack = stream.getVideoTracks()[0]
        const videoSize = {
            width: this.videoTrack.getSettings().width,
            height: this.videoTrack.getSettings().height
        }
        if ("srcObject" in this.ui.video) {
            this.ui.video.srcObject = stream;
        } else {
            // @ts-ignore
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
            const lastFace: Face = this.faceBuffer.lastElement
            if (lastFace != null && this.hasFaceMovedTooFar(lastFace, capture.image)) {
                throw new Error("Face moved too far")
            }
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
            this.setFaceAlignmentFromFace(this.faceBuffer.lastElement, capture)
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
        const face: Face = this.faceBuffer.lastElement
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
            const bounds: Rect = capture.face ? capture.face.bounds : null
            return from(this.faceRecognition.detectRecognizableFace(capture.image, bounds).then(recognizableFace => {
                capture.face.template = recognizableFace.template
                return capture
            }))
        } else {
            return of(capture)
        }
    }

    /**
     * @internal
     */
    readonly resultFromCaptures = (captures: FaceCapture[]): Observable<LivenessDetectionSessionResult> => {
        let promise: Promise<any> = Promise.resolve()
        if (this.controlFaceCaptures.length > 0) {
            const faceDetectionInput: RecognizableFaceDetectionInput = {}
            let i = 1
            this.controlFaceCaptures.forEach(capture => {
                faceDetectionInput["image_"+(i++)] = {image: capture.image, faceRect: capture.face.bounds}
            })
            promise = this.faceRecognition.detectRecognizableFacesInImages(faceDetectionInput).then((response: RecognizableFaceDetectionOutput) => {
                if (Object.values(response).length == 0) {
                    return this.settings.controlFaceSimilarityThreshold
                }
                return this.compareControlFacesToCaptureFaces(response, captures)
            }).then(score => {
                if (score < this.settings.controlFaceSimilarityThreshold) {
                    throw new Error("Detected possible spoof attempt")
                }
            })
        }
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
            if (MediaRecorder.isTypeSupported(videoType)) {
                this.videoType = videoType
                break
            }
        }
        if (!this.videoType) {
            return
        }
        this.mediaRecorder = new MediaRecorder(stream)
        this.mediaRecorder.start()
    }

    public readonly close = () => {
        if (!this.closed) {
            this.closed = true
            this.cleanup()
            setTimeout(() => {
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
            this.videoTrack = null
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
            this.mediaRecorder.ondataavailable = (event) => {
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
            this.mediaRecorder.onerror = (event) => {
                reject(new Error("Failed to record video"))
            }
            this.mediaRecorder.stop()
        })
    }

    private async compareControlFacesToCaptureFaces(controlFaces: RecognizableFaceDetectionOutput, captures: FaceCapture[]): Promise<number> {
        const captureTemplates: string[] = captures.filter(capture => capture.face && capture.face.template && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED).map(capture => capture.face.template)
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

    private movedTooFast = (): boolean => {
        if (this.previousBearing != this.bearingIterator.value) {
            const previousAngle: Angle = this.angleBearingEvaluation.angleForBearing(this.previousBearing)
            const currentAngle: Angle = this.angleBearingEvaluation.angleForBearing(this.bearingIterator.value)
            const startYaw: number = Math.min(previousAngle.yaw, currentAngle.yaw)
            const endYaw: number = Math.max(previousAngle.yaw, currentAngle.yaw)
            const yawTolerance: number = this.angleBearingEvaluation.thresholdAngleToleranceForAxis(Axis.YAW)
            let movedTooFast: boolean = this.angleHistory.length > 1
            for (let angle of this.angleHistory) {
                if (angle.yaw > startYaw - yawTolerance && angle.yaw < endYaw + yawTolerance) {
                    movedTooFast = false
                }
            }
            return movedTooFast
        }
        return false
    }

    private movedOpposite = (): boolean => {
        if (this.previousBearing != this.bearingIterator.value) {
            for (let angle of this.angleHistory) {
                if (!this.angleBearingEvaluation.isAngleBetweenBearings(angle, this.previousBearing, this.bearingIterator.value)) {
                    return true
                }
            }
        }
        return false
    }

    private areAllBufferedFacesAligned = (capture: FaceCapture): boolean => {
        for (let i=0; i<this.faceBuffer.length; i++) {
            const f: Face = this.faceBuffer.get(i)
            if (!this.faceAngleMatchesRequirements(f.angle, this.faceRequirements(capture.image))) {
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
        if (this.faceAlignmentStatus == FaceAlignmentStatus.FOUND && this.isFaceFixedInImageSize(face.bounds, capture.image)) {
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

    private hasFaceMovedTooFar = (face: Face, imageSize: Size): boolean => {
        const requestedAngle: number = this.angleBearingEvaluation.angleForBearing(this.bearingIterator.value).screenAngle
        const detectedAngle: number = face.angle.screenAngle
        const deg45: number = 45 * (Math.PI/180)
        const inset: number = Math.min(imageSize.width, imageSize.height) * 0.05
        const rect: Rect = new Rect(0, 0, imageSize.width, imageSize.height)
        rect.inset(inset, inset)
        return rect.contains(face.bounds) && detectedAngle > requestedAngle - deg45 && detectedAngle < requestedAngle + deg45
    }

    private recordAngleDistanceAndTrajectory = (capture: FaceCapture): void => {
        capture.angleTrajectory = null
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
            let availableBearings = this.settings.bearings.filter(bearing => bearing != nextBearing && this.angleBearingEvaluation.angleForBearing(bearing).yaw != this.angleBearingEvaluation.angleForBearing(nextBearing).yaw)
            if (availableBearings.length == 0) {
                availableBearings = this.settings.bearings.filter(bearing => bearing != nextBearing)
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
        for (let listener of this.faceRequirementListeners) {
            listener.onChange(this.faceRequirements(this.imageSize, bearing))
        }
    }
}

/**
 * @category Face detection testing
 */
export class MockLivenessDetectionSession extends LivenessDetectionSession {

    readonly setupVideo = async (): Promise<void> => {
        const videoURL: string = "/images/camera_placeholder.mp4"
        return new Promise(async (resolve, reject) => {
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
            try {
                const response: Response = await fetch(videoURL)
                if (response.status != 200) {
                    throw new Error("Received status "+response.status+" when fetching video")
                }
                const videoBlob: Blob = await response.blob()
                if ("srcObject" in this.ui.video) {
                    this.ui.video.srcObject = videoBlob;
                } else {
                    // @ts-ignore
                    this.ui.video.src = URL.createObjectURL(videoBlob);
                }
            } catch (error) {
                reject(error)
            }
        })
    }
}