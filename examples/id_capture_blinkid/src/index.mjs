import * as BlinkIDSDK from "@microblink/blinkid-in-browser-sdk";

document.addEventListener("DOMContentLoaded", async () => {
    const captureButton = document.querySelector("#capture");
    const progressBarContainer = document.getElementById("loading_progress");
    const progressBar = document.querySelector("#loading_progress div");
    const feedback = document.getElementById("message");
    const cameraFeed = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const canvasContext = document.getElementById("canvas").getContext("2d");
    const captureContainer = document.getElementById("capture_container");
    const resultContainer = document.getElementById("result");
    const resultCanvas = document.querySelector("#result canvas");

    async function loadBlinkID() {
        if (!BlinkIDSDK.isBrowserSupported()) {
            throw new Error("This browser is not supported")
        }

        // 1. It's possible to obtain a free trial license key on microblink.com
        const licenseKey = await getBlinkIdLicenceKey();

        // 2. Create instance of SDK load settings with your license key
        const loadSettings = new BlinkIDSDK.WasmSDKLoadSettings(licenseKey);

        // [OPTIONAL] Change default settings

        // Show or hide hello message in browser console when WASM is successfully loaded
        loadSettings.allowHelloMessage = true;

        // In order to provide better UX, display progress bar while loading the SDK
        loadSettings.loadProgressCallback = setLoadProgress;

        // Set absolute location of the engine, i.e. WASM and support JS files
        loadSettings.engineLocation = window.location.origin + '/node_modules/@microblink/blinkid-in-browser-sdk/resources';

        // Set absolute location of the worker file
        loadSettings.workerLocation = window.location.origin + "/node_modules/@microblink/blinkid-in-browser-sdk/resources/BlinkIDWasmSDK.worker.min.js";

        // 3. Load SDK
        const sdk = await BlinkIDSDK.loadWasmModule(loadSettings);
        progressBarContainer.style.display = "none";
        return sdk;
    }

    async function startCapture(sdk) {
        captureContainer.style.display = "block";
        const multiSideGenericIDRecognizer = await BlinkIDSDK.createBlinkIdMultiSideRecognizer(sdk);
        const recognizerSettings = await multiSideGenericIDRecognizer.currentSettings()
        recognizerSettings.returnFullDocumentImage = true
        recognizerSettings.fullDocumentImageDpi = 600
        await multiSideGenericIDRecognizer.updateSettings(recognizerSettings)
        let showingFlipMessage = false;

        // Create a callbacks object that will receive recognition events, such as detected object location etc.
        const callbacks = {
            onQuadDetection: quad => {
                if (!showingFlipMessage) {
                    updateMessage(quad);
                }
            },
            onDetectionFailed: () => {}, //updateScanFeedback("Detection failed", true),

            // This callback is required for multi-side experience.
            onFirstSideResult: () => {
                clearCanvas();
                videoRecognizer?.pauseRecognition();
                showingFlipMessage = true;
                updateScanFeedback("Flip the document")
                setTimeout(() => {
                    showingFlipMessage = false;
                    videoRecognizer?.resumeRecognition();
                }, 2000);
            }
        };

        // 2. Create a RecognizerRunner object which orchestrates the recognition with one or more

        //    recognizer objects.
        const recognizerRunner = await BlinkIDSDK.createRecognizerRunner(sdk, [multiSideGenericIDRecognizer], false, callbacks);

        // 3. Create a VideoRecognizer object and attach it to HTMLVideoElement that will be used for displaying the camera feed
        const videoRecognizer = await BlinkIDSDK.VideoRecognizer.createVideoRecognizerFromCameraStream(cameraFeed, recognizerRunner);

        // 4. Start the recognition and get results from callback
        try {
            videoRecognizer.startRecognition(

            // 5. Obtain the results
            async (recognitionState) => {
                if (!videoRecognizer) {
                    return;
                }

                // Pause recognition before performing any async operation
                videoRecognizer.pauseRecognition();
                if (recognitionState === BlinkIDSDK.RecognizerResultState.Empty) {
                    return;
                }
                const result = await multiSideGenericIDRecognizer.getResult();
                if (result.state === BlinkIDSDK.RecognizerResultState.Empty) {
                    return;
                }

                // Inform the user about results
                console.log("BlinkID Multi-side recognizer results", result);
                
                const frontImageData = result.fullDocumentFrontImage?.rawImage;
                if (frontImageData) {
                    resultCanvas.width = frontImageData.width;
                    resultCanvas.height = frontImageData.height;
                    const frontImageCanvasContext = resultCanvas.getContext("2d");
                    frontImageCanvasContext.putImageData(frontImageData, 0, 0);
                    resultContainer.style.visibility = "visible";
                    updateScanFeedback("Capture finished");
                }

                // 6. Release all resources allocated on the WebAssembly heap and associated with camera stream

                // Release browser resources associated with the camera stream
                videoRecognizer?.releaseVideoFeed();

                // Release memory on WebAssembly heap used by the RecognizerRunner
                recognizerRunner?.delete();

                // Release memory on WebAssembly heap used by the recognizer
                multiSideGenericIDRecognizer?.delete();

                clearCanvas();
            });
        }
        catch (error) {
            console.error("Error during initialization of VideoRecognizer:", error);
            return;
        }
    }

    async function getBlinkIdLicenceKey() {
        const response = await fetch("config.json")
        const config = await response.json();
        return config.blinkIDLicenceKey;
    }

    function setLoadProgress(progress) {
        progressBar.style.width = `${progress}%`;
        progressBarContainer.style.display = progress < 100 && progress > 0 ? "block" : "none";
    }

    function clearCanvas() {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
        canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    }

    function updateScanFeedback(message, isError = false) {
        feedback.textContent = message;
        feedback.style.backgroundColor = isError ? "red" : "black";
    }

    function updateMessage(displayable) {
        let color = "#FF0000FF"
        switch (displayable.detectionStatus) {
            case BlinkIDSDK.DetectionStatus.Failed:
                updateScanFeedback("Scanning...");
                break;
            case BlinkIDSDK.DetectionStatus.Success:
            case BlinkIDSDK.DetectionStatus.FallbackSuccess:
                updateScanFeedback("Detection successful");
                color = "#00FF00FF";
                break;
            case BlinkIDSDK.DetectionStatus.CameraAngleTooSteep:
                updateScanFeedback("Adjust the angle");
                color = "#FFFF00FF";
                break;
            case BlinkIDSDK.DetectionStatus.CameraTooFar:
                updateScanFeedback("Move document closer");
                color = "#FFFF00FF";
                break;
            case BlinkIDSDK.DetectionStatus.CameraTooClose:
            case BlinkIDSDK.DetectionStatus.DocumentTooCloseToCameraEdge:
            case BlinkIDSDK.DetectionStatus.DocumentPartiallyVisible:
                updateScanFeedback("Move document farther");
                color = "#FFFF00FF";
                break;
            default:
                console.warn("Unhandled detection status!", displayable.detectionStatus);
        }
        clearCanvas();
        canvasContext.fillStyle = color;
        canvasContext.strokeStyle = color;
        canvasContext.lineWidth = 5;
        applyTransform(displayable.transformMatrix);
        canvasContext.beginPath();
        canvasContext.moveTo(displayable.topLeft.x, displayable.topLeft.y);
        canvasContext.lineTo(displayable.topRight.x, displayable.topRight.y);
        canvasContext.lineTo(displayable.bottomRight.x, displayable.bottomRight.y);
        canvasContext.lineTo(displayable.bottomLeft.x, displayable.bottomLeft.y);
        canvasContext.closePath();
        canvasContext.stroke();
    }

    function applyTransform(transformMatrix) {
        const canvasAR = canvas.width / canvas.height;
        const videoAR = cameraFeed.videoWidth / cameraFeed.videoHeight;
        let xOffset = 0;
        let yOffset = 0;
        let scaledVideoHeight = 0;
        let scaledVideoWidth = 0;
        if (canvasAR > videoAR) {

            // pillarboxing: https://en.wikipedia.org/wiki/Pillarbox
            scaledVideoHeight = canvas.height;
            scaledVideoWidth = videoAR * scaledVideoHeight;
            xOffset = (canvas.width - scaledVideoWidth) / 2;
        } else {

            // letterboxing: https://en.wikipedia.org/wiki/Letterboxing_(filming)
            scaledVideoWidth = canvas.width;
            scaledVideoHeight = scaledVideoWidth / videoAR;
            yOffset = (canvas.height - scaledVideoHeight) / 2;
        }

        // first transform canvas for offset of video preview within the HTML video element (i.e. correct letterboxing or pillarboxing)
        canvasContext.translate(xOffset, yOffset);

        // second, scale the canvas to fit the scaled video
        canvasContext.scale(scaledVideoWidth / cameraFeed.videoWidth, scaledVideoHeight / cameraFeed.videoHeight);

        // finally, apply transformation from image coordinate system to

        // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setTransform
        canvasContext.transform(transformMatrix[0], transformMatrix[3], transformMatrix[1], transformMatrix[4], transformMatrix[2], transformMatrix[5]);
    }


    try {
        captureButton.style.display = "none";
        const sdk = await loadBlinkID();
        captureButton.removeAttribute("disabled");
        captureButton.style.display = "inline-block";
        captureButton.onclick = async () => {
            startCapture(sdk);
        }
    } catch (error) {
        alert("Failed to load ID capture");
    }
});