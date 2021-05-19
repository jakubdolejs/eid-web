import { FaceDetection, IdCapture, IdCaptureSettings, IdCaptureResult, FaceRecognition, QRCodeGenerator, NormalDistribution, Rect } from "../node_modules/@appliedrecognition/ver-id-browser/index.js"

type DemoConfiguration = {licenceKey: string, serverURL: string}

function setup(config: DemoConfiguration) {
    const settings = new IdCaptureSettings(config.licenceKey, "/node_modules/@appliedrecognition/ver-id-browser/resources/")
    const faceDetection = new FaceDetection(config.serverURL)
    const idCapture = new IdCapture(settings, config.serverURL)
    const faceRecognition = new FaceRecognition(config.serverURL)
    const scoreThreshold = 3.0

    let idCaptureResult: IdCaptureResult;

    function hideAllPages() {
        document.querySelectorAll(".page").forEach(item => {
            (item as HTMLElement).style.display = "none"
        });
    }

    function showPage(id: string) {
        hideAllPages();
        document.getElementById("background").className = id;
        (document.querySelector("#"+id) as HTMLElement).style.display = "block"
    }

    function showError(error?: string) {
        showPage("error");
        const reason: HTMLElement = document.querySelector("#error .reason") as HTMLElement
        if (error) {
            reason.innerText = error
            reason.style.display = "block"
        } else {
            reason.innerText = ""
            reason.style.display = "none"
        }
    }

    (document.querySelector("#facecapture a.start") as HTMLAnchorElement).onclick = () => {
        faceDetection.livenessDetectionSession().subscribe({
            next: (result) => {
                const liveFace = result.faceCaptures[0].face
                result.faceCaptures[0].faceImage.then(img => {
                    document.querySelector("#result .liveFace").innerHTML = ""
                    document.querySelector("#result .liveFace").appendChild(img)
                })
                faceRecognition.compareFaceTemplates(idCaptureResult.face.template, liveFace.template).then((score: number) => {
                    document.querySelector("#result .score").innerHTML = String(Math.round(score*10)/10)
                    const scoreString = new Intl.NumberFormat("en-US", {"minimumFractionDigits": 1, "maximumFractionDigits": 1}).format(score)
                    const likelihood = new Intl.NumberFormat("en-US", {"minimumFractionDigits": 3, "maximumFractionDigits": 3, "style": "percent"}).format(new NormalDistribution().cumulativeProbability(score))
                    const scoreThresholdString = new Intl.NumberFormat("en-US", {"minimumFractionDigits": 1, "maximumFractionDigits": 1}).format(scoreThreshold)
                    let msg: string
                    if (score > scoreThreshold) {
                        msg = "<h1 class=\"pass\">Pass</h1><p>The face matching score "+scoreString+" indicates a likelihood of "+likelihood+" that the person on the ID card is the same person as the one in the selfie. We recommend a threshold of "+scoreThresholdString+" for a positive identification when comparing faces from identity cards.</p>"
                    } else {
                        msg = "<h1 class=\"warning\">Warning</h1><p>The face matching score "+scoreString+" indicates that the person on the ID card is likely NOT the same person as the one in the selfie. We recommend a threshold of "+scoreThresholdString+" for a positive identification when comparing faces from identity cards.</p>"
                    }
                    document.querySelector("#result .score").innerHTML = msg
                    showPage("result")
                }).catch((error: any) => {
                    showError("Face comparison failed")
                })
            },
            error: (error: any) => {
                showError("Face capture failed")
            }
        })
    }

    (document.querySelector("#error a.retry") as HTMLAnchorElement).onclick = () => {
        if (idCaptureResult) {
            showPage("facecapture")
        } else {
            showPage("idcapture")
        }
    }

    (document.querySelector("#idcapture a.start") as HTMLAnchorElement).onclick = () => {
        idCapture.captureIdCard().subscribe({
            next: (result: IdCaptureResult) => {
                if (result.face) {
                    idCaptureResult = result
                    const imageData = idCaptureResult.result.fullDocumentFrontImage.rawImage
                    const canvas = document.createElement("canvas")
                    canvas.width = imageData.width
                    canvas.height = imageData.height
                    const ctx = canvas.getContext("2d")
                    ctx.putImageData(imageData, 0, 0)
                    document.querySelectorAll(".card div").forEach(div => {
                        div.innerHTML = ""
                        const img = new Image()
                        img.src = canvas.toDataURL()
                        div.appendChild(img)
                    })
                    const cardFaceImage = new Image()
                    const cardFaceCanvas = document.createElement("canvas")
                    const faceRect: Rect = new Rect(idCaptureResult.face.x, idCaptureResult.face.y, idCaptureResult.face.width, idCaptureResult.face.height)
                    faceRect.x = Math.max(0, faceRect.x)
                    faceRect.y = Math.max(0, faceRect.y)
                    if (faceRect.x + faceRect.width > imageData.width) {
                        faceRect.width = imageData.width - faceRect.x
                    }
                    if (faceRect.y + faceRect.height > imageData.height) {
                        faceRect.height = imageData.height - faceRect.y
                    }
                    cardFaceCanvas.width = faceRect.width
                    cardFaceCanvas.height = faceRect.height
                    const cardCanvasContext = canvas.getContext("2d")
                    cardCanvasContext.putImageData(imageData, 0-faceRect.x, 0-faceRect.y)
                    cardFaceImage.src = cardFaceCanvas.toDataURL()
                    document.querySelector("#result .cardFace").innerHTML = ""
                    document.querySelector("#result .cardFace").appendChild(cardFaceImage)
                    const table = document.querySelector("#carddetails table.idcard")
                    table.innerHTML = ""
                    const tableBody = document.createElement("tbody")
                    table.appendChild(tableBody)
                    const stringProps = {"firstName": "First name", "lastName": "Last name", "documentNumber": "Document number"}
                    for (let prop in stringProps) {
                        if (idCaptureResult.result[prop]) {
                            const row = document.createElement("tr")
                            const col1 = document.createElement("td")
                            const col2 = document.createElement("td")
                            col1.innerText = stringProps[prop]
                            col2.innerText = idCaptureResult.result[prop]
                            row.appendChild(col1)
                            row.appendChild(col2)
                            tableBody.appendChild(row)
                        }
                    }
                    showPage("facecapture")
                } else {
                    showError("Failed to detect a face on the ID card");
                }
            },
            error: (error: any) => {
                showError("ID capture failed");
            }
        })
    }

    const qrCodeImg = QRCodeGenerator.generateQRCode(location.href)
    document.querySelector("div.qr details").appendChild(qrCodeImg);
    (document.querySelector("div.qr") as HTMLElement).style.display = "block";

    (document.querySelector("#result a.button") as HTMLAnchorElement).onclick = () => {
        showPage("facecapture")
    }
    (document.querySelector("#facecapture .card div") as HTMLDivElement).onclick = () => {
        showPage("carddetails")
    }
    (document.querySelector("#carddetails .card div") as HTMLDivElement).onclick = () => {
        showPage("facecapture")
    }
    showPage("idcapture")
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