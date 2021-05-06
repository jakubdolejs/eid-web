// @ts-ignore
import { FaceDetection, IdCapture, IdCaptureSettings, FaceRecognition, QRCodeGenerator, NormalDistribution } from "/@appliedrecognition/ver-id-browser/index.js";
window.onload = () => {
    const licenceKey = document.getElementById("licence_key").value;
    const settings = new IdCaptureSettings(licenceKey, "/@appliedrecognition/ver-id-browser/resources/");
    const faceDetection = new FaceDetection();
    const idCapture = new IdCapture(settings);
    const faceRecognition = new FaceRecognition();
    const scoreThreshold = 3.0;
    let idCaptureResult;
    function hideAllPages() {
        document.querySelectorAll(".page").forEach(item => {
            item.style.display = "none";
        });
    }
    function showPage(id) {
        hideAllPages();
        document.getElementById("background").className = id;
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
    document.querySelector("#facecapture a.start").onclick = () => {
        faceDetection.livenessDetectionSession().subscribe({
            next: (result) => {
                const liveFace = result.faceCaptures[0].face;
                result.faceCaptures[0].faceImage.then(img => {
                    document.querySelector("#result .liveFace").innerHTML = "";
                    document.querySelector("#result .liveFace").appendChild(img);
                });
                faceRecognition.compareFaceTemplates(idCaptureResult.face.faceTemplate, liveFace.template).then((score) => {
                    document.querySelector("#result .score").innerHTML = String(Math.round(score * 10) / 10);
                    const scoreString = new Intl.NumberFormat("en-US", { "minimumFractionDigits": 1, "maximumFractionDigits": 1 }).format(score);
                    const likelihood = new Intl.NumberFormat("en-US", { "minimumFractionDigits": 3, "maximumFractionDigits": 3, "style": "percent" }).format(new NormalDistribution().cumulativeProbability(score));
                    const scoreThresholdString = new Intl.NumberFormat("en-US", { "minimumFractionDigits": 1, "maximumFractionDigits": 1 }).format(scoreThreshold);
                    let msg;
                    if (score > scoreThreshold) {
                        msg = "<h1 class=\"pass\">Pass</h1><p>The face matching score " + scoreString + " indicates a likelihood of " + likelihood + " that the person on the ID card is the same person as the one in the selfie. We recommend a threshold of " + scoreThresholdString + " for a positive identification when comparing faces from identity cards.</p>";
                    }
                    else {
                        msg = "<h1 class=\"warning\">Warning</h1><p>The face matching score " + scoreString + " indicates that the person on the ID card is likely NOT the same person as the one in the selfie. We recommend a threshold of " + scoreThresholdString + " for a positive identification when comparing faces from identity cards.</p>";
                    }
                    document.querySelector("#result .score").innerHTML = msg;
                    showPage("result");
                }).catch(error => {
                    showError("Face comparison failed");
                });
            },
            error: (error) => {
                showError("Face capture failed");
            }
        });
    };
    document.querySelector("#error a.retry").onclick = () => {
        if (idCaptureResult) {
            showPage("facecapture");
        }
        else {
            showPage("idcapture");
        }
    };
    document.querySelector("#idcapture a.start").onclick = () => {
        idCapture.captureIdCard().subscribe({
            next: (result) => {
                idCaptureResult = result;
                if (idCaptureResult.face) {
                    const cardFaceImage = new Image();
                    cardFaceImage.src = "data:image/jpeg;base64," + idCaptureResult.face.jpeg;
                    document.querySelector("#result .cardFace").innerHTML = "";
                    document.querySelector("#result .cardFace").appendChild(cardFaceImage);
                    const imageData = idCaptureResult.result.fullDocumentFrontImage.rawImage;
                    const canvas = document.createElement("canvas");
                    canvas.width = imageData.width;
                    canvas.height = imageData.height;
                    const ctx = canvas.getContext("2d");
                    ctx.putImageData(imageData, 0, 0);
                    document.querySelectorAll(".card div").forEach(div => {
                        div.innerHTML = "";
                        const img = new Image();
                        img.src = canvas.toDataURL();
                        div.appendChild(img);
                    });
                    const table = document.querySelector("#carddetails table.idcard");
                    table.innerHTML = "";
                    const tableBody = document.createElement("tbody");
                    table.appendChild(tableBody);
                    const stringProps = { "firstName": "First name", "lastName": "Last name", "documentNumber": "Document number" };
                    for (let prop in stringProps) {
                        if (idCaptureResult.result[prop]) {
                            const row = document.createElement("tr");
                            const col1 = document.createElement("td");
                            const col2 = document.createElement("td");
                            col1.innerText = stringProps[prop];
                            col2.innerText = idCaptureResult.result[prop];
                            row.appendChild(col1);
                            row.appendChild(col2);
                            tableBody.appendChild(row);
                        }
                    }
                    showPage("facecapture");
                }
                else {
                    showError("Failed to detect a face on the ID card");
                }
            },
            error: (error) => {
                showError("ID capture failed");
            },
            complete: () => {
            }
        });
    };
    const qrCodeImg = QRCodeGenerator.generateQRCode(location.href);
    document.querySelector("div.qr details").appendChild(qrCodeImg);
    document.querySelector("div.qr").style.display = "block";
    document.querySelector("#result a.button").onclick = () => {
        showPage("facecapture");
    };
    document.querySelector("#facecapture .card div").onclick = () => {
        showPage("carddetails");
    };
    document.querySelector("#carddetails .card div").onclick = () => {
        showPage("facecapture");
    };
    showPage("idcapture");
};
//# sourceMappingURL=demo.js.map