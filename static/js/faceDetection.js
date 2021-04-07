/**
 * Ver-ID face detection
 * @packageDocumentation
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// @ts-ignore
import { Observable, from, of } from "https://dev.jspm.io/rxjs@6/_esm2015";
// @ts-ignore
import { map, filter, take, takeWhile, reduce, tap, mergeMap } from "https://dev.jspm.io/rxjs@6/_esm2015/operators";
import { CircularBuffer, AngleBearingEvaluation, Angle, Rect, Axis, RectSmoothing, AngleSmoothing } from "./utils.js";
import { FaceRecognition } from "./faceRecognition.js";
/**
 * Face alignment status
 */
export var FaceAlignmentStatus;
(function (FaceAlignmentStatus) {
    FaceAlignmentStatus[FaceAlignmentStatus["FOUND"] = 0] = "FOUND";
    FaceAlignmentStatus[FaceAlignmentStatus["FIXED"] = 1] = "FIXED";
    FaceAlignmentStatus[FaceAlignmentStatus["ALIGNED"] = 2] = "ALIGNED";
    FaceAlignmentStatus[FaceAlignmentStatus["MISALIGNED"] = 3] = "MISALIGNED";
})(FaceAlignmentStatus || (FaceAlignmentStatus = {}));
/**
 * Bearing
 */
export var Bearing;
(function (Bearing) {
    Bearing[Bearing["STRAIGHT"] = 0] = "STRAIGHT";
    Bearing[Bearing["LEFT"] = 1] = "LEFT";
    Bearing[Bearing["RIGHT"] = 2] = "RIGHT";
    Bearing[Bearing["UP"] = 3] = "UP";
    Bearing[Bearing["DOWN"] = 4] = "DOWN";
    Bearing[Bearing["LEFT_UP"] = 5] = "LEFT_UP";
    Bearing[Bearing["RIGHT_UP"] = 6] = "RIGHT_UP";
    Bearing[Bearing["LEFT_DOWN"] = 7] = "LEFT_DOWN";
    Bearing[Bearing["RIGHT_DOWN"] = 8] = "RIGHT_DOWN";
})(Bearing || (Bearing = {}));
/**
 * Face detection
 */
export class FaceDetection {
    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    constructor(serviceURL) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : "";
        this.faceRecognition = new FaceRecognition(this.serviceURL);
    }
    /**
     * @returns `true` if liveness detection is supported by the client
     */
    static isLivenessDetectionSupported() {
        return "Promise" in window && "fetch" in window;
    }
    /**
     * Create a liveness detection session. Subscribe to the returned Observable to start the session and to receive results.
     * @param settings Session settings
     * @param faceDetectionCallback Optional callback to invoke each time a frame is ran by face detection
     * @param faceCaptureCallback Optional callback to invoke when a face aligned to the requested bearing is captured
     */
    livenessDetectionSession(settings, faceDetectionCallback, faceCaptureCallback) {
        if (!FaceDetection.isLivenessDetectionSupported()) {
            return new Observable(subscriber => subscriber.error(new Error("Liveness detection is not supported by your browser")));
        }
        if (!settings) {
            settings = new FaceCaptureSettings();
        }
        function isFaceFixedInImageSize(actualFaceBounds, expectedFaceBounds) {
            return true;
            // var maxRect = new Rect(expectedFaceBounds.x, expectedFaceBounds.y, expectedFaceBounds.width, expectedFaceBounds.height)
            // maxRect.inset(0-expectedFaceBounds.width*0.3, 0-expectedFaceBounds.height*0.3)
            // var minRect = new Rect(expectedFaceBounds.x, expectedFaceBounds.y, expectedFaceBounds.width, expectedFaceBounds.height)
            // minRect.inset(expectedFaceBounds.width * 0.4, expectedFaceBounds.height * 0.4)
            // return actualFaceBounds.contains(minRect) && maxRect.contains(actualFaceBounds)
        }
        var cameraOverlayCanvas = document.createElement("canvas");
        cameraOverlayCanvas.style.position = "absolute";
        cameraOverlayCanvas.style.left = "0px";
        cameraOverlayCanvas.style.top = "0px";
        var cameraOverlayContext = cameraOverlayCanvas.getContext("2d");
        var videoContainer = document.createElement("div");
        videoContainer.style.position = "fixed";
        videoContainer.style.left = "0px";
        videoContainer.style.top = "0px";
        videoContainer.style.right = "0px";
        videoContainer.style.bottom = "0px";
        videoContainer.style.backgroundColor = "black";
        document.body.appendChild(videoContainer);
        var video = document.createElement("video");
        video.setAttribute("autoplay", "autoplay");
        video.setAttribute("muted", "muted");
        video.setAttribute("playsinline", "playsinline");
        video.style.position = "absolute";
        video.style.left = "0px";
        video.style.top = "0px";
        video.style.right = "0px";
        video.style.bottom = "0px";
        video.style.width = "100%";
        video.style.height = "100%";
        var cancelButton = document.createElement("a");
        cancelButton.href = "javascript:void(0)";
        cancelButton.innerText = "Cancel";
        cancelButton.style.textShadow = "0px 1px 5px rgba(0, 0, 0, 0.5)";
        cancelButton.style.fontFamily = "Helvetica, Arial, sans-serif";
        cancelButton.style.color = "white";
        cancelButton.style.textDecoration = "none";
        cancelButton.style.position = "absolute";
        cancelButton.style.bottom = " 16px";
        cancelButton.style.left = "8px";
        cancelButton.style.right = "8px";
        cancelButton.style.textAlign = "center";
        videoContainer.appendChild(video);
        videoContainer.appendChild(cameraOverlayCanvas);
        videoContainer.appendChild(cancelButton);
        const nextCaptureBearing = () => {
            var index = nextEmptyCaptureIndex();
            if (index == -1) {
                return bearingsToCapture[bearingsToCapture.length - 1].bearing;
            }
            return bearingsToCapture[index].bearing;
        };
        const nextEmptyCaptureIndex = () => {
            return bearingsToCapture.findIndex(val => {
                return (!val.captured);
            });
        };
        const drawDetectedFace = capture => {
            let scale = Math.min(videoContainer.clientWidth / capture.image.width, videoContainer.clientHeight / capture.image.height);
            cameraOverlayCanvas.width = capture.image.width * scale;
            cameraOverlayCanvas.height = capture.image.height * scale;
            cameraOverlayCanvas.style.left = ((videoContainer.clientWidth - cameraOverlayCanvas.width) / 2) + "px";
            cameraOverlayCanvas.style.top = ((videoContainer.clientHeight - cameraOverlayCanvas.height) / 2) + "px";
            cameraOverlayContext.clearRect(0, 0, cameraOverlayCanvas.width, cameraOverlayCanvas.height);
            var ovalColor;
            var textColor;
            if (capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED || capture.faceAlignmentStatus == FaceAlignmentStatus.FIXED) {
                ovalColor = "green";
                textColor = "white";
            }
            else {
                ovalColor = "white";
                textColor = "black";
            }
            cameraOverlayContext.strokeStyle = ovalColor;
            cameraOverlayContext.lineCap = "round";
            cameraOverlayContext.lineJoin = "round";
            var faceRect;
            if (capture.faceBounds) {
                faceRect = capture.faceBounds.scaledBy(scale);
                if (settings.useFrontCamera) {
                    faceRect = faceRect.mirrored(capture.image.width * scale);
                }
                cameraOverlayContext.lineWidth = 0.038 * faceRect.width;
                cameraOverlayContext.beginPath();
                cameraOverlayContext.ellipse(faceRect.x + faceRect.width / 2, faceRect.y + faceRect.height / 2, faceRect.width / 2, faceRect.height / 2, 0, 0, Math.PI * 2);
                if (capture.offsetAngleFromBearing) {
                    var angle = Math.atan2(capture.offsetAngleFromBearing.pitch, capture.offsetAngleFromBearing.yaw);
                    var distance = Math.hypot(capture.offsetAngleFromBearing.yaw, 0 - capture.offsetAngleFromBearing.pitch) * 2 * 1.7;
                    var arrowLength = faceRect.width / 5;
                    var arrowStemLength = Math.min(Math.max(arrowLength * distance, arrowLength * 0.75), arrowLength * 1.7);
                    var arrowAngle = 40 * (Math.PI / 180);
                    var arrowTipX = faceRect.center.x + Math.cos(angle) * arrowLength / 2;
                    var arrowTipY = faceRect.center.y + Math.sin(angle) * arrowLength / 2;
                    var arrowPoint1X = arrowTipX + Math.cos(angle + Math.PI - arrowAngle) * arrowLength * 0.6;
                    var arrowPoint1Y = arrowTipY + Math.sin(angle + Math.PI - arrowAngle) * arrowLength * 0.6;
                    var arrowPoint2X = arrowTipX + Math.cos(angle + Math.PI + arrowAngle) * arrowLength * 0.6;
                    var arrowPoint2Y = arrowTipY + Math.sin(angle + Math.PI + arrowAngle) * arrowLength * 0.6;
                    var arrowStartX = arrowTipX + Math.cos(angle + Math.PI) * arrowStemLength;
                    var arrowStartY = arrowTipY + Math.sin(angle + Math.PI) * arrowStemLength;
                    cameraOverlayContext.moveTo(arrowPoint1X, arrowPoint1Y);
                    cameraOverlayContext.lineTo(arrowTipX, arrowTipY);
                    cameraOverlayContext.lineTo(arrowPoint2X, arrowPoint2Y);
                    cameraOverlayContext.moveTo(arrowTipX, arrowTipY);
                    cameraOverlayContext.lineTo(arrowStartX, arrowStartY);
                }
                cameraOverlayContext.stroke();
            }
            else {
                faceRect = new Rect(0, 0, 0, 0);
                if (cameraOverlayCanvas.width > cameraOverlayCanvas.height) {
                    faceRect.height = cameraOverlayCanvas.height * settings.expectedFaceExtents.proportionOfViewHeight;
                    faceRect.width = faceRect.height / 1.25;
                }
                else {
                    faceRect.width = cameraOverlayCanvas.width * settings.expectedFaceExtents.proportionOfViewWidth;
                    faceRect.height = faceRect.width * 1.25;
                }
                faceRect.x = cameraOverlayCanvas.width / 2 - faceRect.width / 2;
                faceRect.y = cameraOverlayCanvas.height / 2 - faceRect.height / 2;
                cameraOverlayContext.lineWidth = 0.038 * faceRect.width;
                cameraOverlayContext.beginPath();
                cameraOverlayContext.ellipse(faceRect.x + faceRect.width / 2, faceRect.y + faceRect.height / 2, faceRect.width / 2, faceRect.height / 2, 0, 0, Math.PI * 2);
                cameraOverlayContext.stroke();
            }
            var prompt;
            switch (capture.faceAlignmentStatus) {
                case FaceAlignmentStatus.FIXED:
                case FaceAlignmentStatus.ALIGNED:
                    prompt = "Great, hold it";
                    break;
                case FaceAlignmentStatus.MISALIGNED:
                    prompt = "Slowly turn to follow the arrow";
                    break;
                default:
                    prompt = "Align your face with the oval";
            }
            var textSize = 24;
            var textY = Math.max(faceRect.y - cameraOverlayContext.lineWidth * 2, textSize);
            cameraOverlayContext.font = textSize + "px Helvetica, Arial, sans-serif";
            cameraOverlayContext.textAlign = "center";
            var textWidth = cameraOverlayContext.measureText(prompt).width;
            var cornerRadius = 8;
            var textRect = new Rect(cameraOverlayCanvas.width / 2 - textWidth / 2 - cornerRadius, textY - textSize, textWidth + cornerRadius * 2, textSize + cornerRadius);
            cameraOverlayContext.beginPath();
            cameraOverlayContext.moveTo(textRect.x + cornerRadius, textRect.y);
            cameraOverlayContext.lineTo(textRect.x + textRect.width - cornerRadius, textRect.y);
            cameraOverlayContext.quadraticCurveTo(textRect.x + textRect.width, textRect.y, textRect.x + textRect.width, textRect.y + cornerRadius);
            cameraOverlayContext.lineTo(textRect.x + textRect.width, textRect.y + textRect.height - cornerRadius);
            cameraOverlayContext.quadraticCurveTo(textRect.x + textRect.width, textRect.y + textRect.height, textRect.x + textRect.width - cornerRadius, textRect.y + textRect.height);
            cameraOverlayContext.lineTo(textRect.x + cornerRadius, textRect.y + textRect.height);
            cameraOverlayContext.quadraticCurveTo(textRect.x, textRect.y + textRect.height, textRect.x, textRect.y + textRect.height - cornerRadius);
            cameraOverlayContext.lineTo(textRect.x, textRect.y + cornerRadius);
            cameraOverlayContext.quadraticCurveTo(textRect.x, textRect.y, textRect.x + cornerRadius, textRect.y);
            cameraOverlayContext.closePath();
            cameraOverlayContext.fillStyle = ovalColor;
            cameraOverlayContext.fill();
            cameraOverlayContext.fillStyle = textColor;
            cameraOverlayContext.fillText(prompt, cameraOverlayCanvas.width / 2, textY);
        };
        const detectFacePresence = (capture) => {
            if (capture.face) {
                faceBuffer.enqueue(capture.face);
                faceBoundsSmoothing.addSample(capture.face.bounds);
                faceAngleSmoothing.addSample(capture.face.angle);
                if (faceBuffer.isFull) {
                    faceDetected = true;
                }
            }
            else if (alignedFaceCount >= settings.faceCaptureFaceCount) {
                faceDetected = false;
            }
            else {
                faceBuffer.dequeue();
                if (faceDetected && faceBuffer.isEmpty) {
                    throw new Error("Face lost");
                }
                faceBoundsSmoothing.removeFirstSample();
                faceAngleSmoothing.removeFirstSample();
                var lastFace = faceBuffer.lastElement;
                if (lastFace != null) {
                    var requestedAngle = angleBearingEvaluation.angleForBearing(capture.requestedBearing).screenAngle;
                    var detectedAngle = lastFace.angle.screenAngle;
                    var deg45 = 45 * (Math.PI / 180);
                    var inset = Math.min(capture.image.width, capture.image.height) * 0.05;
                    var rect = new Rect(0, 0, capture.image.width, capture.image.height);
                    rect.inset(inset, inset);
                    if (rect.contains(lastFace.bounds) && detectedAngle > requestedAngle - deg45 && detectedAngle < requestedAngle + deg45) {
                        throw new Error("Face moved too far");
                    }
                }
            }
            capture.faceBounds = faceBoundsSmoothing.smoothedValue;
            capture.faceAngle = faceAngleSmoothing.smoothedValue;
            capture.isFacePresent = faceDetected;
            return capture;
        };
        const detectFaceAlignment = (capture) => {
            if (capture.isFacePresent) {
                var face = faceBuffer.lastElement;
                if (face != null) {
                    var now = new Date().getTime() / 1000;
                    if (faceAlignmentStatus == FaceAlignmentStatus.ALIGNED) {
                        faceAlignmentStatus = FaceAlignmentStatus.FIXED;
                        fixTime = now;
                    }
                    faces.enqueue(face);
                    if (faceAlignmentStatus == FaceAlignmentStatus.FOUND && isFaceFixedInImageSize(face.bounds, new Rect(0, 0, capture.image.width, capture.image.height))) {
                        fixTime = now;
                        faceAlignmentStatus = FaceAlignmentStatus.FIXED;
                    }
                    else if (fixTime && now - fixTime > settings.pauseDuration && faces.isFull) {
                        for (let i = 0; i < faces.length; i++) {
                            var f = faces.get(i);
                            if (!angleBearingEvaluation.angleMatchesBearing(f.angle, capture.requestedBearing)) {
                                faceAlignmentStatus = FaceAlignmentStatus.MISALIGNED;
                                capture.faceAlignmentStatus = faceAlignmentStatus;
                                capture.offsetAngleFromBearing = angleBearingEvaluation.offsetFromAngleToBearing(capture.faceAngle ? capture.faceAngle : new Angle(), capture.requestedBearing);
                                return capture;
                            }
                        }
                        faces.clear();
                        faceAlignmentStatus = FaceAlignmentStatus.ALIGNED;
                        fixTime = now;
                        alignedFaceCount += 1;
                        if (alignedFaceCount <= settings.faceCaptureCount) {
                            var index = nextEmptyCaptureIndex();
                            if (index != -1) {
                                bearingsToCapture[index].captured = true;
                            }
                        }
                    }
                }
            }
            else {
                faces.clear();
                faceAlignmentStatus = FaceAlignmentStatus.FOUND;
            }
            capture.faceAlignmentStatus = faceAlignmentStatus;
            return capture;
        };
        const detectSpoofAttempt = (capture) => {
            var face = faceBuffer.lastElement;
            if (!capture.isFacePresent || !face) {
                angleHistory = [];
                return capture;
            }
            if (capture.faceAlignmentStatus != FaceAlignmentStatus.ALIGNED) {
                angleHistory.push(face.angle);
                return capture;
            }
            if (bearingIndex > 0 && nextCaptureBearing() != capture.requestedBearing) {
                var previousAngle = angleBearingEvaluation.angleForBearing(nextCaptureBearing());
                var currentAngle = angleBearingEvaluation.angleForBearing(capture.requestedBearing);
                var startYaw = Math.min(previousAngle.yaw, currentAngle.yaw);
                var endYaw = Math.max(previousAngle.yaw, currentAngle.yaw);
                var yawTolerance = angleBearingEvaluation.thresholdAngleToleranceForAxis(Axis.YAW);
                var movedTooFast = angleHistory.length > 1;
                var movedOpposite = false;
                for (var i = 0; i < angleHistory.length; i++) {
                    var angle = angleHistory[i];
                    if (angle.yaw > startYaw - yawTolerance && angle.yaw < endYaw + yawTolerance) {
                        movedTooFast = false;
                    }
                    if (!angleBearingEvaluation.isAngleBetweenBearings(angle, nextCaptureBearing(), capture.requestedBearing)) {
                        movedOpposite = true;
                    }
                }
                if (movedTooFast) {
                    throw new Error("Moved too fast");
                }
                if (movedOpposite) {
                    throw new Error("Moved opposite");
                }
            }
            angleHistory = [];
            return capture;
        };
        const createFaceCapture = (capture) => {
            if (capture.requestedBearing == Bearing.STRAIGHT) {
                let bounds = capture.face ? capture.face.bounds : null;
                return from(this.faceRecognition.createRecognizableFace(capture.image, bounds).then(recognizableFace => {
                    capture.face.template = recognizableFace.faceTemplate;
                    return capture;
                }));
            }
            else {
                return of(capture);
            }
        };
        var faceBuffer = new CircularBuffer(3);
        var faces = new CircularBuffer(settings.faceCaptureFaceCount);
        var faceDetected = false;
        var faceAlignmentStatus = FaceAlignmentStatus.FOUND;
        var fixTime = null;
        var alignedFaceCount = 0;
        var angleHistory = [];
        var startTime = new Date().getTime();
        const angleBearingEvaluation = new AngleBearingEvaluation(settings, 5, 5);
        var bearingsToCapture = [{
                "bearing": Bearing.STRAIGHT,
                "captured": false
            }];
        var bearingIndex = 0;
        for (let i = 1; i < settings.faceCaptureCount; i++) {
            let candidateBearings = settings.bearings.filter(bearing => {
                return bearing != bearingsToCapture[i - 1].bearing && angleBearingEvaluation.angleForBearing(bearing).yaw != angleBearingEvaluation.angleForBearing(bearingsToCapture[i - 1].bearing).yaw;
            });
            if (candidateBearings.length > 0) {
                bearingsToCapture[i] = {
                    "bearing": candidateBearings[Math.floor(Math.random() * candidateBearings.length)],
                    "captured": false
                };
            }
            else {
                bearingsToCapture[i] = {
                    "bearing": bearingsToCapture[i - 1].bearing,
                    "captured": false
                };
            }
        }
        var faceBoundsSmoothing = new RectSmoothing(3);
        var faceAngleSmoothing = new AngleSmoothing(3);
        function liveFaceCapture() {
            function transferToHeap(arr) {
                const floatArray = Float32Array.from(arr);
                // @ts-ignore
                var heapSpace = Module._malloc(floatArray.length * Float32Array.BYTES_PER_ELEMENT);
                // @ts-ignore
                Module.HEAPF32.set(floatArray, heapSpace >> 2);
                return heapSpace;
            }
            function calculateFacePose(face) {
                var landmarks = [];
                face.landmarks.positions.forEach(position => {
                    landmarks.push(position.x, position.y);
                });
                let arrayOnHeap;
                try {
                    arrayOnHeap = transferToHeap(landmarks);
                    // @ts-ignore
                    Module._calculateFacePose(arrayOnHeap, landmarks.length);
                    // @ts-ignore
                    return new Angle(Module._getYaw(), Module._getPitch() - 7);
                }
                finally {
                    // @ts-ignore
                    Module._free(arrayOnHeap);
                }
            }
            return new Observable(subscriber => {
                if (!navigator.mediaDevices) {
                    subscriber.error(new Error("Unsupported browser"));
                    return;
                }
                var poseCalculationsScriptURL = "/js/PoseCalculations.js";
                var poseCalculationsScript = document.querySelector("script[src=\"" + poseCalculationsScriptURL + "\"]");
                if (!poseCalculationsScript) {
                    poseCalculationsScript = document.createElement("script");
                    poseCalculationsScript.onload = onScriptLoad;
                    // poseCalculationsScript.setAttribute("async", "async")
                    poseCalculationsScript.setAttribute("type", "text/javascript");
                    poseCalculationsScript.src = poseCalculationsScriptURL;
                    document.head.appendChild(poseCalculationsScript);
                }
                else {
                    onScriptLoad();
                }
                var videoTrack;
                function onScriptLoad() {
                    var constraints = navigator.mediaDevices.getSupportedConstraints();
                    var getUserMediaOptions = {
                        "audio": false,
                        "video": true
                    };
                    if (constraints.facingMode) {
                        getUserMediaOptions.video = {
                            "facingMode": settings.useFrontCamera ? "user" : "environment"
                        };
                    }
                    Promise.all([
                        // @ts-ignore
                        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
                        // @ts-ignore
                        faceapi.nets.faceLandmark68Net.loadFromUri("/models")
                    ]).then(function () {
                        return navigator.mediaDevices.getUserMedia(getUserMediaOptions);
                    }).then(function (stream) {
                        videoTrack = stream.getVideoTracks()[0];
                        if (settings.useFrontCamera) {
                            video.style.transform = "scaleX(-1)";
                        }
                        if ("srcObject" in video) {
                            video.srcObject = stream;
                        }
                        else {
                            // @ts-ignore
                            video.src = URL.createObjectURL(stream);
                        }
                        video.onplay = function () {
                            var canvas = document.createElement("canvas");
                            canvas.width = video.videoWidth;
                            canvas.height = video.videoHeight;
                            var ctx = canvas.getContext("2d");
                            function detectSingleFace() {
                                return __awaiter(this, void 0, void 0, function* () {
                                    try {
                                        // @ts-ignore
                                        var _face = yield faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ "inputSize": 128 })).withFaceLandmarks();
                                        var face;
                                        if (_face) {
                                            let angle = calculateFacePose(_face);
                                            var leftEye = _face.landmarks.getLeftEye();
                                            var rightEye = _face.landmarks.getRightEye();
                                            var leftEyeCentre = {
                                                "x": leftEye[0].x + (leftEye[3].x - leftEye[0].x) / 2,
                                                "y": leftEye[0].y + (leftEye[3].y - leftEye[0].y) / 2
                                            };
                                            var rightEyeCentre = {
                                                "x": rightEye[0].x + (rightEye[3].x - rightEye[0].x) / 2,
                                                "y": rightEye[0].y + (rightEye[3].y - rightEye[0].y) / 2
                                            };
                                            var distanceBetweenEyes = Math.sqrt(Math.pow(rightEyeCentre.x - leftEyeCentre.x, 2) + Math.pow(rightEyeCentre.y - leftEyeCentre.y, 2));
                                            var ovalCentre = {
                                                "x": leftEyeCentre.x + (rightEyeCentre.x - leftEyeCentre.x) / 2,
                                                "y": leftEyeCentre.y + (rightEyeCentre.y - leftEyeCentre.y) / 2
                                            };
                                            var ovalSize = {
                                                "width": distanceBetweenEyes * 3,
                                                "height": 0
                                            };
                                            ovalSize.height = ovalSize.width / 4 * 5;
                                            if (settings.useFrontCamera) {
                                                ovalCentre.x = canvas.width - ovalCentre.x;
                                                angle.yaw = 0 - angle.yaw;
                                            }
                                            ovalCentre.y += ovalSize.height * 0.04;
                                            face = new Face(new Rect(ovalCentre.x - ovalSize.width / 2, ovalCentre.y - ovalSize.height / 2, ovalSize.width, ovalSize.height), angle);
                                            if (settings.useFrontCamera) {
                                                face.bounds = face.bounds.mirrored(canvas.width);
                                            }
                                        }
                                        if (!subscriber.isStopped) {
                                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                            var image = new Image();
                                            image.width = canvas.width;
                                            image.height = canvas.height;
                                            image.src = canvas.toDataURL();
                                            subscriber.next(new LiveFaceCapture(image, face));
                                        }
                                        setTimeout(detectSingleFace, 0);
                                    }
                                    catch (error) {
                                        if (!subscriber.isStopped) {
                                            subscriber.error(error);
                                        }
                                    }
                                });
                            }
                            setTimeout(detectSingleFace, 0);
                        };
                    }).catch(function (error) {
                        subscriber.error(error);
                    });
                }
                return () => {
                    if (videoTrack) {
                        videoTrack.stop();
                        videoTrack = null;
                    }
                };
            });
        }
        return liveFaceCapture().pipe(map((capture) => {
            capture.requestedBearing = nextCaptureBearing();
            return capture;
        }), map(detectFacePresence), map(detectFaceAlignment), tap(drawDetectedFace), tap(capture => {
            if (faceDetectionCallback) {
                faceDetectionCallback(capture);
            }
        }), filter(capture => {
            return capture.face && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED;
        }), mergeMap(createFaceCapture), tap(faceCapture => {
            if (faceCaptureCallback) {
                faceCaptureCallback(faceCapture);
            }
        }), take(settings.faceCaptureCount), takeWhile(() => {
            return new Date().getTime() < startTime + settings.maxDuration * 1000;
        }), reduce((acc, one) => {
            acc.faceCaptures.push(one);
            return acc;
        }, new LivenessDetectionSessionResult(new Date(startTime))), map((result) => {
            if (result.faceCaptures.length < settings.faceCaptureCount) {
                throw new Error("Session timed out");
            }
            return result;
        }), (observable) => new Observable(subscriber => {
            var subcription = observable.subscribe((val) => {
                subscriber.next(val);
            }, (err) => {
                subscriber.error(err);
            }, () => {
                subscriber.complete();
            });
            cancelButton.onclick = () => {
                subscriber.complete();
            };
            return () => {
                subcription.unsubscribe();
                if (videoContainer.parentNode) {
                    videoContainer.parentNode.removeChild(videoContainer);
                }
            };
        }));
    }
}
/**
 * Result of a liveness detection session
 */
export class LivenessDetectionSessionResult {
    /**
     * Constructor
     * @param startTime Date that represents the time the session was started
     * @internal
     */
    constructor(startTime) {
        this.startTime = startTime;
        this.faceCaptures = [];
        this.duration = (new Date().getTime() - startTime.getTime()) / 1000;
    }
}
/**
 * Extents of a face within a view
 * @remarks
 * Used by liveness detection session to determine the area where to show the face in relation to the containing view
 */
export class FaceExtents {
    /**
     * Constructor
     * @param proportionOfViewWidth Proportion of view width
     * @param proportionOfViewHeight Proportion of view height
     */
    constructor(proportionOfViewWidth, proportionOfViewHeight) {
        this.proportionOfViewWidth = proportionOfViewWidth;
        this.proportionOfViewHeight = proportionOfViewHeight;
    }
}
/**
 * Face capture settings
 */
export class FaceCaptureSettings {
    constructor() {
        /**
         * Whether to use the device's front-facing (selfie) camera
         * @defaultValue `true`
         */
        this.useFrontCamera = true;
        /**
         * How many face captures should be collected in a session
         * @defaultValue `2`
         */
        this.faceCaptureCount = 2;
        /**
         * Maximum session duration (seconds)
         * @defaultValue `30`
         */
        this.maxDuration = 30;
        /**
         * Horizontal (yaw) threshold where face is considered to be at an angle
         *
         * For example, a value of 15 indicates that a face with yaw -15 and below is oriented left and a face with yaw 15 or above is oriented right
         * @defaultValue `20`
         */
        this.yawThreshold = 20;
        /**
         * Vertical (pitch) threshold where face is considered to be at an angle
         *
         * For example, a value of 15 indicates that a face with pitch -15 and below is oriented up and a face with pitch 15 or above is oriented down
         * @defaultValue `15`
         */
        this.pitchThreshold = 15;
        /**
         * Number of faces to collect per face capture
         * @defaultValue `2`
         */
        this.faceCaptureFaceCount = 2;
        /**
         * When the face is fixed the face detection will pause to allow enough time for the user to read the on-screen instructions
         *
         * Decreasing the pause time will shorten the session but may lead to a frustrating user experience if the user isn't allowed enough time to read the prompts
         * @defaultValue `0.5`
         */
        this.pauseDuration = 0.5;
        /**
         * Where a face is expected in relation to the camera frame
         * @defaultValue `FaceExtents(0.65, 0.85)`
         */
        this.expectedFaceExtents = new FaceExtents(0.65, 0.85);
        /**
         * Bearings the user may be asked to assume during the session
         *
         * Note that the user will unlikely be asked to assume all the bearings in the set. The array is simply a pool from which the session will draw a random member.
         * @defaultValue `[Bearing.STRAIGHT, Bearing.LEFT, Bearing.RIGHT, Bearing.LEFT_UP, Bearing.RIGHT_UP]`
         */
        this.bearings = [Bearing.STRAIGHT, Bearing.LEFT, Bearing.RIGHT, Bearing.LEFT_UP, Bearing.RIGHT_UP];
    }
}
/**
 * Face detected in an image
 */
export class Face {
    /**
     * Constructor
     * @param bounds Bounds
     * @param angle Angle
     * @internal
     */
    constructor(bounds, angle) {
        this.bounds = bounds;
        this.angle = angle;
    }
}
/**
 * Capture of a live face
 */
export class LiveFaceCapture {
    /**
     * Constructor
     * @param image Image in which the face was detected
     * @param face Face or `null` if no face was detected in the image
     * @internal
     */
    constructor(image, face) {
        this._faceImage = null;
        this.image = image;
        this.face = face;
    }
    /**
     * Image cropped to the bounds of the detected face
     */
    get faceImage() {
        if (this._faceImage) {
            return Promise.resolve(this._faceImage);
        }
        return new Promise((resolve, reject) => {
            const drawFaceImage = () => {
                this._faceImage = new Image();
                let canvas = document.createElement("canvas");
                canvas.width = this.face.bounds.width;
                canvas.height = this.face.bounds.height;
                let ctx = canvas.getContext("2d");
                ctx.drawImage(this.image, this.face.bounds.x, this.face.bounds.y, this.face.bounds.width, this.face.bounds.height, 0, 0, this.face.bounds.width, this.face.bounds.height);
                this._faceImage.src = canvas.toDataURL();
                resolve(this._faceImage);
            };
            if (this.image.complete) {
                drawFaceImage();
            }
            else {
                this.image.onload = drawFaceImage;
                this.image.onerror = reject;
            }
        });
    }
}
//# sourceMappingURL=faceDetection.js.map