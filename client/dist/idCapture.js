var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Observable } from "rxjs";
import * as BlinkIDSDK from "@microblink/blinkid-in-browser-sdk/es/blinkid-sdk";
import { FaceRecognition } from "./faceRecognition";
import { Rect } from "./utils";
import { VideoRecognizer, createBlinkIdCombinedRecognizer, createRecognizerRunner, RecognizerResultState, createSuccessFrameGrabberRecognizer, createBlinkIdRecognizer, createIdBarcodeRecognizer } from "@microblink/blinkid-in-browser-sdk";
export var DocumentPages;
(function (DocumentPages) {
    DocumentPages["FRONT"] = "front";
    DocumentPages["BACK"] = "back";
    DocumentPages["FRONT_AND_BACK"] = "front and back";
})(DocumentPages || (DocumentPages = {}));
export class Warning {
    constructor(code, description) {
        this.code = code;
        this.description = description;
    }
}
class IdCaptureUI {
    constructor() {
        this.promptLock = false;
        this.cardAspectRatio = 85.6 / 53.98;
        this.onCancel = null;
        this.videoContainer = this.createVideoContainer();
        document.body.appendChild(this.videoContainer);
        this.video = this.createVideoElement();
        this.cameraOverlayCanvas = this.createCameraOverlayCanvas();
        this.cameraOverlayContext = this.cameraOverlayCanvas.getContext("2d");
        this.cancelButton = this.createCancelButton();
        this.prompt = this.createPromptElement();
        this.videoContainer.appendChild(this.video);
        this.videoContainer.appendChild(this.cameraOverlayCanvas);
        this.videoContainer.appendChild(this.cancelButton);
        this.videoContainer.appendChild(this.prompt);
        this.progressBarContainer = this.createProgressBarContainer();
        this.progressBar = this.createProgressBarElement();
        this.progressBarContainer.appendChild(this.progressBar);
        this.videoContainer.appendChild(this.progressBarContainer);
        this.cancelButton.onclick = () => {
            if (this.onCancel) {
                this.onCancel();
            }
        };
        this.video.onplaying = () => {
            this.drawCardOutline("white");
        };
    }
    createVideoContainer() {
        const videoContainer = document.createElement("div");
        videoContainer.style.position = "fixed";
        videoContainer.style.left = "0px";
        videoContainer.style.top = "0px";
        videoContainer.style.right = "0px";
        videoContainer.style.bottom = "0px";
        videoContainer.style.backgroundColor = "black";
        return videoContainer;
    }
    createVideoElement() {
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
        return video;
    }
    createCameraOverlayCanvas() {
        const cameraOverlayCanvas = document.createElement("canvas");
        cameraOverlayCanvas.style.position = "absolute";
        cameraOverlayCanvas.style.left = "0px";
        cameraOverlayCanvas.style.top = "0px";
        return cameraOverlayCanvas;
    }
    createCancelButton() {
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
        return cancelButton;
    }
    createPromptElement() {
        const prompt = document.createElement("div");
        prompt.style.textShadow = "0px 1px 5px rgba(0, 0, 0, 0.5)";
        prompt.style.fontFamily = "Helvetica, Arial, sans-serif";
        prompt.style.color = "white";
        prompt.style.position = "absolute";
        prompt.style.left = "8px";
        prompt.style.right = "8px";
        prompt.style.top = "16px";
        prompt.style.textAlign = "center";
        return prompt;
    }
    createProgressBarContainer() {
        const progressBarContainer = document.createElement("div");
        progressBarContainer.style.position = "absolute";
        progressBarContainer.style.top = "0px";
        progressBarContainer.style.left = "0px";
        progressBarContainer.style.right = "0px";
        progressBarContainer.style.bottom = "0px";
        progressBarContainer.style.width = "50%";
        progressBarContainer.style.height = "20px";
        progressBarContainer.style.overflow = "hidden";
        progressBarContainer.style.border = "2px solid white";
        progressBarContainer.style.borderRadius = "4px";
        progressBarContainer.style.margin = "auto";
        return progressBarContainer;
    }
    createProgressBarElement() {
        const progressBar = document.createElement("div");
        progressBar.style.position = "absolute";
        progressBar.style.left = "0px";
        progressBar.style.top = "0px";
        progressBar.style.height = "100%";
        progressBar.style.width = "0%";
        progressBar.style.backgroundColor = "white";
        return progressBar;
    }
    drawCardOutline(strokeStyle) {
        const scale = Math.min(this.videoContainer.clientWidth / this.video.videoWidth, this.videoContainer.clientHeight / this.video.videoHeight);
        this.cameraOverlayCanvas.width = this.video.videoWidth * scale;
        this.cameraOverlayCanvas.height = this.video.videoHeight * scale;
        this.cameraOverlayCanvas.style.left = ((this.videoContainer.clientWidth - this.cameraOverlayCanvas.width) / 2) + "px";
        this.cameraOverlayCanvas.style.top = ((this.videoContainer.clientHeight - this.cameraOverlayCanvas.height) / 2) + "px";
        this.cameraOverlayContext.clearRect(0, 0, this.cameraOverlayCanvas.width, this.cameraOverlayCanvas.height);
        const cardSize = { "width": 0, "height": 0 };
        if (this.cameraOverlayCanvas.width / this.cameraOverlayCanvas.height > this.cardAspectRatio) {
            cardSize.height = this.cameraOverlayCanvas.height * 0.85;
            cardSize.width = cardSize.height * this.cardAspectRatio;
        }
        else {
            cardSize.width = this.cameraOverlayCanvas.width * 0.85;
            cardSize.height = cardSize.width / this.cardAspectRatio;
        }
        const cardRect = new Rect(this.cameraOverlayCanvas.width / 2 - cardSize.width / 2, this.cameraOverlayCanvas.height / 2 - cardSize.height / 2, cardSize.width, cardSize.height);
        const cornerRadius = cardRect.width * 0.05;
        const offset = cardRect.height * 0.25;
        this.cameraOverlayContext.strokeStyle = strokeStyle;
        this.cameraOverlayContext.lineWidth = 6;
        this.cameraOverlayContext.beginPath();
        // Top left corner
        this.cameraOverlayContext.moveTo(cardRect.x, cardRect.y + offset);
        this.cameraOverlayContext.arcTo(cardRect.x, cardRect.y, cardRect.x + cornerRadius, cardRect.y, cornerRadius);
        this.cameraOverlayContext.lineTo(cardRect.x + offset, cardRect.y);
        // Top right corner
        this.cameraOverlayContext.moveTo(cardRect.right - offset, cardRect.y);
        this.cameraOverlayContext.arcTo(cardRect.right, cardRect.y, cardRect.right, cardRect.y + offset, cornerRadius);
        this.cameraOverlayContext.lineTo(cardRect.right, cardRect.y + offset);
        // Bottom right corner
        this.cameraOverlayContext.moveTo(cardRect.right, cardRect.bottom - offset);
        this.cameraOverlayContext.arcTo(cardRect.right, cardRect.bottom, cardRect.right - offset, cardRect.bottom, cornerRadius);
        this.cameraOverlayContext.lineTo(cardRect.right - offset, cardRect.bottom);
        // Bottom left corner
        this.cameraOverlayContext.moveTo(cardRect.x + offset, cardRect.bottom);
        this.cameraOverlayContext.arcTo(cardRect.x, cardRect.bottom, cardRect.x, cardRect.bottom - offset, cornerRadius);
        this.cameraOverlayContext.lineTo(cardRect.x, cardRect.bottom - offset);
        this.cameraOverlayContext.stroke();
    }
    setProgress(progress) {
        this.progressBar.style.width = progress + "%";
    }
    showPrompt(text, force = false) {
        if (this.promptLock && !force) {
            return;
        }
        this.promptLock = true;
        this.prompt.innerText = text;
        setTimeout(() => this.promptLock = false, 1000);
    }
    showFlipCardInstruction(onDone) {
        this.showPrompt("Flip the card", true);
        const style = document.createElement("style");
        style.innerText = ".flipped { transform: rotateY(180deg) !important; transition: transform 2s; }";
        document.head.appendChild(style);
        const flipAnimationContainer = document.createElement("div");
        flipAnimationContainer.style.position = "absolute";
        flipAnimationContainer.style.top = "0px";
        flipAnimationContainer.style.right = "0px";
        flipAnimationContainer.style.bottom = "0px";
        flipAnimationContainer.style.left = "0px";
        flipAnimationContainer.style.perspective = "500px";
        const flipAnimation = document.createElement("div");
        flipAnimation.style.position = "absolute";
        flipAnimation.style.top = "0px";
        flipAnimation.style.right = "0px";
        flipAnimation.style.bottom = "0px";
        flipAnimation.style.left = "0px";
        flipAnimation.style.margin = "auto";
        flipAnimation.style.width = "172px";
        flipAnimation.style.height = "108px";
        flipAnimation.style.borderRadius = "6px";
        flipAnimation.style.backgroundColor = "white";
        flipAnimation.style.transform = "rotateY(0deg)";
        flipAnimationContainer.appendChild(flipAnimation);
        this.videoContainer.appendChild(flipAnimationContainer);
        this.cameraOverlayCanvas.style.visibility = "hidden";
        setTimeout(function () {
            flipAnimation.className = "flipped";
        }, 10);
        this.flipTimeout = setTimeout(() => {
            this.videoContainer.removeChild(flipAnimationContainer);
            document.head.removeChild(style);
            this.drawCardOutline("white");
            this.cameraOverlayCanvas.style.visibility = "visible";
            this.flipTimeout = null;
            if (onDone) {
                onDone();
            }
        }, 2000);
    }
    removeProgressBar() {
        if (this.progressBarContainer.parentNode) {
            this.progressBarContainer.parentNode.removeChild(this.progressBarContainer);
        }
    }
    hideCameraOverlay() {
        this.cameraOverlayCanvas.style.visibility = "hidden";
    }
    showCameraOverlay() {
        this.cameraOverlayCanvas.style.visibility = "visible";
    }
    cleanup() {
        clearTimeout(this.flipTimeout);
        if (this.videoContainer.parentNode) {
            this.videoContainer.parentNode.removeChild(this.videoContainer);
        }
    }
    createMetadataCallbacks(onFirstSide) {
        return {
            onQuadDetection: (quad) => {
                switch (quad.detectionStatus) {
                    case BlinkIDSDK.DetectionStatus.Fail:
                        this.showPrompt("Scanning");
                        this.drawCardOutline("white");
                        break;
                    case BlinkIDSDK.DetectionStatus.Success:
                    case BlinkIDSDK.DetectionStatus.FallbackSuccess:
                        this.showPrompt("Hold it");
                        this.drawCardOutline("green");
                        break;
                    case BlinkIDSDK.DetectionStatus.CameraAtAngle:
                        this.showPrompt("Point straight at the ID card");
                        this.drawCardOutline("white");
                        break;
                    case BlinkIDSDK.DetectionStatus.CameraTooHigh:
                        this.showPrompt("Move closer");
                        this.drawCardOutline("white");
                        break;
                    case BlinkIDSDK.DetectionStatus.CameraTooNear:
                    case BlinkIDSDK.DetectionStatus.DocumentTooCloseToEdge:
                    case BlinkIDSDK.DetectionStatus.Partial:
                        this.showPrompt("Move away");
                        this.drawCardOutline("white");
                        break;
                }
            },
            onFirstSideResult: () => {
                this.showFlipCardInstruction();
                if (onFirstSide) {
                    onFirstSide();
                }
            },
            onDetectionFailed: () => {
                this.drawCardOutline("white");
            }
        };
    }
    get progressListener() {
        return (progress) => {
            this.setProgress(progress);
        };
    }
}
export class IdCapture {
    constructor(settings, serviceURL) {
        this.percentLoaded = 0;
        this.loadListeners = new Set();
        this.onLoadProgressCallback = (percentLoaded) => {
            this.percentLoaded = percentLoaded;
            for (let listener of this.loadListeners) {
                listener(percentLoaded);
            }
        };
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : "";
        this.faceRecognition = new FaceRecognition(this.serviceURL);
        const loadSettings = new BlinkIDSDK.WasmSDKLoadSettings(settings.licenceKey);
        loadSettings.engineLocation = location.origin + settings.resourcesPath;
        loadSettings.loadProgressCallback = this.onLoadProgressCallback;
        this.loadBlinkWasmModule = BlinkIDSDK.loadWasmModule(loadSettings);
    }
    registerLoadListener(listener) {
        listener(this.percentLoaded);
        this.loadListeners.add(listener);
    }
    unregisterLoadListener(listener) {
        this.loadListeners.delete(listener);
    }
    createBlinkIdCombinedRecognizer(wasmSDK) {
        return __awaiter(this, void 0, void 0, function* () {
            const recognizer = yield createBlinkIdCombinedRecognizer(wasmSDK);
            const recognizerSettings = yield recognizer.currentSettings();
            recognizerSettings.returnFullDocumentImage = true;
            yield recognizer.updateSettings(recognizerSettings);
            return recognizer;
        });
    }
    createBlinkIdRecognizer(wasmSDK) {
        return __awaiter(this, void 0, void 0, function* () {
            const recognizer = yield createBlinkIdRecognizer(wasmSDK);
            const recognizerSettings = yield recognizer.currentSettings();
            recognizerSettings.returnFullDocumentImage = true;
            yield recognizer.updateSettings(recognizerSettings);
            return recognizer;
        });
    }
    createBarcodeRecognizer(wasmSDK) {
        return __awaiter(this, void 0, void 0, function* () {
            return createIdBarcodeRecognizer(wasmSDK);
        });
    }
    imageDataToImage(imageData, maxSize) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            let scale = Math.min(maxSize / Math.max(imageData.width, imageData.height), 1);
            canvas.width = imageData.width;
            canvas.height = imageData.height;
            const ctx = canvas.getContext("2d");
            ctx.putImageData(imageData, 0, 0);
            const img = new Image();
            img.onload = () => {
                if (scale < 1) {
                    canvas.width = imageData.width * scale;
                    canvas.height = imageData.height * scale;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    img.src = canvas.toDataURL();
                    scale = 1;
                    return;
                }
                resolve(img);
            };
            img.onerror = () => {
                reject(new Error("Failed to read image"));
            };
            img.src = canvas.toDataURL();
        });
    }
    convertToIdCaptureResult(result) {
        return __awaiter(this, void 0, void 0, function* () {
            let imageData = null;
            if (result.result.fullDocumentImage) {
                imageData = result.result.fullDocumentImage.rawImage;
            }
            else if (result.result.fullDocumentFrontImage) {
                imageData = result.result.fullDocumentFrontImage.rawImage;
            }
            const idCaptureResult = {
                "pages": result.pages,
                "result": result.result,
                "face": null
            };
            if (imageData) {
                const img = yield this.imageDataToImage(imageData, 640);
                let face;
                try {
                    face = yield this.faceRecognition.detectRecognizableFace(img, null);
                }
                catch (error) {
                    face = null;
                }
                idCaptureResult.face = face;
            }
            if (result.successFrame) {
                idCaptureResult.capturedImage = {
                    data: result.successFrame.successFrame,
                    orientation: result.successFrame.frameOrientation
                };
            }
            return idCaptureResult;
        });
    }
    runIdCaptureSession(videoRecognizer, recognizers) {
        return new Observable((subscriber) => {
            let emissionCount = 0;
            videoRecognizer.startRecognition((state) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (state == RecognizerResultState.Valid || state == RecognizerResultState.StageValid) {
                        videoRecognizer.pauseRecognition();
                        for (let recognizer of recognizers) {
                            let recognizerName;
                            let result;
                            let successFrameResult;
                            if (recognizer.wrappedRecognizer) {
                                successFrameResult = yield recognizer.getResult();
                                if (successFrameResult.state != RecognizerResultState.Empty) {
                                    result = (yield recognizer.wrappedRecognizer.getResult());
                                    recognizerName = recognizer.wrappedRecognizer.recognizerName;
                                }
                                else {
                                    videoRecognizer.resumeRecognition(false);
                                    return;
                                }
                            }
                            else {
                                result = (yield recognizer.getResult());
                                recognizerName = recognizer.recognizerName;
                            }
                            if (result.state == RecognizerResultState.Valid) {
                                let pages;
                                if (recognizerName == "BlinkIdRecognizer") {
                                    pages = DocumentPages.FRONT;
                                }
                                else if (recognizerName == "IdBarcodeRecognizer") {
                                    pages = DocumentPages.BACK;
                                }
                                else {
                                    pages = DocumentPages.FRONT_AND_BACK;
                                }
                                const combinedResult = {
                                    pages: pages,
                                    result: result
                                };
                                if (successFrameResult) {
                                    combinedResult.successFrame = successFrameResult;
                                }
                                emissionCount++;
                                if (!subscriber.closed) {
                                    subscriber.next(combinedResult);
                                    if (emissionCount == recognizers.length) {
                                        subscriber.complete();
                                    }
                                }
                                return;
                            }
                        }
                        videoRecognizer.resumeRecognition(false);
                    }
                }
                catch (error) {
                    if (!subscriber.closed) {
                        subscriber.error(error);
                    }
                }
            }));
        });
    }
    /**
     * Detect ID card in images
     * @param images Base64-encoded images of the ID card
     * @returns Promise
     */
    detectIdCard(images) {
        return __awaiter(this, void 0, void 0, function* () {
            const body = images;
            const response = yield fetch(this.serviceURL + "/", {
                "method": "POST",
                "mode": "cors",
                "cache": "no-cache",
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": JSON.stringify(body)
            });
            if (response.status != 200) {
                throw new Error("ID card detection failed");
            }
            return response.json();
        });
    }
    emitResult(result, subscriber, complete = true) {
        if (!subscriber.closed) {
            subscriber.next(result);
            if (complete) {
                subscriber.complete();
            }
        }
    }
    getRecognizerRunner(wasmSDK, recognizers) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.recognizerRunner) {
                this.recognizerRunner.reconfigureRecognizers(recognizers, false);
            }
            else {
                this.recognizerRunner = yield createRecognizerRunner(wasmSDK, recognizers, false);
            }
            return this.recognizerRunner;
        });
    }
    createRecognizers(wasmSDK, settings) {
        return __awaiter(this, void 0, void 0, function* () {
            const recognizers = [];
            if (settings.saveCapturedImages) {
                if (settings.pages == DocumentPages.FRONT || settings.pages == DocumentPages.FRONT_AND_BACK) {
                    const blinkRecognizer = yield this.createBlinkIdRecognizer(wasmSDK);
                    recognizers.push(yield createSuccessFrameGrabberRecognizer(wasmSDK, blinkRecognizer));
                }
                if (settings.pages == DocumentPages.BACK || settings.pages == DocumentPages.FRONT_AND_BACK) {
                    const barcodeRecognizer = yield this.createBarcodeRecognizer(wasmSDK);
                    recognizers.push(yield createSuccessFrameGrabberRecognizer(wasmSDK, barcodeRecognizer));
                }
            }
            else if (settings.pages == DocumentPages.FRONT_AND_BACK) {
                recognizers.push(yield this.createBlinkIdCombinedRecognizer(wasmSDK));
            }
            else if (settings.pages == DocumentPages.FRONT) {
                recognizers.push(yield this.createBlinkIdRecognizer(wasmSDK));
            }
            else {
                recognizers.push(yield this.createBarcodeRecognizer(wasmSDK));
            }
            return recognizers;
        });
    }
    /**
     * Capture ID card using the device camera
     * @returns Observable
     */
    captureIdCard(settings) {
        let sessionSubscription;
        return new Observable((subscriber) => {
            if (!BlinkIDSDK.isBrowserSupported()) {
                subscriber.error(new Error("Unsupported browser"));
                return;
            }
            if (!settings) {
                settings = new IdCaptureSessionSettings();
            }
            let videoRecognizer;
            function disposeVideoRecognizer() {
                if (videoRecognizer != null) {
                    videoRecognizer.releaseVideoFeed();
                    videoRecognizer = null;
                }
            }
            function disposeRecognizerRunner() {
                return __awaiter(this, void 0, void 0, function* () {
                    if (recognizerRunner) {
                        yield recognizerRunner.resetRecognizers(true);
                        recognizerRunner = null;
                    }
                });
            }
            let recognizerRunner;
            let recognizers;
            const ui = new IdCaptureUI();
            ui.onCancel = () => {
                subscriber.complete();
            };
            this.registerLoadListener(ui.progressListener);
            this.loadBlinkWasmModule.then((wasmSDK) => __awaiter(this, void 0, void 0, function* () {
                ui.removeProgressBar();
                try {
                    recognizers = yield this.createRecognizers(wasmSDK, settings);
                    recognizerRunner = yield this.getRecognizerRunner(wasmSDK, Object.values(recognizers));
                    yield recognizerRunner.setMetadataCallbacks(ui.createMetadataCallbacks());
                    videoRecognizer = yield VideoRecognizer.createVideoRecognizerFromCameraStream(ui.video, recognizerRunner);
                    ui.showCameraOverlay();
                    let emissionCount = 0;
                    sessionSubscription = this.runIdCaptureSession(videoRecognizer, recognizers).subscribe({
                        next: (combinedResult) => __awaiter(this, void 0, void 0, function* () {
                            try {
                                if (combinedResult.pages != DocumentPages.BACK) {
                                    ui.hideCameraOverlay();
                                    ui.showPrompt("Finding face on document", true);
                                }
                                const result = yield this.convertToIdCaptureResult(combinedResult);
                                if (!subscriber.closed) {
                                    subscriber.next(result);
                                }
                                if (emissionCount++ < recognizers.length - 1) {
                                    ui.showFlipCardInstruction(() => {
                                        ui.showPrompt("", true);
                                        videoRecognizer.resumeRecognition(false);
                                    });
                                }
                                else {
                                    disposeVideoRecognizer();
                                    if (!subscriber.closed) {
                                        subscriber.complete();
                                    }
                                }
                            }
                            catch (error) {
                                if (!subscriber.closed) {
                                    subscriber.error(error);
                                }
                            }
                        }),
                        error: (error) => {
                            disposeVideoRecognizer();
                            if (!subscriber.closed) {
                                subscriber.error(error);
                            }
                        }
                    });
                    sessionSubscription.add(() => {
                        disposeVideoRecognizer();
                        disposeRecognizerRunner();
                    });
                    recognizerRunner = null;
                }
                catch (error) {
                    disposeRecognizerRunner();
                    if (!subscriber.closed) {
                        subscriber.error(error);
                    }
                }
            })).catch(error => {
                ui.removeProgressBar();
                subscriber.error(error);
            }).finally(() => {
                this.unregisterLoadListener(ui.progressListener);
            });
            return () => __awaiter(this, void 0, void 0, function* () {
                if (sessionSubscription) {
                    sessionSubscription.unsubscribe();
                }
                disposeVideoRecognizer();
                disposeRecognizerRunner();
                this.unregisterLoadListener(ui.progressListener);
                ui.cleanup();
            });
        });
    }
}
export class IdCaptureSettings {
    constructor(licenceKey, resourcesPath) {
        this.licenceKey = licenceKey;
        this.resourcesPath = resourcesPath;
    }
}
export class IdCaptureSessionSettings {
    constructor(pages = DocumentPages.FRONT_AND_BACK, saveCapturedImages = false) {
        this.pages = pages;
        this.saveCapturedImages = saveCapturedImages;
    }
}
//# sourceMappingURL=idCapture.js.map