/**
 * Ver-ID face detection
 * @packageDocumentation
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Observable, from, of, throwError } from "rxjs";
import { map, filter, take, takeWhile, tap, mergeMap, toArray } from "rxjs/operators";
import { CircularBuffer, AngleBearingEvaluation, Angle, Rect, Axis, RectSmoothing, AngleSmoothing, Point } from "./utils";
import { FaceRecognition } from "./faceRecognition";
import * as faceapi from "face-api.js/build/es6";
import { estimateFaceAngle } from "./faceAngle";
import { estimateFaceAngle as estimateFaceAngleNoseTip } from "./faceAngleNoseTip";
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
        this.loadPromises = [
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models")
        ];
    }
    calculateFaceAngle(face) {
        const landmarks = face.landmarks.positions.map(pt => new Point(pt.x, pt.y));
        return estimateFaceAngle(landmarks, estimateFaceAngleNoseTip);
    }
    faceApiFaceToVerIDFace(face, imageWidth, mirrorOutput = false) {
        const angle = this.calculateFaceAngle(face);
        const leftEye = face.landmarks.getLeftEye();
        const rightEye = face.landmarks.getRightEye();
        const leftEyeCentre = {
            "x": leftEye[0].x + (leftEye[3].x - leftEye[0].x) / 2,
            "y": leftEye[0].y + (leftEye[3].y - leftEye[0].y) / 2
        };
        const rightEyeCentre = {
            "x": rightEye[0].x + (rightEye[3].x - rightEye[0].x) / 2,
            "y": rightEye[0].y + (rightEye[3].y - rightEye[0].y) / 2
        };
        const distanceBetweenEyes = Math.sqrt(Math.pow(rightEyeCentre.x - leftEyeCentre.x, 2) + Math.pow(rightEyeCentre.y - leftEyeCentre.y, 2));
        const ovalCentre = {
            "x": leftEyeCentre.x + (rightEyeCentre.x - leftEyeCentre.x) / 2,
            "y": leftEyeCentre.y + (rightEyeCentre.y - leftEyeCentre.y) / 2
        };
        const ovalSize = {
            "width": distanceBetweenEyes * 3,
            "height": 0
        };
        ovalSize.height = ovalSize.width / 4 * 5;
        if (mirrorOutput) {
            ovalCentre.x = imageWidth - ovalCentre.x;
            angle.yaw = 0 - angle.yaw;
        }
        ovalCentre.y += ovalSize.height * 0.04;
        const veridFace = new Face(new Rect(ovalCentre.x - ovalSize.width / 2, ovalCentre.y - ovalSize.height / 2, ovalSize.width, ovalSize.height), angle);
        if (mirrorOutput) {
            veridFace.bounds = veridFace.bounds.mirrored(imageWidth);
        }
        return veridFace;
    }
    detectFaceInImage(image) {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all(this.loadPromises);
            const face = yield faceapi.detectSingleFace(image, new faceapi.TinyFaceDetectorOptions({ "inputSize": 128 })).withFaceLandmarks();
            if (face) {
                return this.faceApiFaceToVerIDFace(face, image.naturalWidth);
            }
            throw new Error("Face not found");
        });
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
        const faceDetection = this;
        if (location.protocol != "https:") {
            return throwError(new Error("Liveness detection is only supported on secure connections (https)"));
        }
        if (!FaceDetection.isLivenessDetectionSupported()) {
            return throwError(new Error("Liveness detection is not supported by your browser"));
        }
        if (!settings) {
            settings = new FaceCaptureSettings();
        }
        function isFaceFixedInImageSize(actualFaceBounds, expectedFaceBounds) {
            return true;
            // const maxRect: Rect = new Rect(expectedFaceBounds.x, expectedFaceBounds.y, expectedFaceBounds.width, expectedFaceBounds.height)
            // maxRect.inset(0-expectedFaceBounds.width*0.3, 0-expectedFaceBounds.height*0.3)
            // const minRect: Rect = new Rect(expectedFaceBounds.x, expectedFaceBounds.y, expectedFaceBounds.width, expectedFaceBounds.height)
            // minRect.inset(expectedFaceBounds.width * 0.4, expectedFaceBounds.height * 0.4)
            // return actualFaceBounds.contains(minRect) && maxRect.contains(actualFaceBounds)
        }
        const cameraOverlayCanvas = document.createElement("canvas");
        cameraOverlayCanvas.style.position = "absolute";
        cameraOverlayCanvas.style.left = "0px";
        cameraOverlayCanvas.style.top = "0px";
        const cameraOverlayContext = cameraOverlayCanvas.getContext("2d");
        const videoContainer = document.createElement("div");
        videoContainer.style.position = "fixed";
        videoContainer.style.left = "0px";
        videoContainer.style.top = "0px";
        videoContainer.style.right = "0px";
        videoContainer.style.bottom = "0px";
        videoContainer.style.backgroundColor = "black";
        document.body.appendChild(videoContainer);
        const video = document.createElement("video");
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
        const cancelButton = document.createElement("a");
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
        let previousBearing = Bearing.STRAIGHT;
        function* nextCaptureBearing() {
            let lastBearing = Bearing.STRAIGHT;
            yield lastBearing;
            for (let i = 1; i < settings.faceCaptureCount; i++) {
                previousBearing = lastBearing;
                let availableBearings = settings.bearings.filter(bearing => bearing != lastBearing && angleBearingEvaluation.angleForBearing(bearing).yaw != angleBearingEvaluation.angleForBearing(lastBearing).yaw);
                if (availableBearings.length == 0) {
                    availableBearings = settings.bearings.filter(bearing => bearing != lastBearing);
                }
                if (availableBearings.length > 0) {
                    lastBearing = availableBearings[Math.floor(Math.random() * availableBearings.length)];
                }
                if (i < settings.faceCaptureCount - 1) {
                    yield lastBearing;
                }
                else {
                    return lastBearing;
                }
            }
        }
        const drawDetectedFace = (capture) => {
            const scale = Math.min(videoContainer.clientWidth / capture.image.width, videoContainer.clientHeight / capture.image.height);
            cameraOverlayCanvas.width = capture.image.width * scale;
            cameraOverlayCanvas.height = capture.image.height * scale;
            cameraOverlayCanvas.style.left = ((videoContainer.clientWidth - cameraOverlayCanvas.width) / 2) + "px";
            cameraOverlayCanvas.style.top = ((videoContainer.clientHeight - cameraOverlayCanvas.height) / 2) + "px";
            cameraOverlayContext.clearRect(0, 0, cameraOverlayCanvas.width, cameraOverlayCanvas.height);
            let ovalColor;
            let textColor;
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
            let faceRect;
            if (capture.faceBounds) {
                faceRect = capture.faceBounds.scaledBy(scale);
                if (settings.useFrontCamera) {
                    faceRect = faceRect.mirrored(capture.image.width * scale);
                }
                cameraOverlayContext.lineWidth = 0.038 * faceRect.width;
                cameraOverlayContext.beginPath();
                cameraOverlayContext.ellipse(faceRect.x + faceRect.width / 2, faceRect.y + faceRect.height / 2, faceRect.width / 2, faceRect.height / 2, 0, 0, Math.PI * 2);
                if (capture.offsetAngleFromBearing) {
                    const angle = Math.atan2(capture.offsetAngleFromBearing.pitch, capture.offsetAngleFromBearing.yaw);
                    const distance = Math.hypot(capture.offsetAngleFromBearing.yaw, 0 - capture.offsetAngleFromBearing.pitch) * 2 * 1.7;
                    const arrowLength = faceRect.width / 5;
                    const arrowStemLength = Math.min(Math.max(arrowLength * distance, arrowLength * 0.75), arrowLength * 1.7);
                    const arrowAngle = 40 * (Math.PI / 180);
                    const arrowTipX = faceRect.center.x + Math.cos(angle) * arrowLength / 2;
                    const arrowTipY = faceRect.center.y + Math.sin(angle) * arrowLength / 2;
                    const arrowPoint1X = arrowTipX + Math.cos(angle + Math.PI - arrowAngle) * arrowLength * 0.6;
                    const arrowPoint1Y = arrowTipY + Math.sin(angle + Math.PI - arrowAngle) * arrowLength * 0.6;
                    const arrowPoint2X = arrowTipX + Math.cos(angle + Math.PI + arrowAngle) * arrowLength * 0.6;
                    const arrowPoint2Y = arrowTipY + Math.sin(angle + Math.PI + arrowAngle) * arrowLength * 0.6;
                    const arrowStartX = arrowTipX + Math.cos(angle + Math.PI) * arrowStemLength;
                    const arrowStartY = arrowTipY + Math.sin(angle + Math.PI) * arrowStemLength;
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
            let prompt;
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
            const textSize = 24;
            const textY = Math.max(faceRect.y - cameraOverlayContext.lineWidth * 2, textSize);
            cameraOverlayContext.font = textSize + "px Helvetica, Arial, sans-serif";
            cameraOverlayContext.textAlign = "center";
            const textWidth = cameraOverlayContext.measureText(prompt).width;
            const cornerRadius = 8;
            const textRect = new Rect(cameraOverlayCanvas.width / 2 - textWidth / 2 - cornerRadius, textY - textSize, textWidth + cornerRadius * 2, textSize + cornerRadius);
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
                faceDetected = false;
                faceBoundsSmoothing.removeFirstSample();
                faceAngleSmoothing.removeFirstSample();
                const lastFace = faceBuffer.lastElement;
                if (lastFace != null) {
                    const requestedAngle = angleBearingEvaluation.angleForBearing(bearingIterator.value).screenAngle;
                    const detectedAngle = lastFace.angle.screenAngle;
                    const deg45 = 45 * (Math.PI / 180);
                    const inset = Math.min(capture.image.width, capture.image.height) * 0.05;
                    const rect = new Rect(0, 0, capture.image.width, capture.image.height);
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
                const face = faceBuffer.lastElement;
                if (face != null) {
                    const now = new Date().getTime() / 1000;
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
                            const f = faces.get(i);
                            if (!angleBearingEvaluation.angleMatchesBearing(f.angle, bearingIterator.value)) {
                                faceAlignmentStatus = FaceAlignmentStatus.MISALIGNED;
                                capture.faceAlignmentStatus = faceAlignmentStatus;
                                capture.offsetAngleFromBearing = angleBearingEvaluation.offsetFromAngleToBearing(capture.faceAngle ? capture.faceAngle : new Angle(), bearingIterator.value);
                                return capture;
                            }
                        }
                        faces.clear();
                        faceAlignmentStatus = FaceAlignmentStatus.ALIGNED;
                        fixTime = now;
                        alignedFaceCount += 1;
                        bearingIterator = bearingGenerator.next();
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
            const face = faceBuffer.lastElement;
            if (!capture.isFacePresent || !face) {
                angleHistory = [];
                return capture;
            }
            if (capture.faceAlignmentStatus != FaceAlignmentStatus.ALIGNED) {
                angleHistory.push(face.angle);
                return capture;
            }
            if (previousBearing != bearingIterator.value) {
                const previousAngle = angleBearingEvaluation.angleForBearing(previousBearing);
                const currentAngle = angleBearingEvaluation.angleForBearing(bearingIterator.value);
                const startYaw = Math.min(previousAngle.yaw, currentAngle.yaw);
                const endYaw = Math.max(previousAngle.yaw, currentAngle.yaw);
                const yawTolerance = angleBearingEvaluation.thresholdAngleToleranceForAxis(Axis.YAW);
                let movedTooFast = angleHistory.length > 1;
                let movedOpposite = false;
                for (let angle of angleHistory) {
                    if (angle.yaw > startYaw - yawTolerance && angle.yaw < endYaw + yawTolerance) {
                        movedTooFast = false;
                    }
                    if (!angleBearingEvaluation.isAngleBetweenBearings(angle, previousBearing, bearingIterator.value)) {
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
                const bounds = capture.face ? capture.face.bounds : null;
                return from(this.faceRecognition.detectRecognizableFace(capture.image, bounds).then(recognizableFace => {
                    capture.face.template = recognizableFace.template;
                    return capture;
                }));
            }
            else {
                return of(capture);
            }
        };
        const resultFromCaptures = (captures) => {
            return new LivenessDetectionSessionResult(new Date(startTime), captures);
        };
        const faceBuffer = new CircularBuffer(3);
        const faces = new CircularBuffer(settings.faceCaptureFaceCount);
        let faceDetected = false;
        let faceAlignmentStatus = FaceAlignmentStatus.FOUND;
        let fixTime = null;
        let alignedFaceCount = 0;
        let angleHistory = [];
        const startTime = new Date().getTime();
        const angleBearingEvaluation = new AngleBearingEvaluation(settings, 5, 5);
        const faceBoundsSmoothing = new RectSmoothing(3);
        const faceAngleSmoothing = new AngleSmoothing(3);
        function liveFaceCapture() {
            return new Observable(subscriber => {
                if (!navigator.mediaDevices) {
                    subscriber.error(new Error("Unsupported browser"));
                    return;
                }
                let videoTrack;
                const constraints = navigator.mediaDevices.getSupportedConstraints();
                const getUserMediaOptions = {
                    "audio": false,
                    "video": true
                };
                if (constraints.facingMode) {
                    getUserMediaOptions.video = {
                        "facingMode": settings.useFrontCamera ? "user" : "environment"
                    };
                }
                if (constraints.width) {
                    const videoWidth = 480;
                    if (typeof (getUserMediaOptions.video) === "boolean") {
                        getUserMediaOptions.video = {
                            "width": videoWidth
                        };
                    }
                    else {
                        getUserMediaOptions.video.width = videoWidth;
                    }
                }
                Promise.all(faceDetection.loadPromises).then(() => {
                    return navigator.mediaDevices.getUserMedia(getUserMediaOptions);
                }).then((stream) => {
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
                    video.onplay = () => {
                        const canvas = document.createElement("canvas");
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                        const ctx = canvas.getContext("2d");
                        const detectSingleFace = () => __awaiter(this, void 0, void 0, function* () {
                            try {
                                const _face = yield faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ "inputSize": 128 })).withFaceLandmarks();
                                let face;
                                if (_face) {
                                    face = faceDetection.faceApiFaceToVerIDFace(_face, canvas.width, settings.useFrontCamera);
                                }
                                if (!subscriber.closed) {
                                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                    const image = new Image();
                                    image.width = canvas.width;
                                    image.height = canvas.height;
                                    image.src = canvas.toDataURL();
                                    subscriber.next(new LiveFaceCapture(image, face));
                                }
                                setTimeout(detectSingleFace, 0);
                            }
                            catch (error) {
                                if (!subscriber.closed) {
                                    subscriber.error(error);
                                }
                            }
                        });
                        setTimeout(detectSingleFace, 0);
                    };
                }).catch((error) => {
                    subscriber.error(error);
                });
                return () => {
                    if (videoTrack) {
                        videoTrack.stop();
                        videoTrack = null;
                    }
                };
            });
        }
        let bearingGenerator = nextCaptureBearing();
        let bearingIterator = bearingGenerator.next();
        return (liveFaceCapture().pipe(map((capture) => {
            capture.requestedBearing = bearingIterator.value;
            return capture;
        }), map(detectFacePresence), map(detectFaceAlignment), tap(drawDetectedFace), tap((capture) => {
            if (faceDetectionCallback) {
                faceDetectionCallback(capture);
            }
        }), filter((capture) => {
            return capture.face && capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED;
        }), mergeMap(createFaceCapture), tap((faceCapture) => {
            if (faceCaptureCallback) {
                faceCaptureCallback(faceCapture);
            }
        }), take(settings.faceCaptureCount), takeWhile(() => {
            return new Date().getTime() < startTime + settings.maxDuration * 1000;
        }), toArray(), map(resultFromCaptures), map((result) => {
            if (result.faceCaptures.length < settings.faceCaptureCount) {
                throw new Error("Session timed out");
            }
            return result;
        }), (observable) => new Observable(subscriber => {
            const subcription = observable.subscribe((val) => {
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
        })));
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
    constructor(startTime, faceCaptures) {
        this.startTime = startTime;
        this.faceCaptures = faceCaptures ? faceCaptures : [];
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