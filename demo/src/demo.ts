import { 
    FaceDetection, 
    IdCapture, 
    IdCaptureSettings, 
    IdCaptureSessionSettings, 
    IdCaptureResult, 
    FaceRecognition, 
    QRCodeGenerator, 
    NormalDistribution, 
    Rect, 
    RecognizableFace,
    DocumentPages } from "../node_modules/@appliedrecognition/ver-id-browser/index.js"

type DemoConfiguration = {licenceKey: string, serverURL: string}

function setup(config: DemoConfiguration) {
    const settings = new IdCaptureSettings(config.licenceKey, "/node_modules/@appliedrecognition/ver-id-browser/resources/")
    const faceDetection = new FaceDetection(config.serverURL)
    const idCapture = new IdCapture(settings, config.serverURL)
    const faceRecognition = new FaceRecognition(config.serverURL)
    const scoreThreshold = 3.0

    let backPageResult: IdCaptureResult
    let frontPageResult: IdCaptureResult

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
                faceRecognition.compareFaceTemplates(frontPageResult.face.template, liveFace.template).then((score: number) => {
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
        if (frontPageResult && backPageResult) {
            showPage("facecapture")
        } else {
            showPage("idcapture")
        }
    }

    function dataURLFromImageData(imageData: ImageData): string {
        const canvas = document.createElement("canvas")
        canvas.width = imageData.width
        canvas.height = imageData.height
        const ctx = canvas.getContext("2d")
        ctx.putImageData(imageData, 0, 0)
        return canvas.toDataURL()
    }

    function faceImageDataURLFromImageData(imageData: ImageData, face: RecognizableFace): string {
        const cardFaceCanvas = document.createElement("canvas")
        const faceRect: Rect = new Rect(face.x, face.y, face.width, face.height)
        faceRect.x = Math.max(0, faceRect.x)
        faceRect.y = Math.max(0, faceRect.y)
        if (faceRect.x + faceRect.width > 100) {
            faceRect.width = 100 - faceRect.x
        }
        if (faceRect.y + faceRect.height > 100) {
            faceRect.height = 100 - faceRect.y
        }
        cardFaceCanvas.width = faceRect.width / 100 * imageData.width
        cardFaceCanvas.height = faceRect.height / 100 * imageData.height
        const cardCanvasContext = cardFaceCanvas.getContext("2d")
        cardCanvasContext.putImageData(imageData, 0 - faceRect.x / 100 * imageData.width, 0 - faceRect.y / 100 * imageData.height)
        return cardFaceCanvas.toDataURL()
    }

    function imageDataFromIdCaptureResult(result: IdCaptureResult): ImageData {
        if (result.result.fullDocumentFrontImage) {
            return result.result.fullDocumentFrontImage.rawImage
        } else if (result.result.fullDocumentImage) {
            return result.result.fullDocumentImage.rawImage
        }
        return null
    }

    function addIDCardImages(result: IdCaptureResult): void {
        const imageData: ImageData = imageDataFromIdCaptureResult(result)
        if (imageData) {
            const dataURL = dataURLFromImageData(imageData)
            document.querySelectorAll(".card div").forEach(div => {
                div.innerHTML = ""
                const img = new Image()
                img.src = dataURL
                div.appendChild(img)
            })
            const cardFaceImage = new Image()
            cardFaceImage.src = faceImageDataURLFromImageData(imageData, result.face)
            document.querySelector("#result .cardFace").innerHTML = ""
            document.querySelector("#result .cardFace").appendChild(cardFaceImage)
        }
    }

    function addIDCardDetails(result: IdCaptureResult): void {
        const table = document.querySelector("#carddetails table.idcard")
        table.innerHTML = ""
        const tableBody = document.createElement("tbody")
        table.appendChild(tableBody)
        const stringProps = {"firstName": "First name", "lastName": "Last name", "documentNumber": "Document number"}
        for (let prop in stringProps) {
            if (result.result[prop]) {
                const row = document.createElement("tr")
                const col1 = document.createElement("td")
                const col2 = document.createElement("td")
                col1.innerText = stringProps[prop]
                col2.innerText = result.result[prop]
                row.appendChild(col1)
                row.appendChild(col2)
                tableBody.appendChild(row)
            }
        }
    }

    (document.querySelector("#idcapture a.start") as HTMLAnchorElement).onclick = () => {
        frontPageResult = backPageResult = null
        const subscription = idCapture.captureIdCard(new IdCaptureSessionSettings(DocumentPages.FRONT_AND_BACK, 60000, true)).subscribe({
            next: (result: IdCaptureResult) => {
                if (result.pages == DocumentPages.FRONT || result.pages == DocumentPages.FRONT_AND_BACK) {
                    if (!result.face) {
                        showError("Failed to detect a face on the ID card")
                        subscription.unsubscribe()
                        return
                    }
                    addIDCardImages(result)
                    frontPageResult = result
                } else {
                    addIDCardDetails(result)
                    backPageResult = result                    
                }
            },
            error: (error: any) => {
                showError("ID capture failed");
            },
            complete: () => {
                if (frontPageResult && backPageResult) {
                    showPage("facecapture")
                }
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