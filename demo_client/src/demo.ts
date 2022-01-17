'use strict';

import { 
    FaceDetection, 
    IdCapture, 
    IdCaptureSettings, 
    IdCaptureSessionSettings, 
    IdCaptureResult, 
    FaceRecognition, 
    generateQRCode, 
    NormalDistribution, 
    Rect, 
    RecognizableFace,
    DocumentPages, 
    LivenessDetectionSession,
    DocumentSide,
    blobFromImageSource
} from "../node_modules/@appliedrecognition/ver-id-browser/index.js"

type DemoConfiguration = {licenceKey: string, serverURL?: string}

async function imageFromImageData(imageData: ImageData, cropRect?: Rect): Promise<HTMLImageElement> {
    const blob = await blobFromImageSource(imageData, cropRect)
    const img: HTMLImageElement = document.createElement("img")
    const src = URL.createObjectURL(blob)
    img.src = src
    try {
        await img.decode()
        return img
    } finally {
        URL.revokeObjectURL(src)
    }
}

function setup(config: DemoConfiguration) {
    const settings = new IdCaptureSettings(config.licenceKey, "/node_modules/@appliedrecognition/ver-id-browser/resources/")
    const faceDetection = new FaceDetection(config.serverURL)
    const idCapture = new IdCapture(settings, config.serverURL)
    const faceRecognition = new FaceRecognition(config.serverURL)
    const scoreThreshold = 2.5

    let idCaptureResult: IdCaptureResult

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

    function takeHeapSnapshot() {
        if ("takeHeapSnapshot" in console) {
            // @ts-ignore: Webkit
            console.takeHeapSnapshot()
        }
    }

    (document.querySelector("#facecapture a.start") as HTMLAnchorElement).onclick = () => {
        takeHeapSnapshot()
        faceDetection.captureFaces(new LivenessDetectionSession()).subscribe({
            next: (result) => {
                const liveFace = result.faceCaptures[0].face
                const img = document.createElement("img")
                img.src = URL.createObjectURL(result.faceCaptures[0].faceImage)
                img.decode().then(() => {
                    document.querySelector("#result .liveFace").innerHTML = ""
                    document.querySelector("#result .liveFace").appendChild(img)
                    faceRecognition.compareFaceTemplates(idCaptureResult.face.template, liveFace.template).then((score: number) => {
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
                }).catch((error: any) => {
                    showError("Failed to decode face image")
                }).finally(() => {
                    URL.revokeObjectURL(img.src)
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

    function faceImageFromImageData(imageData: ImageData, face: RecognizableFace): Promise<HTMLImageElement> {
        const faceRect: Rect = new Rect(face.x, face.y, face.width, face.height)
        faceRect.x = Math.max(0, faceRect.x / 100 * imageData.width)
        faceRect.y = Math.max(0, faceRect.y / 100 * imageData.height)
        if (faceRect.x + faceRect.width > 100) {
            faceRect.width = 100 - faceRect.x
        }
        if (faceRect.y + faceRect.height > 100) {
            faceRect.height = 100 - faceRect.y
        }
        faceRect.width = faceRect.width / 100 * imageData.width
        faceRect.height = faceRect.height / 100 * imageData.height
        return imageFromImageData(imageData, faceRect)
    }

    async function addIDCardImages(result: IdCaptureResult): Promise<void> {
        const cardImageData: ImageData = await result.documentImage(DocumentSide.FRONT, true, 640)
        document.querySelectorAll(".card div").forEach(async (div) => {
            div.innerHTML = ""
            div.appendChild(await imageFromImageData(cardImageData))
        })
        const cardFaceImage = await faceImageFromImageData(cardImageData, result.face)
        document.querySelector("#result .cardFace").innerHTML = ""
        document.querySelector("#result .cardFace").appendChild(cardFaceImage)
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
        idCaptureResult = null
        const subscription = idCapture.captureIdCard(new IdCaptureSessionSettings(DocumentPages.FRONT_AND_BACK, 60000)).subscribe({
            next: (result: IdCaptureResult) => {
                if (!result.face) {
                    showError("Failed to detect a face on the ID card")
                    subscription.unsubscribe()
                    return
                }
                addIDCardImages(result)
                addIDCardDetails(result)
                idCaptureResult = result
            },
            error: (error: any) => {
                showError("ID capture failed");
            },
            complete: () => {
                if (idCaptureResult) {
                    showPage("facecapture")
                }
            }
        })
    }

    const qrCodeImg = generateQRCode(location.href)
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

document.addEventListener("DOMContentLoaded", () => {
    fetch("/config.json").then(response => {
        return response.json()
    }).then((config: DemoConfiguration) => {
        setup(config)
    }).catch(error => {
        alert("Failed to read configuration file")
    })
})