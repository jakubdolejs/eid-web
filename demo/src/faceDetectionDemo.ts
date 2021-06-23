import { 
    FaceDetection, LivenessDetectionSession, LivenessDetectionSessionSettings
} from "../node_modules/@appliedrecognition/ver-id-browser/index.js"

type DemoConfiguration = {serverURL: string}

type PageID = "facecapture" | "result" | "error"

const setup = (config: DemoConfiguration) => {
    const faceDetection = new FaceDetection(config.serverURL)

    function hideAllPages() {
        document.querySelectorAll(".page").forEach(item => {
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
        faceDetection.captureFaces(new LivenessDetectionSession()).subscribe({
            next: (result) => {
                showPage("result")
                if (result.faceCaptures.length > 0) {
                    const img: HTMLImageElement = document.querySelector("#result img")
                    result.faceCaptures[0].faceImage.then(image => {
                        img.style.display = "inline-block"
                        img.src = image.src
                    }).catch(error => {
                        img.style.display = "none"
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
}

window.onload = () => {
    fetch("/config.json").then(response => {
        return response.json()
    }).then((config: DemoConfiguration) => {
        setup(config)
    }).catch(error => {
        alert("Failed to read configuration file")
    })
}