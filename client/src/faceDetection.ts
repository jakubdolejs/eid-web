'use strict';
/**
 * Ver-ID face detection
 * @packageDocumentation
 */

import { Observable, throwError, Subscription, Subscriber } from "rxjs"
import { map, filter, take, tap, mergeMap, toArray } from "rxjs/operators"
import { emitRxEvent } from "./utils"
import { FaceRecognition } from "./faceRecognition"
import { FaceRequirementListener, FaceAlignmentStatus, FaceCaptureCallback, ImageSource } from "./types"
import { LivenessDetectionSessionEventType } from "./faceDetectionUI"
import { LivenessDetectionSession } from "./livenessDetectionSession"
import { FaceDetector, FaceDetectorFactory, VerIDFaceDetectorFactory } from "./faceDetector"
import { LivenessDetectionSessionSettings } from "./livenessDetectionSession";
import { FaceCapture } from "./types";
import { Face } from "./types";

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
            session.close()
            return throwError(() => error)
        }
        if (session.isClosed) {
            return throwError(() => new Error("Attempting to run a closed session"))
        }
        if (!session.faceRecognition) {
            session.faceRecognition = this.faceRecognition
        }

        return <Observable<LivenessDetectionSessionResult>>(this.liveFaceCapture(session).pipe(
            map((capture: FaceCapture): FaceCapture => {
                capture.requestedBearing = session.requestedBearing
                return capture
            }),
            map(session.detectFacePresence),
            map(session.detectFaceAlignment),
            //map(session.detectSpoofAttempt),
            tap((capture: FaceCapture) => {
                this.onFaceCapture(session, capture)
            }),
            filter((capture: FaceCapture, index: number) => {
                return capture.face != null && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED
            }),
            mergeMap(session.createFaceCapture),
            tap((faceCapture: FaceCapture) => {
                Promise.resolve().then(() => {
                    if (session.faceCaptureCallback) {
                        session.faceCaptureCallback(faceCapture)
                    }
                })
                if (new Date().getTime() - session.startTime > session.settings.maxDuration * 1000) {
                    throw new Error("Session timed out")
                }
            }),
            take(session.settings.faceCaptureCount),
            toArray(),
            tap(() => {
                Promise.resolve().then(() => {
                    session.ui.trigger({"type":LivenessDetectionSessionEventType.CAPTURE_FINISHED})
                })
            }),
            mergeMap(session.resultFromCaptures),
            mergeMap(session.checkLiveness),
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

    private onFaceCapture = (session: LivenessDetectionSession, capture: FaceCapture): void => {
        if (capture.face) {
            const now = new Date().getTime()
            if (session.lastCaptureTime == null && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED) {
                session.lastCaptureTime = now
            } else if (session.lastCaptureTime != null && (capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED || now - session.lastCaptureTime >= session.settings.controlFaceCaptureInterval)) {
                session.lastCaptureTime = now
                session.controlFaceCaptures.push(capture)
                if (session.controlFaceCaptures.length > session.settings.maxControlFaceCount) {
                    session.controlFaceCaptures.shift()
                }
            }
        }
        Promise.resolve().then(() => {
            session.ui.trigger({"type": LivenessDetectionSessionEventType.FACE_CAPTURED, "capture": capture})
            if (session.faceDetectionCallback) {
                session.faceDetectionCallback(capture)
            }
        })
    }

    private onVideoPlay(session: LivenessDetectionSession, subscriber: Subscriber<FaceCapture>): () => void {
        return async () => {
            session.ui.trigger({"type": LivenessDetectionSessionEventType.LOADED})
            let frameCount = 0
            let fps: number | null = null
            const detectFace = async (): Promise<FaceCapture> => {
                const startTime = new Date().getTime()
                const faceCapture = await session.faceDetector.detectFace({element: session.ui.video, mirrored: session.settings.useFrontCamera})
                if (frameCount > 2 && frameCount < 10) {
                    const detectionDuration = new Date().getTime() - startTime
                    const currentFPS = 1000 / detectionDuration
                    if (fps === null) {
                        fps = currentFPS
                    } else {
                        fps += currentFPS
                        fps /= 2
                    }
                    if (fps < session.settings.minFPS) {
                        throw new Error("Device too slow: "+fps.toFixed(1)+" FPS (required "+session.settings.minFPS+" FPS)")
                    }
                } else {
                    fps = null
                }
                frameCount ++
                return faceCapture
            }

            async function* detectSingleFace() {
                while (!subscriber.closed && !session.ui.video.paused && !session.ui.video.ended) {
                    yield await detectFace()
                }
            }

            try {
                for await (const faceCapture of detectSingleFace()) {
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
        return new Observable<FaceCapture>((subscriber: Subscriber<FaceCapture>) => {
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
        return new Observable<LivenessDetectionSessionResult>((subscriber: Subscriber<LivenessDetectionSessionResult>) => {
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

    readonly videoURL: string|undefined

    livenessScore?: number

    /**
     * Constructor
     * @param startTime Date that represents the time the session was started
     * @internal
     */
    constructor(startTime: Date, faceCaptures?: FaceCapture[], videoURL?: string | undefined) {
        this.startTime = startTime
        this.faceCaptures = faceCaptures ? faceCaptures : []
        this.duration = (new Date().getTime() - startTime.getTime())/1000
        this.videoURL = videoURL
    }
}



