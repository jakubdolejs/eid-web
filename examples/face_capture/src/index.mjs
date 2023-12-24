import * as VerID from "@appliedrecognition/ver-id-browser";
        
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const captureButton = document.querySelector("#capture");
        const configResponse = await fetch("/config.json", {"cache": "no-cache"});
        const config = await configResponse.json();
        const faceRecognition = new VerID.FaceRecognition(config.serviceURL);
        const faceDetection = new VerID.FaceDetection(config.serviceURL);
        const settings = new VerID.LivenessDetectionSessionSettings();
        settings.faceCaptureCount = 1;
        captureButton.removeAttribute("disabled");
        captureButton.addEventListener("click", () => {
            document.querySelector("#result .liveFace").innerHTML = ""
            document.querySelector("#result .template").innerHTML = ""
            document.querySelector("#result").style.display = "none"
            faceDetection.captureFaces(new VerID.LivenessDetectionSession(settings, faceRecognition)).subscribe({
                next: (result) => {
                    const img = document.createElement("img")
                    img.src = URL.createObjectURL(result.faceCaptures[0].faceImage)
                    img.decode().then(() => {
                        document.querySelector("#result .liveFace").innerHTML = ""
                        document.querySelector("#result .template").innerHTML = ""
                        document.querySelector("#result .liveFace").appendChild(img)
                        document.querySelector("#result .template").innerText = result.faceCaptures[0].face.template
                        document.querySelector("#result").style.display = "block"
                    }).catch((error) => {
                        alert("Failed to decode face image")
                    }).finally(() => {
                        URL.revokeObjectURL(img.src)
                    })
                },
                error: (error) => {
                    alert(`Face capture failed: ${error}`)
                }
            })
        })
    } catch (error) {
        alert("Failed to configure Ver-ID face detection");
    }
});