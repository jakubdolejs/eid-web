var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// @ts-ignore
import { Observable } from "https://dev.jspm.io/rxjs@6/_esm2015";
// @ts-ignore
import * as BlinkIDSDK from "/@microblink/blinkid-in-browser-sdk/es/blinkid-sdk.js";
import { FaceRecognition } from "./faceRecognition.js";
export class IdCapture {
    constructor(serviceURL) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : "";
        this.faceRecognition = new FaceRecognition(this.serviceURL);
    }
    detectIdCard(images) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = yield fetch("/detectIdCard", {
                "method": "POST",
                "mode": "cors",
                "cache": "no-cache",
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": JSON.stringify(images)
            });
            let json = yield response.json();
            var imageSide = json.reduce(function (last, current) {
                if (last.fullDocumentImageBase64) {
                    return last;
                }
                else if (current.fullDocumentImageBase64) {
                    return current;
                }
                else {
                    return null;
                }
            });
            if (imageSide) {
                json.face = yield this.faceRecognition.createRecognizableFace(imageSide.fullDocumentImageBase64);
            }
            return json;
        });
    }
    /**
     *
     * @param settings
     * @returns
     * @experimental
     * @alpha
     */
    captureIdCard(settings) {
        return new Observable(subscriber => {
            if (!BlinkIDSDK.isBrowserSupported()) {
                subscriber.error(new Error("Unsupported browser"));
                return;
            }
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
            cancelButton.onclick = () => {
                subscriber.complete();
            };
            videoContainer.appendChild(video);
            videoContainer.appendChild(cancelButton);
            const loadSettings = new BlinkIDSDK.WasmSDKLoadSettings(settings.licenceKey);
            var wasmSDK, recognizer, recognizerRunner, videoRecognizer;
            BlinkIDSDK.loadWasmModule(loadSettings).then(_wasmSDK => {
                wasmSDK = _wasmSDK;
                return BlinkIDSDK.createBlinkIdRecognizer(wasmSDK);
            }).then(_recognizer => {
                recognizer = _recognizer;
                return BlinkIDSDK.createRecognizerRunner(wasmSDK, [recognizer], true);
            }).then(_recognizerRunner => {
                recognizerRunner = _recognizerRunner;
                return BlinkIDSDK.VideoRecognizer.createVideoRecognizerFromCameraStream(video, recognizerRunner);
            }).then(_videoRecognizer => {
                videoRecognizer = _videoRecognizer;
                return videoRecognizer.recognize();
            }).then(result => {
                if (result !== BlinkIDSDK.RecognizerResultState.Empty) {
                    return recognizer.getResult();
                }
                else {
                    throw new Error("Failed to recognize ID card");
                }
            }).then(recognitionResult => {
                subscriber.next(recognitionResult);
                subscriber.complete();
            }).catch(error => {
                subscriber.error(error);
            });
            return () => {
                if (videoRecognizer) {
                    videoRecognizer.releaseVideoFeed();
                }
                if (recognizerRunner) {
                    recognizerRunner.delete();
                }
                if (recognizer) {
                    recognizer.delete();
                }
                if (videoContainer.parentNode) {
                    videoContainer.parentNode.removeChild(videoContainer);
                }
            };
        });
    }
}
export class IDCaptureSettings {
    constructor(licenceKey) {
        this.licenceKey = licenceKey;
    }
}
//# sourceMappingURL=idCapture.js.map