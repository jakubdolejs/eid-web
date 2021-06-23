import { FaceDetection, TestFaceDetector, MockLivenessDetectionSession, LivenessDetectionSessionSettings } from "../node_modules/@appliedrecognition/ver-id-browser/index.js";
const setup = (config) => {
    const testFaceDetector = new TestFaceDetector();
    const faceDetectorFactory = {
        createFaceDetector: () => {
            return Promise.resolve(testFaceDetector);
        }
    };
    const faceDetection = new FaceDetection(config.serverURL, faceDetectorFactory);
    function hideAllPages() {
        document.querySelectorAll(".page").forEach(item => {
            item.style.display = "none";
        });
    }
    function showPage(id) {
        hideAllPages();
        document.querySelector("#" + id).style.display = "block";
    }
    function showError(error) {
        showPage("error");
        const reason = document.querySelector("#error .reason");
        if (error) {
            reason.innerText = error;
            reason.style.display = "block";
        }
        else {
            reason.innerText = "";
            reason.style.display = "none";
        }
    }
    const onStart = () => {
        showPage("facecapture");
        const settings = new LivenessDetectionSessionSettings();
        settings.useFrontCamera = false;
        const session = new MockLivenessDetectionSession(settings);
        session.faceDetector = testFaceDetector;
        faceDetection.captureFaces(session).subscribe({
            next: (result) => {
                showPage("result");
                if (result.faceCaptures.length > 0) {
                    const img = document.querySelector("#result img");
                    result.faceCaptures[0].faceImage.then(image => {
                        img.style.display = "inline-block";
                        img.src = image.src;
                    }).catch(error => {
                        img.style.display = "none";
                    });
                }
            },
            error: (error) => {
                let text = "Face capture failed";
                if (error && error.message) {
                    text += ": " + error.message;
                }
                else if (error && typeof error == "string") {
                    text += ": " + error;
                }
                showError(text);
            }
        });
    };
    document.querySelectorAll("a.start").forEach((button) => {
        button.onclick = onStart;
    });
    showPage("facecapture");
};
window.onload = () => {
    fetch("/config.json").then(response => {
        return response.json();
    }).then((config) => {
        setup(config);
    }).catch(error => {
        alert("Failed to read configuration file");
    });
};
//# sourceMappingURL=faceDetectionTest.js.map