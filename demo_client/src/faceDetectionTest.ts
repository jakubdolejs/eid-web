'use strict';

import { 
    FaceDetection,
    TestFaceDetector,
    TestFaceDetectorFactory,
    MockLivenessDetectionSession,
    LivenessDetectionSessionSettings
} from "../node_modules/@appliedrecognition/ver-id-browser/index.js"


type PageID = "facecapture" | "result" | "error"

(async () => {
    
    const faceDetectorFactory: TestFaceDetectorFactory = new TestFaceDetectorFactory()
    const testFaceDetector: TestFaceDetector = (await faceDetectorFactory.createFaceDetector()) as TestFaceDetector
    const faceDetection = new FaceDetection(null, {"createFaceDetector": () => {
        return Promise.resolve(testFaceDetector)
    }})

    function hideAllPages() {
        document.querySelectorAll(".page").forEach((item: any) => {
            (item as HTMLElement).style.display = "none"
        });
    }

    function showPage(id: PageID) {
        hideAllPages();
        (document.querySelector("#"+id) as HTMLElement).style.display = "block"
    }

    function showError(error?: string) {
        showPage("error");
        const reason: HTMLElement = document.querySelector("#error .reason")
        if (error) {
            reason.innerText = error
            reason.style.display = "block"
        } else {
            reason.innerText = ""
            reason.style.display = "none"
        }
    }

    const onStart = () => {
        showPage("facecapture")
        const settings = new LivenessDetectionSessionSettings()
        if (window["options"]) {
            for (const opt in window["options"]) {
                if (opt in settings) {
                    settings[opt] = window["options"][opt]
                }
            }
        }
        settings.useFrontCamera = false
        const session = new MockLivenessDetectionSession(settings)
        session.faceDetector = testFaceDetector
        session.registerFaceRequirementListener(testFaceDetector)
        faceDetection.captureFaces(session).subscribe({
            next: (result) => {
                showPage("result")
                if (result.faceCaptures.length > 0) {
                    const img: HTMLImageElement = document.querySelector("#result img")
                    img.src = URL.createObjectURL(result.faceCaptures[0].faceImage)
                    img.decode().then(() => {
                        img.style.display = "inline-block"
                    }).catch(() => {
                        img.style.display = "none"
                    }).finally(() => {
                        URL.revokeObjectURL(img.src)
                    })
                }
            },
            error: (error: any) => {
                let text = "Face capture failed"
                if (error && (error as Error).message) {
                    text += ": "+error.message
                } else if (error && typeof error == "string") {
                    text += ": "+error
                }
                showError(text)
            }
        })
    }

    document.querySelectorAll("a.start").forEach((button: HTMLAnchorElement) => {
        button.onclick = onStart;
    });

    showPage("facecapture")
})()