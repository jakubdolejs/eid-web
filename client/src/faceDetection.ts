/**
 * Ver-ID face detection
 * @packageDocumentation
 */

import { Observable, from, of, throwError, Subscription, Subscriber } from "rxjs"
import { map, filter, take, takeWhile, tap, mergeMap, toArray } from "rxjs/operators"
import { CircularBuffer, AngleBearingEvaluation, Angle, Rect, RectSmoothing, AngleSmoothing, Point } from "./utils"
import { FaceRecognition } from "./faceRecognition"
import * as faceapi from "face-api.js/build/es6"
import { estimateFaceAngle } from "./faceAngle"
import { estimateFaceAngle as estimateFaceAngleNoseTip } from "./faceAngleNoseTip"
import { Axis, Size, Bearing, FaceAlignmentStatus } from "./types"


type ObservableNextEvent<T> = {
    type: "next",
    value: T
}

type ObservableErrorEvent = {
    type: "error",
    error: any
}

type ObservableCompleteEvent = {
    type: "complete"
}

type ObservableEvent<T> = ObservableNextEvent<T> | ObservableErrorEvent | ObservableCompleteEvent
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

    private emitEvent<T>(subscriber: Subscriber<T>, event: ObservableEvent<T>): void {
        setTimeout(() => {
            if (subscriber.closed) {
                return
            }
            if (event.type == "next") {
                subscriber.next(event.value)
            } else if (event.type == "error") {
                subscriber.error(event.error)
            } else if (event.type == "complete") {
                subscriber.complete()
            }
        }, 0)
    }

    /**
     * Create a liveness detection session. Subscribe to the returned Observable to start the session and to receive results.
     * @param settings Session settings
     * @param faceDetectionCallback Optional callback to invoke each time a frame is ran by face detection
     * @param faceCaptureCallback Optional callback to invoke when a face aligned to the requested bearing is captured
     */
    livenessDetectionSession(settings?: FaceCaptureSettings, faceDetectionCallback?: (faceDetectionResult: LiveFaceCapture) => void, faceCaptureCallback?: (faceCapture: LiveFaceCapture) => void): Observable<LivenessDetectionSessionResult> {
        const faceDetection = this
        if (location.protocol != "https:") {
            return throwError(() => new Error("Liveness detection is only supported on secure connections (https)"))
        }

        if (!FaceDetection.isLivenessDetectionSupported()) {
            return throwError(() => new Error("Liveness detection is not supported by your browser"))
        }

        if (!settings) {
            settings = new FaceCaptureSettings()
        }

        function isFaceFixedInImageSize(actualFaceBounds: Rect, expectedFaceBounds: Rect): boolean {
            return true
            // const maxRect: Rect = new Rect(expectedFaceBounds.x, expectedFaceBounds.y, expectedFaceBounds.width, expectedFaceBounds.height)
            // maxRect.inset(0-expectedFaceBounds.width*0.3, 0-expectedFaceBounds.height*0.3)
            // const minRect: Rect = new Rect(expectedFaceBounds.x, expectedFaceBounds.y, expectedFaceBounds.width, expectedFaceBounds.height)
            // minRect.inset(expectedFaceBounds.width * 0.4, expectedFaceBounds.height * 0.4)
            // return actualFaceBounds.contains(minRect) && maxRect.contains(actualFaceBounds)
        }

        const cameraOverlayCanvas: HTMLCanvasElement = document.createElement("canvas")
        cameraOverlayCanvas.style.position = "absolute"
        cameraOverlayCanvas.style.left = "0px"
        cameraOverlayCanvas.style.top = "0px"
        const cameraOverlayContext: CanvasRenderingContext2D = cameraOverlayCanvas.getContext("2d")

        const videoContainer: HTMLDivElement = document.createElement("div")
        videoContainer.style.position = "fixed"
        videoContainer.style.left = "0px"
        videoContainer.style.top = "0px"
        videoContainer.style.right = "0px"
        videoContainer.style.bottom = "0px"
        videoContainer.style.backgroundColor = "black"
        document.body.appendChild(videoContainer)

        const video: HTMLVideoElement = document.createElement("video")
        video.setAttribute("autoplay", "autoplay")
        video.setAttribute("muted", "muted")
        video.setAttribute("playsinline", "playsinline")
        video.style.position = "absolute"
        video.style.left = "0px"
        video.style.top = "0px"
        video.style.right = "0px"
        video.style.bottom = "0px"
        video.style.width = "100%"
        video.style.height = "100%"

        const cancelButton: HTMLAnchorElement = document.createElement("a")
        cancelButton.href = "javascript:void(0)"
        cancelButton.innerText = "Cancel"
        cancelButton.style.textShadow = "0px 1px 5px rgba(0, 0, 0, 0.5)"
        cancelButton.style.fontFamily = "Helvetica, Arial, sans-serif"
        cancelButton.style.color = "white"
        cancelButton.style.textDecoration = "none"
        cancelButton.style.position = "absolute"
        cancelButton.style.bottom = " 16px"
        cancelButton.style.left = "8px"
        cancelButton.style.right = "8px"
        cancelButton.style.textAlign = "center"
        
        videoContainer.appendChild(video)
        videoContainer.appendChild(cameraOverlayCanvas)
        videoContainer.appendChild(cancelButton)

        let previousBearing: Bearing = Bearing.STRAIGHT

        function* nextCaptureBearing(): Generator {
            let lastBearing: Bearing = Bearing.STRAIGHT
            yield lastBearing
            for (let i=1; i<settings.faceCaptureCount; i++) {
                previousBearing = lastBearing
                let availableBearings = settings.bearings.filter(bearing => bearing != lastBearing && angleBearingEvaluation.angleForBearing(bearing).yaw != angleBearingEvaluation.angleForBearing(lastBearing).yaw)
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

        const drawDetectedFace = (capture: LiveFaceCapture): void => {
            const scale = Math.min(videoContainer.clientWidth / capture.image.width, videoContainer.clientHeight / capture.image.height)
            cameraOverlayCanvas.width = capture.image.width * scale
            cameraOverlayCanvas.height = capture.image.height * scale
            cameraOverlayCanvas.style.left = ((videoContainer.clientWidth - cameraOverlayCanvas.width) / 2)+"px"
            cameraOverlayCanvas.style.top = ((videoContainer.clientHeight - cameraOverlayCanvas.height) / 2)+"px"
            cameraOverlayContext.clearRect(0, 0, cameraOverlayCanvas.width, cameraOverlayCanvas.height)
            let ovalColor: string
            let textColor: string
            if (capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED || capture.faceAlignmentStatus == FaceAlignmentStatus.FIXED) {
                ovalColor = "green"
                textColor = "white"
            } else {
                ovalColor = "white"
                textColor = "black"
            }
            cameraOverlayContext.strokeStyle = ovalColor
            cameraOverlayContext.lineCap = "round"
            cameraOverlayContext.lineJoin = "round"
            let faceRect: Rect
            if (capture.faceBounds) {
                faceRect = capture.faceBounds.scaledBy(scale)
                if (settings.useFrontCamera) {
                    faceRect = faceRect.mirrored(capture.image.width * scale)
                }
                cameraOverlayContext.lineWidth = 0.038 * faceRect.width
                cameraOverlayContext.beginPath()
                cameraOverlayContext.ellipse(faceRect.x + faceRect.width / 2, faceRect.y + faceRect.height / 2, faceRect.width /2, faceRect.height / 2, 0, 0, Math.PI * 2)
                if (capture.offsetAngleFromBearing) {
                    const angle: number = Math.atan2(capture.offsetAngleFromBearing.pitch, capture.offsetAngleFromBearing.yaw)
                    const distance: number = Math.hypot(capture.offsetAngleFromBearing.yaw, 0 - capture.offsetAngleFromBearing.pitch) * 2 * 1.7
                    const arrowLength: number = faceRect.width / 5
                    const arrowStemLength: number = Math.min(Math.max(arrowLength * distance, arrowLength * 0.75), arrowLength * 1.7)
                    const arrowAngle: number = 40 * (Math.PI/180)
                    const arrowTipX: number = faceRect.center.x + Math.cos(angle) * arrowLength / 2
                    const arrowTipY: number = faceRect.center.y + Math.sin(angle) * arrowLength / 2
                    const arrowPoint1X: number = arrowTipX + Math.cos(angle + Math.PI - arrowAngle) * arrowLength * 0.6
                    const arrowPoint1Y: number = arrowTipY + Math.sin(angle + Math.PI - arrowAngle) * arrowLength * 0.6
                    const arrowPoint2X: number = arrowTipX + Math.cos(angle + Math.PI + arrowAngle) * arrowLength * 0.6
                    const arrowPoint2Y: number = arrowTipY + Math.sin(angle + Math.PI + arrowAngle) * arrowLength * 0.6
                    const arrowStartX: number = arrowTipX + Math.cos(angle + Math.PI) * arrowStemLength
                    const arrowStartY: number = arrowTipY + Math.sin(angle + Math.PI) * arrowStemLength

                    cameraOverlayContext.moveTo(arrowPoint1X, arrowPoint1Y)
                    cameraOverlayContext.lineTo(arrowTipX, arrowTipY)
                    cameraOverlayContext.lineTo(arrowPoint2X, arrowPoint2Y)
                    cameraOverlayContext.moveTo(arrowTipX, arrowTipY)
                    cameraOverlayContext.lineTo(arrowStartX, arrowStartY)
                }
                cameraOverlayContext.stroke()
            } else {
                faceRect = new Rect(0, 0, 0, 0)
                if (cameraOverlayCanvas.width > cameraOverlayCanvas.height) {
                    faceRect.height = cameraOverlayCanvas.height * settings.expectedFaceExtents.proportionOfViewHeight
                    faceRect.width = faceRect.height / 1.25
                } else {
                    faceRect.width = cameraOverlayCanvas.width * settings.expectedFaceExtents.proportionOfViewWidth
                    faceRect.height = faceRect.width * 1.25
                }
                faceRect.x = cameraOverlayCanvas.width / 2 - faceRect.width / 2
                faceRect.y = cameraOverlayCanvas.height / 2 - faceRect.height / 2
                cameraOverlayContext.lineWidth = 0.038 * faceRect.width
                cameraOverlayContext.beginPath()
                cameraOverlayContext.ellipse(faceRect.x + faceRect.width / 2, faceRect.y + faceRect.height / 2, faceRect.width /2, faceRect.height / 2, 0, 0, Math.PI * 2)
                cameraOverlayContext.stroke()
            }
            let prompt: string
            switch (capture.faceAlignmentStatus) {
                case FaceAlignmentStatus.FIXED:
                case FaceAlignmentStatus.ALIGNED:
                    prompt = "Great, hold it"
                    break
                case FaceAlignmentStatus.MISALIGNED:
                    prompt = "Slowly turn to follow the arrow"
                    break
                default:
                    prompt = "Align your face with the oval"
            }
            const textSize: number = 24
            const textY: number = Math.max(faceRect.y - cameraOverlayContext.lineWidth * 2, textSize)
            cameraOverlayContext.font = textSize+"px Helvetica, Arial, sans-serif"
            cameraOverlayContext.textAlign = "center"
            const textWidth: number = cameraOverlayContext.measureText(prompt).width
            const cornerRadius: number = 8
            const textRect: Rect = new Rect(
                cameraOverlayCanvas.width / 2 - textWidth / 2 - cornerRadius,
                textY - textSize,
                textWidth + cornerRadius * 2,
                textSize + cornerRadius
            )
            cameraOverlayContext.beginPath()
            cameraOverlayContext.moveTo(textRect.x + cornerRadius, textRect.y)
            cameraOverlayContext.lineTo(textRect.x + textRect.width - cornerRadius, textRect.y)
            cameraOverlayContext.quadraticCurveTo(textRect.x + textRect.width, textRect.y, textRect.x + textRect.width, textRect.y + cornerRadius)
            cameraOverlayContext.lineTo(textRect.x + textRect.width, textRect.y + textRect.height - cornerRadius)
            cameraOverlayContext.quadraticCurveTo(textRect.x + textRect.width, textRect.y + textRect.height, textRect.x + textRect.width - cornerRadius, textRect.y + textRect.height)
            cameraOverlayContext.lineTo(textRect.x + cornerRadius, textRect.y + textRect.height)
            cameraOverlayContext.quadraticCurveTo(textRect.x, textRect.y + textRect.height, textRect.x, textRect.y + textRect.height - cornerRadius)
            cameraOverlayContext.lineTo(textRect.x, textRect.y + cornerRadius)
            cameraOverlayContext.quadraticCurveTo(textRect.x, textRect.y, textRect.x + cornerRadius, textRect.y)
            cameraOverlayContext.closePath()
            cameraOverlayContext.fillStyle = ovalColor
            cameraOverlayContext.fill()
            cameraOverlayContext.fillStyle = textColor
            cameraOverlayContext.fillText(prompt, cameraOverlayCanvas.width / 2, textY)
        }

        const detectFacePresence = (capture: LiveFaceCapture): LiveFaceCapture => {
            if (capture.face) {
                faceBuffer.enqueue(capture.face)
                faceBoundsSmoothing.addSample(capture.face.bounds)
                faceAngleSmoothing.addSample(capture.face.angle)
                if (faceBuffer.isFull) {
                    faceDetected = true
                }
            } else if (alignedFaceCount >= settings.faceCaptureFaceCount) {
                faceDetected = false
            } else {
                faceBuffer.dequeue()
                if (faceDetected && faceBuffer.isEmpty) {
                    throw new Error("Face lost")
                }
                faceDetected = false
                faceBoundsSmoothing.removeFirstSample()
                faceAngleSmoothing.removeFirstSample()
                const lastFace: Face = faceBuffer.lastElement
                if (lastFace != null) {
                    const requestedAngle: number = angleBearingEvaluation.angleForBearing(bearingIterator.value).screenAngle
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
            capture.faceBounds = faceBoundsSmoothing.smoothedValue
            capture.faceAngle = faceAngleSmoothing.smoothedValue
            capture.isFacePresent = faceDetected
            return capture
        }

        const detectFaceAlignment = (capture: LiveFaceCapture): LiveFaceCapture => {
            if (capture.isFacePresent) {
                const face: Face = faceBuffer.lastElement
                if (face != null) {
                    const now: number = new Date().getTime()/1000
                    if (faceAlignmentStatus == FaceAlignmentStatus.ALIGNED) {
                        faceAlignmentStatus = FaceAlignmentStatus.FIXED
                        fixTime = now
                    }
                    faces.enqueue(face)
                    if (faceAlignmentStatus == FaceAlignmentStatus.FOUND && isFaceFixedInImageSize(face.bounds, new Rect(0, 0, capture.image.width, capture.image.height))) {
                        fixTime = now
                        faceAlignmentStatus = FaceAlignmentStatus.FIXED
                    } else if (fixTime && now - fixTime > settings.pauseDuration && faces.isFull) {
                        for (let i=0; i<faces.length; i++) {
                            const f: Face = faces.get(i)
                            if (!angleBearingEvaluation.angleMatchesBearing(f.angle, bearingIterator.value)) {
                                faceAlignmentStatus = FaceAlignmentStatus.MISALIGNED
                                capture.faceAlignmentStatus = faceAlignmentStatus
                                capture.offsetAngleFromBearing = angleBearingEvaluation.offsetFromAngleToBearing(capture.faceAngle ? capture.faceAngle : new Angle(), bearingIterator.value)
                                return capture
                            }
                        }
                        faces.clear()
                        faceAlignmentStatus = FaceAlignmentStatus.ALIGNED
                        fixTime = now
                        alignedFaceCount += 1
                        bearingIterator = bearingGenerator.next()
                    }
                }
            } else {
                faces.clear()
                faceAlignmentStatus = FaceAlignmentStatus.FOUND
            }
            capture.faceAlignmentStatus = faceAlignmentStatus
            return capture
        }

        const detectSpoofAttempt = (capture: LiveFaceCapture): LiveFaceCapture => {
            const face: Face = faceBuffer.lastElement
            if (!capture.isFacePresent || !face) {
                angleHistory = []
                return capture
            }
            if (capture.faceAlignmentStatus != FaceAlignmentStatus.ALIGNED) {
                angleHistory.push(face.angle)
                return capture
            }
            if (previousBearing != bearingIterator.value) {
                const previousAngle: Angle = angleBearingEvaluation.angleForBearing(previousBearing)
                const currentAngle: Angle = angleBearingEvaluation.angleForBearing(bearingIterator.value)
                const startYaw: number = Math.min(previousAngle.yaw, currentAngle.yaw)
                const endYaw: number = Math.max(previousAngle.yaw, currentAngle.yaw)
                const yawTolerance: number = angleBearingEvaluation.thresholdAngleToleranceForAxis(Axis.YAW)
                let movedTooFast: boolean = angleHistory.length > 1
                let movedOpposite: boolean = false
                for (let angle of angleHistory) {
                    if (angle.yaw > startYaw - yawTolerance && angle.yaw < endYaw + yawTolerance) {
                        movedTooFast = false
                    }
                    if (!angleBearingEvaluation.isAngleBetweenBearings(angle, previousBearing, bearingIterator.value)) {
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
            angleHistory = []
            return capture
        }

        const createFaceCapture = (capture: LiveFaceCapture): Observable<LiveFaceCapture> => {
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

        const resultFromCaptures = (captures: LiveFaceCapture[]): LivenessDetectionSessionResult => {
            return new LivenessDetectionSessionResult(new Date(startTime), captures)
        }

        const faceBuffer: CircularBuffer<Face> = new CircularBuffer<Face>(3)
        const faces: CircularBuffer<Face> = new CircularBuffer<Face>(settings.faceCaptureFaceCount)
        let faceDetected: boolean = false
        let faceAlignmentStatus: FaceAlignmentStatus = FaceAlignmentStatus.FOUND
        let fixTime: number = null
        let alignedFaceCount: number = 0
        let angleHistory: Angle[] = []
        const startTime: number = new Date().getTime()
        const angleBearingEvaluation: AngleBearingEvaluation = new AngleBearingEvaluation(settings, 5, 5)
        const faceBoundsSmoothing: RectSmoothing = new RectSmoothing(3)
        const faceAngleSmoothing: AngleSmoothing = new AngleSmoothing(3)

        function liveFaceCapture(): Observable<LiveFaceCapture> {
            return new Observable<LiveFaceCapture>(subscriber => {
                if (!navigator.mediaDevices) {
                    faceDetection.emitEvent(subscriber, {"type": "error", "error": new Error("Unsupported browser")})
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
                        "facingMode": settings.useFrontCamera ? "user" : "environment"
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
                Promise.all(faceDetection.loadPromises).then(() => {
                    return navigator.mediaDevices.getUserMedia(getUserMediaOptions)
                }).then((stream: MediaStream) => {
                    videoTrack = stream.getVideoTracks()[0];
                    if (settings.useFrontCamera) {
                        video.style.transform = "scaleX(-1)"
                    }
                    if ("srcObject" in video) {
                        video.srcObject = stream;
                    } else {
                        // @ts-ignore
                        video.src = URL.createObjectURL(stream);
                    }
                    video.onplay = () => {
                        const canvas: HTMLCanvasElement = document.createElement("canvas")
                        canvas.width = video.videoWidth
                        canvas.height = video.videoHeight
                        const ctx: CanvasRenderingContext2D = canvas.getContext("2d")
                        
                        const detectSingleFace: () => void = async () => {
                            try {
                                const _face = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({"inputSize": 128})).withFaceLandmarks()
                                let face: Face
                                if (_face) {
                                    face = faceDetection.faceApiFaceToVerIDFace(_face, canvas.width, settings.useFrontCamera)
                                }
                                if (!subscriber.closed) {
                                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                                    const image: HTMLImageElement = new Image()
                                    image.width = canvas.width
                                    image.height = canvas.height
                                    image.src = canvas.toDataURL()
                                    faceDetection.emitEvent(subscriber, {"type": "next", "value": new LiveFaceCapture(image, face)})
                                }
                                setTimeout(detectSingleFace, 0)
                            } catch (error) {
                                faceDetection.emitEvent(subscriber, {"type": "error", "error": error})
                            }
                        }
                        setTimeout(detectSingleFace, 0)
                    }
                }).catch((error) => {
                    faceDetection.emitEvent(subscriber, {"type": "error", "error": error})
                })
                return () => {
                    if (videoTrack) {
                        videoTrack.stop()
                        videoTrack = null
                    }
                }
            })
        }
        let bearingGenerator: Generator = nextCaptureBearing()
        let bearingIterator = bearingGenerator.next()
        return <Observable<LivenessDetectionSessionResult>>(liveFaceCapture().pipe(
            map((capture: LiveFaceCapture): LiveFaceCapture => {
                capture.requestedBearing = bearingIterator.value
                return capture
            }),
            map(detectFacePresence),
            map(detectFaceAlignment),
            tap(drawDetectedFace),
            tap((capture: LiveFaceCapture) => {
                if (faceDetectionCallback) {
                    faceDetectionCallback(capture)
                }
            }),
            filter((capture: LiveFaceCapture) => {
                return capture.face && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED
            }),
            mergeMap(createFaceCapture),
            tap((faceCapture: LiveFaceCapture) => {
                if (faceCaptureCallback) {
                    faceCaptureCallback(faceCapture)
                }
            }),
            take(settings.faceCaptureCount),
            takeWhile(() => {
                return new Date().getTime() < startTime + settings.maxDuration * 1000
            }),
            toArray(),
            map(resultFromCaptures),
            map((result: LivenessDetectionSessionResult) => {
                if (result.faceCaptures.length < settings.faceCaptureCount) {
                    throw new Error("Session timed out")
                }
                return result
            }),
            (observable: Observable<LivenessDetectionSessionResult>) => new Observable<LivenessDetectionSessionResult>(subscriber => {
                const subcription: Subscription = observable.subscribe({
                    next: (val: LivenessDetectionSessionResult) => {
                        faceDetection.emitEvent(subscriber, {"type": "next", "value": val})
                    },
                    error: (err: any) => {
                        faceDetection.emitEvent(subscriber, {"type": "error", "error": err})
                    },
                    complete: () => {
                        faceDetection.emitEvent(subscriber, {"type": "complete"})
                    }
                })
                cancelButton.onclick = () => {
                    faceDetection.emitEvent(subscriber, {"type": "complete"})
                }
                return () => {
                    subcription.unsubscribe()
                    if (videoContainer.parentNode) {
                        videoContainer.parentNode.removeChild(videoContainer)
                    }
                }
            })
        ))
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