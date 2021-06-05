/**
 * Ver-ID face detection
 * @packageDocumentation
 */

import { Observable, from, of, throwError, Subscription, Subscriber } from "rxjs"
import { map, filter, take, takeWhile, tap, mergeMap, toArray } from "rxjs/operators"
import { CircularBuffer, AngleBearingEvaluation, Angle, Rect, RectSmoothing, AngleSmoothing, Point, emitRxEvent } from "./utils"
import { FaceRecognition } from "./faceRecognition"
import * as faceapi from "face-api.js/build/es6"
import { estimateFaceAngle } from "./faceAngle"
import { estimateFaceAngle as estimateFaceAngleNoseTip } from "./faceAngleNoseTip"
import { Axis, Size, Bearing, FaceAlignmentStatus } from "./types"
import { FaceCaptureEventType, FaceCaptureUI, VerIDFaceCaptureUI } from "./faceDetectionUI"

/**
 * Face detection
 */
export class FaceDetection {
    /**
     * Base URL of the server that accepts the face detection calls
     */
    readonly serviceURL: string
    private readonly faceRecognition: FaceRecognition
    private readonly loadPromises: Promise<void>[]

    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    constructor(serviceURL?: string) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : ""
        this.faceRecognition = new FaceRecognition(this.serviceURL)
        this.loadPromises = [
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models")
        ]
    }

    private calculateFaceAngle(face: any): Angle {
        const landmarks: Point[] = face.landmarks.positions.map(pt => new Point(pt.x, pt.y))
        return estimateFaceAngle(landmarks, estimateFaceAngleNoseTip)
    }

    private faceApiFaceToVerIDFace(face: any, imageWidth: number, mirrorOutput: boolean = false): Face {
        const angle: Angle = this.calculateFaceAngle(face)
        const leftEye: Point[] = face.landmarks.getLeftEye()
        const rightEye: Point[] = face.landmarks.getRightEye()
        const leftEyeCentre: Point = {
            "x": leftEye[0].x + (leftEye[3].x - leftEye[0].x) / 2,
            "y": leftEye[0].y + (leftEye[3].y - leftEye[0].y) / 2
        }
        const rightEyeCentre: Point = {
            "x": rightEye[0].x + (rightEye[3].x - rightEye[0].x) / 2,
            "y": rightEye[0].y + (rightEye[3].y - rightEye[0].y) / 2
        }
        const distanceBetweenEyes: number = Math.sqrt(Math.pow(rightEyeCentre.x - leftEyeCentre.x, 2) + Math.pow(rightEyeCentre.y - leftEyeCentre.y, 2))
        const ovalCentre: Point = {
            "x": leftEyeCentre.x + (rightEyeCentre.x - leftEyeCentre.x) / 2,
            "y": leftEyeCentre.y + (rightEyeCentre.y - leftEyeCentre.y) / 2
        }
        const ovalSize: Size = {
            "width": distanceBetweenEyes * 3,
            "height": 0
        }
        ovalSize.height = ovalSize.width / 4 * 5
        if (mirrorOutput) {
            ovalCentre.x = imageWidth - ovalCentre.x
            angle.yaw = 0-angle.yaw
        }
        ovalCentre.y += ovalSize.height * 0.04
        const veridFace: Face = new Face(new Rect(ovalCentre.x - ovalSize.width / 2, ovalCentre.y - ovalSize.height / 2, ovalSize.width, ovalSize.height), angle)
        if (mirrorOutput) {
            veridFace.bounds = veridFace.bounds.mirrored(imageWidth)
        }
        return veridFace
    }

    async detectFaceInImage(image: HTMLImageElement): Promise<Face> {
        await Promise.all(this.loadPromises)
        const face = await faceapi.detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({"inputSize": 128})).withFaceLandmarks()
        if (face) {
            return this.faceApiFaceToVerIDFace(face, image.naturalWidth)
        }
        throw new Error("Face not found")
    }

    /**
     * @returns `true` if liveness detection is supported by the client
     */
    static isLivenessDetectionSupported(): boolean {
        return "Promise" in window && "fetch" in window
    }

    private onVideoPlay(settings: FaceCaptureSettings, ui: FaceCaptureUI, subscriber: Subscriber<LiveFaceCapture>): () => void {
        const faceDetection = this
        return () => {
            const canvas: HTMLCanvasElement = document.createElement("canvas")
            canvas.width = ui.video.videoWidth
            canvas.height = ui.video.videoHeight
            const ctx: CanvasRenderingContext2D = canvas.getContext("2d")
            
            const detectSingleFace: () => void = async () => {
                try {
                    const _face = await faceapi.detectSingleFace(ui.video, new faceapi.TinyFaceDetectorOptions({"inputSize": 128})).withFaceLandmarks()
                    let face: Face
                    if (_face) {
                        face = faceDetection.faceApiFaceToVerIDFace(_face, canvas.width, settings.useFrontCamera)
                    }
                    if (!subscriber.closed) {
                        ctx.drawImage(ui.video, 0, 0, canvas.width, canvas.height)
                        const image: HTMLImageElement = new Image()
                        image.width = canvas.width
                        image.height = canvas.height
                        image.src = canvas.toDataURL()
                        emitRxEvent(subscriber, {"type": "next", "value": new LiveFaceCapture(image, face)})
                    }
                    if (!ui.video.paused && !ui.video.ended && !subscriber.closed) {
                        setTimeout(detectSingleFace, 0)
                    }
                } catch (error) {
                    emitRxEvent(subscriber, {"type": "error", "error": error})
                }
            }
            setTimeout(detectSingleFace, 0)
        }
    }

    private liveFaceCapture(session: LivenessDetectionSession): Observable<LiveFaceCapture> {
        return new Observable<LiveFaceCapture>(subscriber => {
            if (!navigator.mediaDevices) {
                emitRxEvent(subscriber, {"type": "error", "error": new Error("Unsupported browser")})
                return
            }

            let videoTrack: MediaStreamTrack
            const constraints: MediaTrackSupportedConstraints = navigator.mediaDevices.getSupportedConstraints();
            const getUserMediaOptions: MediaStreamConstraints = {
                "audio": false,
                "video": true
            }
            if (constraints.facingMode) {
                getUserMediaOptions.video = {
                    "facingMode": session.settings.useFrontCamera ? "user" : "environment"
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
            Promise.all(this.loadPromises).then(() => {
                return navigator.mediaDevices.getUserMedia(getUserMediaOptions)
            }).then((stream: MediaStream) => {
                videoTrack = stream.getVideoTracks()[0];
                session.ui.trigger({"type": FaceCaptureEventType.MEDIA_STREAM_AVAILABLE, "stream": stream})
                session.ui.video.onplay = this.onVideoPlay(session.settings, session.ui, subscriber)
            }).catch((error) => {
                emitRxEvent(subscriber, {"type": "error", "error": error})
            })
            return () => {
                if (videoTrack) {
                    videoTrack.stop()
                    videoTrack = null
                }
            }
        })
    }

    private checkLivenessSessionAvailability() {
        if (location.protocol != "https:") {
            throw new Error("Liveness detection is only supported on secure connections (https)")
        }
        if (!FaceDetection.isLivenessDetectionSupported()) {
            throw new Error("Liveness detection is not supported by your browser")
        }
    }

    /**
     * Create a liveness detection session. Subscribe to the returned Observable to start the session and to receive results.
     * @param settings Session settings
     * @param faceDetectionCallback Optional callback to invoke each time a frame is ran by face detection
     * @param faceCaptureCallback Optional callback to invoke when a face aligned to the requested bearing is captured
     */
    livenessDetectionSession(settings?: FaceCaptureSettings, faceDetectionCallback?: (faceDetectionResult: LiveFaceCapture) => void, faceCaptureCallback?: (faceCapture: LiveFaceCapture) => void): Observable<LivenessDetectionSessionResult> {
        try {
            this.checkLivenessSessionAvailability()
        } catch (error) {
            return throwError(() => error)
        }
        if (!settings) {
            settings = new FaceCaptureSettings()
        }
        const session = new LivenessDetectionSession(settings, this.faceRecognition)

        return <Observable<LivenessDetectionSessionResult>>(this.liveFaceCapture(session).pipe(
            map((capture: LiveFaceCapture): LiveFaceCapture => {
                capture.requestedBearing = session.bearingIterator.value
                return capture
            }),
            map(session.detectFacePresence),
            map(session.detectFaceAlignment),
            tap((capture: LiveFaceCapture) => {
                session.ui.trigger({"type": FaceCaptureEventType.FACE_CAPTURED, "capture": capture})
                if (faceDetectionCallback) {
                    faceDetectionCallback(capture)
                }
            }),
            filter((capture: LiveFaceCapture) => {
                return capture.face && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED
            }),
            mergeMap(session.createFaceCapture),
            tap((faceCapture: LiveFaceCapture) => {
                if (faceCaptureCallback) {
                    faceCaptureCallback(faceCapture)
                }
            }),
            take(settings.faceCaptureCount),
            takeWhile(() => {
                return new Date().getTime() < session.startTime + settings.maxDuration * 1000
            }),
            toArray(),
            map(session.resultFromCaptures),
            map((result: LivenessDetectionSessionResult) => {
                if (result.faceCaptures.length < settings.faceCaptureCount) {
                    throw new Error("Session timed out")
                }
                return result
            }),
            (observable: Observable<LivenessDetectionSessionResult>) => new Observable<LivenessDetectionSessionResult>(subscriber => {
                const subcription: Subscription = observable.subscribe({
                    next: (val: LivenessDetectionSessionResult) => {
                        emitRxEvent(subscriber, {"type": "next", "value": val})
                    },
                    error: (err: any) => {
                        session.close()
                        emitRxEvent(subscriber, {"type": "error", "error": err})
                    },
                    complete: () => {
                        session.close()
                        emitRxEvent(subscriber, {"type": "complete"})
                    }
                })
                session.ui.on(FaceCaptureEventType.CANCEL, () => {
                    emitRxEvent(subscriber, {"type": "complete"})
                })
                return () => {
                    subcription.unsubscribe()
                    session.close()
                }
            })
        ))
    }
}

class LivenessDetectionSession {
    readonly ui: FaceCaptureUI
    readonly faceBuffer: CircularBuffer<Face> = new CircularBuffer<Face>(3)
    readonly faces: CircularBuffer<Face>
    private faceDetected: boolean = false
    private faceAlignmentStatus: FaceAlignmentStatus = FaceAlignmentStatus.FOUND
    private fixTime: number = null
    private alignedFaceCount: number = 0
    private angleHistory: Angle[] = []
    private bearingGenerator: Generator
    bearingIterator: IteratorResult<unknown, any>
    private previousBearing: Bearing = Bearing.STRAIGHT
    private closed = false
    readonly startTime: number = new Date().getTime()
    readonly angleBearingEvaluation: AngleBearingEvaluation
    readonly faceBoundsSmoothing: RectSmoothing = new RectSmoothing(3)
    readonly faceAngleSmoothing: AngleSmoothing = new AngleSmoothing(3)
    readonly settings: FaceCaptureSettings
    readonly faceRecognition: FaceRecognition
    private hasFaceBeenAligned = false

    constructor(settings: FaceCaptureSettings, faceRecognition: FaceRecognition) {
        this.settings = settings
        this.ui = settings.createUI()
        this.faceRecognition = faceRecognition
        this.faces =  new CircularBuffer<Face>(settings.faceCaptureFaceCount)
        this.angleBearingEvaluation = new AngleBearingEvaluation(settings, 5, 5)
        const session = this
        function* nextCaptureBearing(): Generator {
            let lastBearing: Bearing = Bearing.STRAIGHT
            yield lastBearing
            for (let i=1; i<settings.faceCaptureCount; i++) {
                session.previousBearing = lastBearing
                let availableBearings = settings.bearings.filter(bearing => bearing != lastBearing && session.angleBearingEvaluation.angleForBearing(bearing).yaw != session.angleBearingEvaluation.angleForBearing(lastBearing).yaw)
                if (availableBearings.length == 0) {
                    availableBearings = settings.bearings.filter(bearing => bearing != lastBearing)
                }
                if (availableBearings.length > 0) {
                    lastBearing = availableBearings[Math.floor(Math.random()*availableBearings.length)]
                }
                if (i < settings.faceCaptureCount - 1) {
                    yield lastBearing
                } else {
                    return lastBearing
                }
            }
        }
        this.bearingGenerator =  nextCaptureBearing()
        this.bearingIterator = this.bearingGenerator.next()
    }

    isFaceFixedInImageSize = (actualFaceBounds: Rect, expectedFaceBounds: Rect, imageSize: Size): boolean => {
        if (this.hasFaceBeenAligned) {
            return true
        }
        const maxRect: Rect = new Rect(0, 0, imageSize.width, imageSize.height)
        const minRect: Rect = new Rect(expectedFaceBounds.x * 1.4, expectedFaceBounds.y * 1.4, expectedFaceBounds.width * 0.6, expectedFaceBounds.height * 0.6)
        this.hasFaceBeenAligned = actualFaceBounds.contains(minRect) && maxRect.contains(actualFaceBounds)
        return this.hasFaceBeenAligned
    }

    detectFacePresence = (capture: LiveFaceCapture): LiveFaceCapture => {
        if (capture.face) {
            this.faceBuffer.enqueue(capture.face)
            this.faceBoundsSmoothing.addSample(capture.face.bounds)
            this.faceAngleSmoothing.addSample(capture.face.angle)
            if (this.faceBuffer.isFull) {
                this.faceDetected = true
            }
        } else if (this.alignedFaceCount >= this.settings.faceCaptureFaceCount) {
            this.faceDetected = false
        } else {
            this.faceBuffer.dequeue()
            if (this.faceDetected && this.faceBuffer.isEmpty) {
                throw new Error("Face lost")
            }
            this.faceDetected = false
            this.faceBoundsSmoothing.removeFirstSample()
            this.faceAngleSmoothing.removeFirstSample()
            const lastFace: Face = this.faceBuffer.lastElement
            if (lastFace != null) {
                const requestedAngle: number = this.angleBearingEvaluation.angleForBearing(this.bearingIterator.value).screenAngle
                const detectedAngle: number = lastFace.angle.screenAngle
                const deg45: number = 45 * (Math.PI/180)
                const inset: number = Math.min(capture.image.width, capture.image.height) * 0.05
                const rect: Rect = new Rect(0, 0, capture.image.width, capture.image.height)
                rect.inset(inset, inset)
                if (rect.contains(lastFace.bounds) && detectedAngle > requestedAngle - deg45 && detectedAngle < requestedAngle + deg45) {
                    throw new Error("Face moved too far")
                }
            }
        }
        capture.faceBounds = this.faceBoundsSmoothing.smoothedValue
        capture.faceAngle = this.faceAngleSmoothing.smoothedValue
        capture.isFacePresent = this.faceDetected
        return capture
    }

    detectFaceAlignment = (capture: LiveFaceCapture): LiveFaceCapture => {
        if (capture.isFacePresent) {
            const face: Face = this.faceBuffer.lastElement
            if (face != null) {
                const now: number = new Date().getTime()/1000
                if (this.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED) {
                    this.faceAlignmentStatus = FaceAlignmentStatus.FIXED
                    this.fixTime = now
                }
                this.faces.enqueue(face)
                const imageSize: Size = capture.image
                if (this.faceAlignmentStatus == FaceAlignmentStatus.FOUND && this.isFaceFixedInImageSize(face.bounds, this.settings.expectedFaceRect(imageSize), imageSize)) {
                    this.fixTime = now
                    this.faceAlignmentStatus = FaceAlignmentStatus.FIXED
                } else if (this.fixTime && now - this.fixTime > this.settings.pauseDuration && this.faces.isFull) {
                    for (let i=0; i<this.faces.length; i++) {
                        const f: Face = this.faces.get(i)
                        if (!this.angleBearingEvaluation.angleMatchesBearing(f.angle, this.bearingIterator.value)) {
                            this.faceAlignmentStatus = FaceAlignmentStatus.MISALIGNED
                            capture.faceAlignmentStatus = this.faceAlignmentStatus
                            capture.offsetAngleFromBearing = this.angleBearingEvaluation.offsetFromAngleToBearing(capture.faceAngle ? capture.faceAngle : new Angle(), this.bearingIterator.value)
                            return capture
                        }
                    }
                    this.faces.clear()
                    this.faceAlignmentStatus = FaceAlignmentStatus.ALIGNED
                    this.fixTime = now
                    this.alignedFaceCount += 1
                    this.bearingIterator = this.bearingGenerator.next()
                }
            }
        } else {
            this.faces.clear()
            this.faceAlignmentStatus = FaceAlignmentStatus.FOUND
        }
        capture.faceAlignmentStatus = this.faceAlignmentStatus
        return capture
    }

    detectSpoofAttempt = (capture: LiveFaceCapture): LiveFaceCapture => {
        const face: Face = this.faceBuffer.lastElement
        if (!capture.isFacePresent || !face) {
            this.angleHistory = []
            return capture
        }
        if (capture.faceAlignmentStatus != FaceAlignmentStatus.ALIGNED) {
            this.angleHistory.push(face.angle)
            return capture
        }
        if (this.previousBearing != this.bearingIterator.value) {
            const previousAngle: Angle = this.angleBearingEvaluation.angleForBearing(this.previousBearing)
            const currentAngle: Angle = this.angleBearingEvaluation.angleForBearing(this.bearingIterator.value)
            const startYaw: number = Math.min(previousAngle.yaw, currentAngle.yaw)
            const endYaw: number = Math.max(previousAngle.yaw, currentAngle.yaw)
            const yawTolerance: number = this.angleBearingEvaluation.thresholdAngleToleranceForAxis(Axis.YAW)
            let movedTooFast: boolean = this.angleHistory.length > 1
            let movedOpposite: boolean = false
            for (let angle of this.angleHistory) {
                if (angle.yaw > startYaw - yawTolerance && angle.yaw < endYaw + yawTolerance) {
                    movedTooFast = false
                }
                if (!this.angleBearingEvaluation.isAngleBetweenBearings(angle, this.previousBearing, this.bearingIterator.value)) {
                    movedOpposite = true
                }
            }
            if (movedTooFast) {
                throw new Error("Moved too fast")
            }
            if (movedOpposite) {
                throw new Error("Moved opposite")
            }
        }
        this.angleHistory = []
        return capture
    }

    createFaceCapture = (capture: LiveFaceCapture): Observable<LiveFaceCapture> => {
        if (capture.requestedBearing == Bearing.STRAIGHT) {
            const bounds: Rect = capture.face ? capture.face.bounds : null
            return from(this.faceRecognition.detectRecognizableFace(capture.image, bounds).then(recognizableFace => {
                capture.face.template = recognizableFace.template
                return capture
            }))
        } else {
            return of(capture)
        }
    }

    resultFromCaptures = (captures: LiveFaceCapture[]): LivenessDetectionSessionResult => {
        return new LivenessDetectionSessionResult(new Date(this.startTime), captures)
    }

    close = () => {
        if (!this.closed) {
            this.closed = true
            setTimeout(() => {
                this.ui.trigger({"type":FaceCaptureEventType.CLOSE})
            })
        }
    }
}

/**
 * Result of a liveness detection session
 */
export class LivenessDetectionSessionResult {
    /**
     * Date that represents the time the session was started
     */
    readonly startTime: Date
    /**
     * Session duration in seconds
     */
    duration: number
    /**
     * Array of face captures collected during the session
     */
    readonly faceCaptures: Array<LiveFaceCapture>

    /**
     * Constructor
     * @param startTime Date that represents the time the session was started
     * @internal
     */
    constructor(startTime: Date, faceCaptures?: LiveFaceCapture[]) {
        this.startTime = startTime
        this.faceCaptures = faceCaptures ? faceCaptures : []
        this.duration = (new Date().getTime() - startTime.getTime())/1000
    }
}


/**
 * Extents of a face within a view
 * @remarks
 * Used by liveness detection session to determine the area where to show the face in relation to the containing view
 */
export class FaceExtents {
    /**
     * Proportion of view width, e.g., 0.65 is 65% of the view width
     */
    readonly proportionOfViewWidth: number
    /**
     * Proportion of view height, e.g., 0.85 is 85% of the view height
     */
    readonly proportionOfViewHeight: number
    /**
     * Constructor
     * @param proportionOfViewWidth Proportion of view width
     * @param proportionOfViewHeight Proportion of view height
     */
    constructor(proportionOfViewWidth: number, proportionOfViewHeight: number) {
        this.proportionOfViewWidth = proportionOfViewWidth
        this.proportionOfViewHeight = proportionOfViewHeight
    }
}

/**
 * Face capture settings
 */
export class FaceCaptureSettings {
    /**
     * Whether to use the device's front-facing (selfie) camera
     * @defaultValue `true`
     */
    useFrontCamera: boolean = true
    /**
     * How many face captures should be collected in a session
     * @defaultValue `2`
     */
    faceCaptureCount: number = 2
    /**
     * Maximum session duration (seconds)
     * @defaultValue `30`
     */
    maxDuration: number = 30
    /**
     * Horizontal (yaw) threshold where face is considered to be at an angle
     * 
     * For example, a value of 15 indicates that a face with yaw -15 and below is oriented left and a face with yaw 15 or above is oriented right
     * @defaultValue `20`
     */
    yawThreshold: number = 20
    /**
     * Vertical (pitch) threshold where face is considered to be at an angle
     *
     * For example, a value of 15 indicates that a face with pitch -15 and below is oriented up and a face with pitch 15 or above is oriented down
     * @defaultValue `15`
     */
    pitchThreshold: number = 15
    /**
     * Number of faces to collect per face capture
     * @defaultValue `2`
     */
    faceCaptureFaceCount: number = 2
    /**
     * When the face is fixed the face detection will pause to allow enough time for the user to read the on-screen instructions
     * 
     * Decreasing the pause time will shorten the session but may lead to a frustrating user experience if the user isn't allowed enough time to read the prompts
     * @defaultValue `0.5`
     */
    pauseDuration: number = 0.5
    /**
     * Where a face is expected in relation to the camera frame
     * @defaultValue `FaceExtents(0.65, 0.85)`
     */
    expectedFaceExtents: FaceExtents = new FaceExtents(0.65, 0.85)
    /**
     * Bearings the user may be asked to assume during the session
     * 
     * Note that the user will unlikely be asked to assume all the bearings in the set. The array is simply a pool from which the session will draw a random member.
     * @defaultValue `[Bearing.STRAIGHT, Bearing.LEFT, Bearing.RIGHT, Bearing.LEFT_UP, Bearing.RIGHT_UP]`
     */
    bearings = [Bearing.STRAIGHT, Bearing.LEFT, Bearing.RIGHT, Bearing.LEFT_UP, Bearing.RIGHT_UP]

    createUI: () => FaceCaptureUI = () => new VerIDFaceCaptureUI(this)

    expectedFaceRect = (imageSize: Size): Rect => {
        const faceRect = new Rect(0, 0, 0, 0)
        if (imageSize.width > imageSize.height) {
            faceRect.height = imageSize.height * this.expectedFaceExtents.proportionOfViewHeight
            faceRect.width = faceRect.height / 1.25
        } else {
            faceRect.width = imageSize.width * this.expectedFaceExtents.proportionOfViewWidth
            faceRect.height = faceRect.width * 1.25
        }
        faceRect.x = imageSize.width / 2 - faceRect.width / 2
        faceRect.y = imageSize.height / 2 - faceRect.height / 2
        return faceRect
    }
}

/**
 * Face detected in an image
 */
export class Face {
    /**
     * Bounds of the face
     */
    bounds: Rect
    /**
     * Angle of the face
     */
    angle: Angle
    /**
     * Face template (used for face recognition)
     */
    template?: string

    /**
     * Constructor
     * @param bounds Bounds
     * @param angle Angle
     * @internal
     */
    constructor(bounds: Rect, angle: Angle) {
        this.bounds = bounds
        this.angle = angle
    }
}

/**
 * Capture of a live face
 */
export class LiveFaceCapture {
    /**
     * Image in which the face was detected
     */
    readonly image: HTMLImageElement
    /**
     * Face or `null` if no face is detected in the image
     */
    readonly face: Face
    /**
     * Bearing requested at the time of capture
     */
    requestedBearing?: Bearing
    /**
     * Smoothed bounds of the face and of the faces captured previously in the session
     */
    faceBounds?: Rect
    /**
     * Smoothed angle of the face and of the faces captured previously in the session
     * @internal
     */
    faceAngle?: Angle
    /**
     * `true` if face is present
     * 
     * Indicates that the face has been present in a number of consecutive frames
     * @internal
     */
    isFacePresent?: boolean
    /**
     * Face alignment status at time of capture
     * @internal
     */
    faceAlignmentStatus?: FaceAlignmentStatus
    /**
     * Difference between the angle of the requested bearing and the angle of the detected face
     * @internal
     */
    offsetAngleFromBearing?: Angle

    private _faceImage?: HTMLImageElement = null
    /**
     * Image cropped to the bounds of the detected face
     */
    get faceImage(): Promise<HTMLImageElement> {
        if (this._faceImage) {
            return Promise.resolve(this._faceImage)
        }
        return new Promise((resolve, reject) => {
            const drawFaceImage = () => {
                this._faceImage = new Image()
                let canvas = document.createElement("canvas")
                canvas.width = this.face.bounds.width
                canvas.height = this.face.bounds.height
                let ctx = canvas.getContext("2d")
                ctx.drawImage(this.image, this.face.bounds.x, this.face.bounds.y, this.face.bounds.width, this.face.bounds.height, 0, 0, this.face.bounds.width, this.face.bounds.height)
                this._faceImage.src = canvas.toDataURL()
                resolve(this._faceImage)
            }
            if (this.image.complete) {
                drawFaceImage()
            } else {
                this.image.onload = drawFaceImage
                this.image.onerror = reject
            }
        })
    }

    /**
     * Constructor
     * @param image Image in which the face was detected
     * @param face Face or `null` if no face was detected in the image
     * @internal
     */
    constructor(image: HTMLImageElement, face: Face) {
        this.image = image
        this.face = face
    }
}