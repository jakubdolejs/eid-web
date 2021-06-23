/**
 * Ver-ID face detection
 * @packageDocumentation
 */

import { Observable, throwError, Subscription, Subscriber } from "rxjs"
import { map, filter, take, takeWhile, tap, mergeMap, toArray } from "rxjs/operators"
import { Angle, Rect, emitRxEvent } from "./utils"
import { FaceRecognition } from "./faceRecognition"
import { Size, Bearing, FaceRequirementListener, FaceAlignmentStatus, FaceCaptureCallback, ImageSource } from "./types"
import { LivenessDetectionSessionEventType, LivenessDetectionSessionUI, VerIDLivenessDetectionSessionUI } from "./faceDetectionUI"
import { LivenessDetectionSession } from "./livenessDetectionSession"
import { FaceDetector, FaceDetectorFactory, VerIDFaceDetectorFactory } from "./faceDetector"

/**
 * Face detection
 * @category Face detection
 */
export class FaceDetection {
    /**
     * Base URL of the server that accepts the face detection calls
     */
    public readonly serviceURL: string
    private readonly faceRecognition: FaceRecognition
    private readonly createFaceDetectorPromise: Promise<FaceDetector>

    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    public constructor(serviceURL?: string, faceDetectorFactory?: FaceDetectorFactory) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : ""
        this.faceRecognition = new FaceRecognition(this.serviceURL)
        if (!faceDetectorFactory) {
            faceDetectorFactory = new VerIDFaceDetectorFactory()
        }
        this.createFaceDetectorPromise = faceDetectorFactory.createFaceDetector()
    }

    public async detectFaceInImage(image: ImageSource): Promise<Face> {
        const faceDetector: FaceDetector = await this.createFaceDetectorPromise
        const faceCapture = await faceDetector.detectFace({element: image, mirrored: false})
        if (faceCapture.face) {
            return faceCapture.face
        } else {
            throw new Error("Face not found")
        }
    }

    /**
     * @returns `true` if liveness detection is supported by the client
     */
    public static isLivenessDetectionSupported(): boolean {
        return "Promise" in window && "fetch" in window
    }

    /**
     * Start a liveness detection session. Subscribe to the returned Observable to start the session and to receive results.
     * @param session Session to use for for liveness detection
     * @returns Observable
     */
    public captureFaces(session: LivenessDetectionSession): Observable<LivenessDetectionSessionResult> {
        try {
            this.checkLivenessSessionAvailability()
        } catch (error) {
            return throwError(() => error)
        }
        if (session.isClosed) {
            return throwError(() => new Error("Attempting to run a closed session"))
        }
        if (!session.faceRecognition) {
            session.faceRecognition = this.faceRecognition
        }
        let lastCaptureTime: number = null

        return <Observable<LivenessDetectionSessionResult>>(this.liveFaceCapture(session).pipe(
            map((capture: FaceCapture): FaceCapture => {
                capture.requestedBearing = session.requestedBearing
                return capture
            }),
            map(session.detectFacePresence),
            map(session.detectFaceAlignment),
            map(session.detectSpoofAttempt),
            tap((capture: FaceCapture) => {
                if (capture.face && session.controlFaceCaptures.length < session.settings.maxControlFaceCount) {
                    const now = new Date().getTime()
                    if (lastCaptureTime == null && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED) {
                        lastCaptureTime = now
                    } else if (lastCaptureTime != null && capture.faceAlignmentStatus != FaceAlignmentStatus.ALIGNED && now - lastCaptureTime >= session.settings.controlFaceCaptureInterval) {
                        lastCaptureTime = now
                        session.controlFaceCaptures.push(capture)
                    }
                }
                session.ui.trigger({"type": LivenessDetectionSessionEventType.FACE_CAPTURED, "capture": capture})
                if (session.faceDetectionCallback) {
                    session.faceDetectionCallback(capture)
                }
            }),
            filter((capture: FaceCapture) => {
                return capture.face && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED
            }),
            mergeMap(session.createFaceCapture),
            tap((faceCapture: FaceCapture) => {
                if (session.faceCaptureCallback) {
                    session.faceCaptureCallback(faceCapture)
                }
            }),
            take(session.settings.faceCaptureCount),
            takeWhile(() => {
                return new Date().getTime() < session.startTime + session.settings.maxDuration * 1000
            }),
            toArray(),
            tap(() => {
                session.ui.trigger({"type":LivenessDetectionSessionEventType.CAPTURE_FINISHED})
            }),
            mergeMap(session.resultFromCaptures),
            map((result: LivenessDetectionSessionResult) => {
                if (result.faceCaptures.length < session.settings.faceCaptureCount) {
                    throw new Error("Session timed out")
                }
                return result
            }),
            (observable: Observable<LivenessDetectionSessionResult>) => this.livenessDetectionSessionResultObservable(observable, session)
        ))
    }

    /**
     * Create a liveness detection session. Subscribe to the returned Observable to start the session and to receive results.
     * @param settings Session settings
     * @param faceDetectionCallback Optional callback to invoke each time a frame is ran by face detection
     * @param faceCaptureCallback Optional callback to invoke when a face aligned to the requested bearing is captured
     * @deprecated Use {@linkcode captureFaces}
     * @hidden
     */
    public livenessDetectionSession(settings?: LivenessDetectionSessionSettings, faceDetectionCallback?: FaceCaptureCallback, faceCaptureCallback?: FaceCaptureCallback, faceRequirementListener?: FaceRequirementListener): Observable<LivenessDetectionSessionResult> {
        const session = new LivenessDetectionSession(settings, this.faceRecognition)
        session.faceDetectionCallback = faceDetectionCallback
        session.faceCaptureCallback = faceCaptureCallback
        if (faceRequirementListener) {
            session.registerFaceRequirementListener(faceRequirementListener)
        }
        return this.captureFaces(session)
    }

    private onVideoPlay(session: LivenessDetectionSession, subscriber: Subscriber<FaceCapture>): () => void {
        return async () => {
            const detectFaceAfterInterval = (interval: number): Promise<FaceCapture> => {
                return new Promise((resolve, reject) => {
                    setTimeout(async () => {
                        try {
                            resolve(await session.faceDetector.detectFace({element: session.ui.video, mirrored: session.settings.useFrontCamera}))
                        } catch (error) {
                            reject(error)
                        }
                    }, interval)
                })
            }

            async function* detectSingleFace() {
                while (!subscriber.closed && !session.ui.video.paused && !session.ui.video.ended) {
                    yield await detectFaceAfterInterval(0)
                }
            }

            try {
                for await (let faceCapture of detectSingleFace()) {
                    if (subscriber.closed) {
                        break
                    }
                    emitRxEvent(subscriber, {"type": "next", "value": faceCapture})
                }
            } catch (error) {
                if (!subscriber.closed) {
                    emitRxEvent(subscriber, {"type": "error", "error": error})
                }
            }
        }
    }

    private liveFaceCapture(session: LivenessDetectionSession): Observable<FaceCapture> {
        return new Observable<FaceCapture>(subscriber => {
            this.createFaceDetectorPromise.then(faceDetector => {
                session.faceDetector = faceDetector
                session.ui.video.onplay = this.onVideoPlay(session, subscriber)
                return session.setupVideo()
            }).catch((error) => {
                emitRxEvent(subscriber, {"type": "error", "error": error})
            })
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

    private livenessDetectionSessionResultObservable = (observable: Observable<LivenessDetectionSessionResult>, session: LivenessDetectionSession): Observable<LivenessDetectionSessionResult> => {
        return new Observable<LivenessDetectionSessionResult>(subscriber => {
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
            session.ui.on(LivenessDetectionSessionEventType.CANCEL, () => {
                emitRxEvent(subscriber, {"type": "complete"})
            })
            return () => {
                subcription.unsubscribe()
                session.close()
            }
        })
    }
}

/**
 * Result of a liveness detection session
 * @category Face detection
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
    readonly faceCaptures: Array<FaceCapture>

    readonly videoURL: string

    /**
     * Constructor
     * @param startTime Date that represents the time the session was started
     * @internal
     */
    constructor(startTime: Date, faceCaptures?: FaceCapture[], videoURL?: string) {
        this.startTime = startTime
        this.faceCaptures = faceCaptures ? faceCaptures : []
        this.duration = (new Date().getTime() - startTime.getTime())/1000
        this.videoURL = videoURL
    }
}


/**
 * Extents of a face within a view
 * @remarks
 * Used by liveness detection session to determine the area where to show the face in relation to the containing view
 * @category Face detection
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
 * Liveness detection session settings
 * @category Face detection
 */
export class LivenessDetectionSessionSettings {
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
     * @defaultValue `28`
     */
    yawThreshold: number = 28
    /**
     * Vertical (pitch) threshold where face is considered to be at an angle
     *
     * For example, a value of 15 indicates that a face with pitch -15 and below is oriented up and a face with pitch 15 or above is oriented down
     * @defaultValue `12`
     */
    pitchThreshold: number = 12
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

    /**
     * Set to `true` to record a video of the session
     * 
     * Note that some older browsers may not be capable of recording video
     * @defaultValue `false`
     */
    recordSessionVideo: boolean = false

    /**
     * Background: Once the initial aligned face is detected the session will start capturing "control" faces at interval set in the `controlFaceCaptureInterval` property until `maxControlFaceCount` faces are collected or the session finishes. 
     * These control faces are then compared to the aligned face to ensure that the person performing the liveness detection is the same person as the one on the aligned face.
     * This prevents attacks where a picture is presented to the camera and a live person finishes the liveness detection.
     * @defaultValue `4.5`
     */
    controlFaceSimilarityThreshold: number = 4.5

    /**
     * Interval at which to capture "control" faces. 
     * See `controlFaceSimilarityThreshold` for an explanation.
     * @defaultValue `500`
     */
    controlFaceCaptureInterval: number = 500

    /**
     * Number of "control" faces to capture during a session.
     * See `controlFaceSimilarityThreshold` for an explanation.
     * @defaultValue `4`
     */
    maxControlFaceCount: number = 4

    /**
     * Set your own function if you wish to supply your own graphical user interface for the session.
     * @returns Function that supplies an instance of `FaceCaptureUI`
     */
    createUI: () => LivenessDetectionSessionUI = () => new VerIDLivenessDetectionSessionUI(this)

    /**
     * @param imageSize Image size
     * @returns Boundary of where the session expects a face in a given image size.
     */
    readonly expectedFaceRect = (imageSize: Size): Rect => {
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
 * @category Face detection
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
 * @category Face detection
 */
export class FaceCapture {
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
     * Face alignment status at time of capture
     * @internal
     */
    faceAlignmentStatus?: FaceAlignmentStatus
    /**
     * Difference between the angle of the requested bearing and the angle of the detected face
     * @internal
     */
    offsetAngleFromBearing?: Angle

    /**
     * Number between 0 and 1 representing the trajectory to the requested bearing angle. 
     * `1` means the face is moving straight towards the requested bearing. 
     * `0` means the face is moving in the opposite direction than the requested bearing.
     */
    angleTrajectory: number

    angleDistance: number = 0

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