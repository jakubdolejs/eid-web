// @ts-ignore
import { Observable } from "https://dev.jspm.io/rxjs@6/_esm2015"
// @ts-ignore
import { map, filter, take, takeWhile, reduce, tap, mergeMap } from "https://dev.jspm.io/rxjs@6/_esm2015/operators"
import { CircularBuffer, AngleBearingEvaluation, Angle, Rect, Axis, RectSmoothing, AngleSmoothing } from "./utils.js"

export enum FaceAlignmentStatus {
    FOUND,
    FIXED,
    ALIGNED,
    MISALIGNED
}

export enum Bearing {
    STRAIGHT,
    LEFT,
    RIGHT,
    UP,
    DOWN,
    LEFT_UP,
    RIGHT_UP,
    LEFT_DOWN,
    RIGHT_DOWN
}

export function isLivenessDetectionSupported(): boolean {
    try {
        // @ts-ignore
        if (typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function") {
            // @ts-ignore
            const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
            // @ts-ignore
            if (module instanceof WebAssembly.Module) {
                // @ts-ignore
                return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
            }
        }
    } catch (e) {
    }
    return false
}

export enum FacePresenceStatus {
    NOT_FOUND,
    FOUND
}

export class LivenessDetectionSessionResult {
    startTime: Date
    duration: number
    faceCaptures: Array<LiveFaceCapture>

    constructor(startTime: Date) {
        this.startTime = startTime
        this.faceCaptures = []
        this.duration = (new Date().getTime() - startTime.getTime())/1000
    }
}

export function livenessDetectionSession(settings: FaceCaptureSettings, faceDetectionCallback: (faceDetectionResult: LiveFaceCapture) => void, faceCaptureCallback: (faceCapture: LiveFaceCapture) => void): Observable<LivenessDetectionSessionResult> {

    if (!isLivenessDetectionSupported()) {
        return new Observable(subscriber => subscriber.error(new Error("Liveness detection is not supported by your browser")))
    }

    if (!settings) {
        settings = new FaceCaptureSettings()
    }

    function isFaceFixedInImageSize(actualFaceBounds, expectedFaceBounds) {
        return true
        // var maxRect = new Rect(expectedFaceBounds.x, expectedFaceBounds.y, expectedFaceBounds.width, expectedFaceBounds.height)
        // maxRect.inset(0-expectedFaceBounds.width*0.3, 0-expectedFaceBounds.height*0.3)
        // var minRect = new Rect(expectedFaceBounds.x, expectedFaceBounds.y, expectedFaceBounds.width, expectedFaceBounds.height)
        // minRect.inset(expectedFaceBounds.width * 0.4, expectedFaceBounds.height * 0.4)
        // return actualFaceBounds.contains(minRect) && maxRect.contains(actualFaceBounds)
    }

    var cameraOverlayCanvas = document.createElement("canvas")
    cameraOverlayCanvas.style.position = "absolute"
    cameraOverlayCanvas.style.left = "0px"
    cameraOverlayCanvas.style.top = "0px"
    var cameraOverlayContext = cameraOverlayCanvas.getContext("2d")

    var videoContainer = document.createElement("div")
    videoContainer.style.position = "fixed"
    videoContainer.style.left = "0px"
    videoContainer.style.top = "0px"
    videoContainer.style.right = "0px"
    videoContainer.style.bottom = "0px"
    videoContainer.style.backgroundColor = "black"
    document.body.appendChild(videoContainer)

    var video = document.createElement("video")
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

    var cancelButton = document.createElement("a")
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

    const nextCaptureBearing = () => {
        var index = nextEmptyCaptureIndex()
        if (index == -1) {
            return bearingsToCapture[bearingsToCapture.length-1].bearing
        }
        return bearingsToCapture[index].bearing
    }

    const nextEmptyCaptureIndex = () => {
        return bearingsToCapture.findIndex(val => {
            return (!val.captured)
        })
    }

    const drawDetectedFace = capture => {
        let scale = Math.min(videoContainer.clientWidth / capture.image.width, videoContainer.clientHeight / capture.image.height)
        cameraOverlayCanvas.width = capture.image.width * scale
        cameraOverlayCanvas.height = capture.image.height * scale
        cameraOverlayCanvas.style.left = ((videoContainer.clientWidth - cameraOverlayCanvas.width) / 2)+"px"
        cameraOverlayCanvas.style.top = ((videoContainer.clientHeight - cameraOverlayCanvas.height) / 2)+"px"
        cameraOverlayContext.clearRect(0, 0, cameraOverlayCanvas.width, cameraOverlayCanvas.height)
        var ovalColor
        var textColor
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
        var faceRect: Rect
        if (capture.faceBounds) {
            faceRect = capture.faceBounds.scaledBy(scale)
            cameraOverlayContext.lineWidth = 0.038 * faceRect.width
            cameraOverlayContext.beginPath()
            cameraOverlayContext.ellipse(faceRect.x + faceRect.width / 2, faceRect.y + faceRect.height / 2, faceRect.width /2, faceRect.height / 2, 0, 0, Math.PI * 2)
            if (capture.offsetAngleFromBearing) {
                var angle = Math.atan2(capture.offsetAngleFromBearing.pitch, capture.offsetAngleFromBearing.yaw)
                var distance = Math.hypot(capture.offsetAngleFromBearing.yaw, 0 - capture.offsetAngleFromBearing.pitch) * 2 * 1.7
                var arrowLength = faceRect.width / 5
                var arrowStemLength = Math.min(Math.max(arrowLength * distance, arrowLength * 0.75), arrowLength * 1.7)
                var arrowAngle = 40 * (Math.PI/180)
                var arrowTipX = faceRect.center.x + Math.cos(angle) * arrowLength / 2
                var arrowTipY = faceRect.center.y + Math.sin(angle) * arrowLength / 2
                var arrowPoint1X = arrowTipX + Math.cos(angle + Math.PI - arrowAngle) * arrowLength * 0.6
                var arrowPoint1Y = arrowTipY + Math.sin(angle + Math.PI - arrowAngle) * arrowLength * 0.6
                var arrowPoint2X = arrowTipX + Math.cos(angle + Math.PI + arrowAngle) * arrowLength * 0.6
                var arrowPoint2Y = arrowTipY + Math.sin(angle + Math.PI + arrowAngle) * arrowLength * 0.6
                var arrowStartX = arrowTipX + Math.cos(angle + Math.PI) * arrowStemLength
                var arrowStartY = arrowTipY + Math.sin(angle + Math.PI) * arrowStemLength

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
        var prompt
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
        var textSize = 24
        var textY = Math.max(faceRect.y - cameraOverlayContext.lineWidth * 2, textSize)
        cameraOverlayContext.font = textSize+"px Helvetica, Arial, sans-serif"
        cameraOverlayContext.textAlign = "center"
        var textWidth = cameraOverlayContext.measureText(prompt).width
        var cornerRadius = 8
        var textRect: Rect = new Rect(
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

    const detectFacePresence = (capture: LiveFaceCapture) => {
        if (capture.face) {
            faceBuffer.enqueue(capture.face)
            faceBoundsSmoothing.addSample(capture.face.bounds)
            faceAngleSmoothing.addSample(capture.face.angle)
            if (faceBuffer.isFull) {
                facePresenceStatus = FacePresenceStatus.FOUND
            }
        } else if (alignedFaceCount >= settings.faceCaptureFaceCount) {
            facePresenceStatus = FacePresenceStatus.NOT_FOUND
        } else {
            faceBuffer.dequeue()
            if (facePresenceStatus != FacePresenceStatus.NOT_FOUND && faceBuffer.isEmpty) {
                throw new Error("Face lost")
            }
            faceBoundsSmoothing.removeFirstSample()
            faceAngleSmoothing.removeFirstSample()
            var lastFace = faceBuffer.lastElement
            if (lastFace != null) {
                var requestedAngle = angleBearingEvaluation.angleForBearing(capture.requestedBearing).screenAngle
                var detectedAngle = lastFace.angle.screenAngle
                var deg45 = 45 * (Math.PI/180)
                var inset = Math.min(capture.image.width, capture.image.height) * 0.05
                var rect = new Rect(0, 0, capture.image.width, capture.image.height)
                rect.inset(inset, inset)
                if (rect.contains(lastFace.bounds) && detectedAngle > requestedAngle - deg45 && detectedAngle < requestedAngle + deg45) {
                    throw new Error("Face moved too far")
                }
            }
        }
        capture.faceBounds = faceBoundsSmoothing.smoothedValue
        capture.faceAngle = faceAngleSmoothing.smoothedValue
        capture.facePresenceStatus = facePresenceStatus
        return capture
    }

    const detectFaceAlignment = (capture: LiveFaceCapture) => {
        if (capture.facePresenceStatus == FacePresenceStatus.FOUND) {
            var face = faceBuffer.lastElement
            if (face != null) {
                var now = new Date().getTime()/1000
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
                        var f = faces.get(i)
                        if (!angleBearingEvaluation.angleMatchesBearing(f.angle, capture.requestedBearing)) {
                            faceAlignmentStatus = FaceAlignmentStatus.MISALIGNED
                            capture.faceAlignmentStatus = faceAlignmentStatus
                            capture.offsetAngleFromBearing = angleBearingEvaluation.offsetFromAngleToBearing(capture.faceAngle ? capture.faceAngle : new Angle(), capture.requestedBearing)
                            return capture
                        }                                
                    }
                    faces.clear()
                    faceAlignmentStatus = FaceAlignmentStatus.ALIGNED
                    fixTime = now
                    alignedFaceCount += 1
                    if (alignedFaceCount <= settings.faceCaptureCount) {
                        var index = nextEmptyCaptureIndex()
                        if (index != -1) {
                            bearingsToCapture[index].captured = true
                        }
                    }
                }
            }
        } else {
            faces.clear()
            faceAlignmentStatus = FaceAlignmentStatus.FOUND
        }
        capture.faceAlignmentStatus = faceAlignmentStatus
        return capture
    }

    const detectSpoofAttempt = (capture: LiveFaceCapture) => {
        var face = faceBuffer.lastElement
            if (capture.facePresenceStatus != FacePresenceStatus.FOUND || !face) {
                angleHistory = []
                return capture
            }
            if (capture.faceAlignmentStatus != FaceAlignmentStatus.ALIGNED) {
                angleHistory.push(face.angle)
                return capture
            }
            if (bearingIndex > 0 && nextCaptureBearing() != capture.requestedBearing) {
                var previousAngle = angleBearingEvaluation.angleForBearing(nextCaptureBearing())
                var currentAngle = angleBearingEvaluation.angleForBearing(capture.requestedBearing)
                var startYaw = Math.min(previousAngle.yaw, currentAngle.yaw)
                var endYaw = Math.max(previousAngle.yaw, currentAngle.yaw)
                var yawTolerance = angleBearingEvaluation.thresholdAngleToleranceForAxis(Axis.YAW)
                var movedTooFast = angleHistory.length > 1
                var movedOpposite = false
                for (var i=0; i<angleHistory.length; i++) {
                    var angle = angleHistory[i]
                    if (angle.yaw > startYaw - yawTolerance && angle.yaw < endYaw + yawTolerance) {
                        movedTooFast = false
                    }
                    if (!angleBearingEvaluation.isAngleBetweenBearings(angle, nextCaptureBearing(), capture.requestedBearing)) {
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

    const createFaceCapture = (capture: LiveFaceCapture) => {
        return new Observable<LivenessDetectionSessionResult>(subscriber => {
            function drawFaceImage() {
                setTimeout(() => {
                    capture.faceImage = new Image()
                    let canvas = document.createElement("canvas")
                    canvas.width = capture.face.bounds.width
                    canvas.height = capture.face.bounds.height
                    if (settings.useFrontCamera) {
                        capture.face.bounds.x = capture.image.width - capture.face.bounds.x - capture.face.bounds.width
                    }
                    let ctx = canvas.getContext("2d")
                    ctx.drawImage(capture.image, capture.face.bounds.x, capture.face.bounds.y, capture.face.bounds.width, capture.face.bounds.height, 0, 0, capture.face.bounds.width, capture.face.bounds.height)
                    capture.faceImage.src = canvas.toDataURL()
                    if (!subscriber.isStopped) {
                        subscriber.next(capture)
                    }
                }, 0)
            }
            if (capture.image.complete) {
                drawFaceImage()
            } else {
                capture.image.onload = drawFaceImage
            }
        })
    }

    var faceBuffer = new CircularBuffer<Face>(3)
    var faces = new CircularBuffer<Face>(settings.faceCaptureFaceCount)
    var facePresenceStatus = FacePresenceStatus.NOT_FOUND
    var faceAlignmentStatus = FaceAlignmentStatus.FOUND
    var fixTime = null
    var alignedFaceCount = 0
    var angleHistory = []
    var startTime = new Date().getTime()
    const angleBearingEvaluation: AngleBearingEvaluation = new AngleBearingEvaluation(settings, 5, 5)
    var bearingsToCapture = [{
        "bearing": Bearing.STRAIGHT,
        "captured": false
    }]
    var bearingIndex = 0
    for (let i=1; i<settings.faceCaptureCount; i++) {
        let candidateBearings = settings.bearings.filter(bearing => {
            return bearing != bearingsToCapture[i-1].bearing &&  angleBearingEvaluation.angleForBearing(bearing).yaw != angleBearingEvaluation.angleForBearing(bearingsToCapture[i-1].bearing).yaw
        })
        if (candidateBearings.length > 0) {
            bearingsToCapture[i] = {
                "bearing": candidateBearings[Math.floor(Math.random()*candidateBearings.length)],
                "captured": false
            }
        } else {
            bearingsToCapture[i] = {
                "bearing": bearingsToCapture[i-1].bearing,
                "captured": false
            }
        }
    }
    var faceBoundsSmoothing = new RectSmoothing(3)
    var faceAngleSmoothing = new AngleSmoothing(3)
    
    return liveFaceCapture(video, settings).pipe(
        map((capture: LiveFaceCapture) => {
            capture.requestedBearing = nextCaptureBearing()
            return capture
        }),
        map(detectFacePresence),
        map(detectFaceAlignment),
        tap(drawDetectedFace),
        tap(capture => {
            if (faceDetectionCallback) {
                faceDetectionCallback(capture)
            }
        }),
        filter(capture => {
            return capture.face && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED
        }),
        mergeMap(createFaceCapture),
        tap(faceCapture => {
            if (faceCaptureCallback) {
                faceCaptureCallback(faceCapture)
            }
        }),
        take(settings.faceCaptureCount),
        takeWhile(() => {
            return new Date().getTime() < startTime + settings.maxDuration * 1000
        }),
        reduce((acc: LivenessDetectionSessionResult, one: LiveFaceCapture) => {
            acc.faceCaptures.push(one)
            return acc
        }, new LivenessDetectionSessionResult(new Date(startTime))),
        map((result: LivenessDetectionSessionResult) => {
            if (result.faceCaptures.length < settings.faceCaptureCount) {
                throw new Error("Session timed out")
            }
            return result
        }),
        (observable: Observable<LivenessDetectionSessionResult>) => new Observable<LivenessDetectionSessionResult>(subscriber => {
            var subcription = observable.subscribe(
                (val: LivenessDetectionSessionResult) => {
                    subscriber.next(val)
                },(err) => {
                    subscriber.error(err)
                },() => {
                    subscriber.complete()
                }
            )
            cancelButton.onclick = () => {
                subscriber.complete()
            }
            return () => {
                subcription.unsubscribe()
                if (videoContainer.parentNode) {
                    videoContainer.parentNode.removeChild(videoContainer)
                }
            }
        })
    )
}

export class FaceExtents {
    proportionOfViewWidth: number
    proportionOfViewHeight: number
    constructor(proportionOfViewWidth: number, proportionOfViewHeight: number) {
        this.proportionOfViewWidth = proportionOfViewWidth
        this.proportionOfViewHeight = proportionOfViewHeight
    }
}

export class FaceCaptureSettings {
    useFrontCamera: boolean = true
    faceCaptureCount: number = 2
    maxDuration: number = 30
    yawThreshold: number = 20
    pitchThreshold: number = 15
    faceCaptureFaceCount: number = 2
    pauseDuration: number = 0.5
    expectedFaceExtents: FaceExtents = new FaceExtents(0.65, 0.85)
    bearings = [Bearing.STRAIGHT, Bearing.LEFT, Bearing.RIGHT, Bearing.LEFT_UP, Bearing.RIGHT_UP]
}

export class Face {
    bounds: Rect
    angle: Angle
    template?: string

    constructor(bounds: Rect, angle: Angle) {
        this.bounds = bounds
        this.angle = angle
    }
}

export class LiveFaceCapture {
    image: HTMLImageElement
    face: Face
    requestedBearing?: Bearing
    faceBounds?: Rect
    faceAngle?: Angle
    facePresenceStatus?: FacePresenceStatus
    faceAlignmentStatus?: FaceAlignmentStatus
    offsetAngleFromBearing?: Angle
    faceImage?: HTMLImageElement

    constructor(image: HTMLImageElement, face: Face) {
        this.image = image
        this.face = face
    }
}

export function liveFaceCapture(video: HTMLVideoElement, settings: FaceCaptureSettings): Observable<LiveFaceCapture> {
    if (!settings) {
        settings = new FaceCaptureSettings()
    }
    
    function transferToHeap(arr) {
        const floatArray = Float32Array.from(arr)
        // @ts-ignore
        var heapSpace = Module._malloc(floatArray.length *  Float32Array.BYTES_PER_ELEMENT)
        // @ts-ignore
        Module.HEAPF32.set(floatArray, heapSpace >> 2)
        return heapSpace
    }
    
    function calculateFacePose(face): Angle {
        var landmarks = []
        face.landmarks.positions.forEach(position => {
            landmarks.push(position.x, position.y)
        })
        let arrayOnHeap;
        try {
            arrayOnHeap = transferToHeap(landmarks);
            // @ts-ignore
            Module._calculateFacePose(arrayOnHeap, landmarks.length);
            // @ts-ignore
            return new Angle(Module._getYaw(), Module._getPitch()-7)
        } finally {
            // @ts-ignore
            Module._free(arrayOnHeap);
        }
    }

    return new Observable(subscriber => {
        if (!navigator.mediaDevices) {
            subscriber.error(new Error("Unsupported browser"))
            return
        }
        var poseCalculationsScriptURL: string = "/js/PoseCalculations.js"
        var poseCalculationsScript: HTMLScriptElement = document.querySelector("script[src=\""+poseCalculationsScriptURL+"\"]")
        if (!poseCalculationsScript) {
            poseCalculationsScript = document.createElement("script")
            poseCalculationsScript.onload = onScriptLoad
            // poseCalculationsScript.setAttribute("async", "async")
            poseCalculationsScript.setAttribute("type", "text/javascript")
            poseCalculationsScript.src = poseCalculationsScriptURL
            document.head.appendChild(poseCalculationsScript)
        } else {
            onScriptLoad()
        }
        var videoTrack
        function onScriptLoad() {
            var constraints = navigator.mediaDevices.getSupportedConstraints();
            var getUserMediaOptions: MediaStreamConstraints = {
                "audio": false,
                "video": true
            }
            if (constraints.facingMode) {
                getUserMediaOptions.video = {
                    "facingMode": settings.useFrontCamera ? "user" : "environment"
                }
            }
            Promise.all([
                // @ts-ignore
                faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
                // @ts-ignore
                faceapi.nets.faceLandmark68Net.loadFromUri("/models")
            ]).then(function() {
                return navigator.mediaDevices.getUserMedia(getUserMediaOptions)
            }).then(function (stream) {
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
                video.onplay = function() {
                    var canvas = document.createElement("canvas")
                    canvas.width = video.videoWidth
                    canvas.height = video.videoHeight
                    var ctx = canvas.getContext("2d")
                    
                    async function detectSingleFace() {
                        try {
                            // @ts-ignore
                            var _face = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({"inputSize": 128})).withFaceLandmarks()
                            var face: Face
                            if (_face) {
                                let angle = calculateFacePose(_face)
                                var leftEye = _face.landmarks.getLeftEye()
                                var rightEye = _face.landmarks.getRightEye()
                                var leftEyeCentre = {
                                    "x": leftEye[0].x + (leftEye[3].x - leftEye[0].x) / 2,
                                    "y": leftEye[0].y + (leftEye[3].y - leftEye[0].y) / 2
                                }
                                var rightEyeCentre = {
                                    "x": rightEye[0].x + (rightEye[3].x - rightEye[0].x) / 2,
                                    "y": rightEye[0].y + (rightEye[3].y - rightEye[0].y) / 2
                                }
                                var distanceBetweenEyes = Math.sqrt(Math.pow(rightEyeCentre.x - leftEyeCentre.x, 2) + Math.pow(rightEyeCentre.y - leftEyeCentre.y, 2))
                                var ovalCentre = {
                                    "x": leftEyeCentre.x + (rightEyeCentre.x - leftEyeCentre.x) / 2,
                                    "y": leftEyeCentre.y + (rightEyeCentre.y - leftEyeCentre.y) / 2
                                }
                                var ovalSize = {
                                    "width": distanceBetweenEyes * 3,
                                    "height": 0
                                }
                                ovalSize.height = ovalSize.width / 4 * 5
                                if (settings.useFrontCamera) {
                                    ovalCentre.x = canvas.width - ovalCentre.x
                                    angle.yaw = 0-angle.yaw
                                }
                                ovalCentre.y += ovalSize.height * 0.04
                                face = new Face(new Rect(ovalCentre.x - ovalSize.width / 2, ovalCentre.y - ovalSize.height / 2, ovalSize.width, ovalSize.height), angle)
                            }
                            if (!subscriber.isStopped) {
                                ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                                var image = new Image()
                                image.width = canvas.width
                                image.height = canvas.height
                                image.src = canvas.toDataURL()
                                subscriber.next(new LiveFaceCapture(image, face))
                            }
                            setTimeout(detectSingleFace, 0)
                        } catch (error) {
                            if (!subscriber.isStopped) {
                                subscriber.error(error)
                            }
                        }
                    }
                    setTimeout(detectSingleFace, 0)
                }
            }).catch(function (error) {
                subscriber.error(error)
            })
        }
        return () => {
            if (videoTrack) {
                videoTrack.stop()
                videoTrack = null
            }
        }
    })
}