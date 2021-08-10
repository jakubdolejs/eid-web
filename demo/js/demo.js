var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { FaceDetection, IdCapture, IdCaptureSettings, IdCaptureSessionSettings, FaceRecognition, generateQRCode, NormalDistribution, Rect, DocumentPages, LivenessDetectionSession, DocumentSide, imageFromImageSource } from "../node_modules/@appliedrecognition/ver-id-browser/index.js";
function setup(config) {
    const settings = new IdCaptureSettings(config.licenceKey, "/node_modules/@appliedrecognition/ver-id-browser/resources/");
    const faceDetection = new FaceDetection(config.serverURL);
    const idCapture = new IdCapture(settings, config.serverURL);
    const faceRecognition = new FaceRecognition(config.serverURL);
    const scoreThreshold = 2.5;
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
        faceDetection.captureFaces(new LivenessDetectionSession()).subscribe({
            next: (result) => {
                const liveFace = result.faceCaptures[0].face;
                result.faceCaptures[0].faceImage.then(img => {
                    document.querySelector("#result .liveFace").innerHTML = "";
                    document.querySelector("#result .liveFace").appendChild(img);
                });
                faceRecognition.compareFaceTemplates(idCaptureResult.face.template, liveFace.template).then((score) => {
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
                }).catch((error) => {
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
    function faceImageFromImageData(imageData, face) {
        const cardFaceCanvas = document.createElement("canvas");
        const faceRect = new Rect(face.x, face.y, face.width, face.height);
        faceRect.x = Math.max(0, faceRect.x);
        faceRect.y = Math.max(0, faceRect.y);
        if (faceRect.x + faceRect.width > 100) {
            faceRect.width = 100 - faceRect.x;
        }
        if (faceRect.y + faceRect.height > 100) {
            faceRect.height = 100 - faceRect.y;
        }
        cardFaceCanvas.width = faceRect.width / 100 * imageData.width;
        cardFaceCanvas.height = faceRect.height / 100 * imageData.height;
        const cardCanvasContext = cardFaceCanvas.getContext("2d");
        cardCanvasContext.putImageData(imageData, 0 - faceRect.x / 100 * imageData.width, 0 - faceRect.y / 100 * imageData.height);
        return imageFromImageSource(cardFaceCanvas);
    }
    function addIDCardImages(result) {
        return __awaiter(this, void 0, void 0, function* () {
            const cardImageData = yield result.documentImage(DocumentSide.FRONT, true, 640);
            document.querySelectorAll(".card div").forEach((div) => __awaiter(this, void 0, void 0, function* () {
                div.innerHTML = "";
                div.appendChild(yield imageFromImageSource(cardImageData));
            }));
            const cardFaceImage = yield faceImageFromImageData(cardImageData, result.face);
            document.querySelector("#result .cardFace").innerHTML = "";
            document.querySelector("#result .cardFace").appendChild(cardFaceImage);
        });
    }
    function addIDCardDetails(result) {
        const table = document.querySelector("#carddetails table.idcard");
        table.innerHTML = "";
        const tableBody = document.createElement("tbody");
        table.appendChild(tableBody);
        const stringProps = { "firstName": "First name", "lastName": "Last name", "documentNumber": "Document number" };
        for (let prop in stringProps) {
            if (result.result[prop]) {
                const row = document.createElement("tr");
                const col1 = document.createElement("td");
                const col2 = document.createElement("td");
                col1.innerText = stringProps[prop];
                col2.innerText = result.result[prop];
                row.appendChild(col1);
                row.appendChild(col2);
                tableBody.appendChild(row);
            }
        }
    }
    document.querySelector("#idcapture a.start").onclick = () => {
        idCaptureResult = null;
        const subscription = idCapture.captureIdCard(new IdCaptureSessionSettings(DocumentPages.FRONT_AND_BACK, 60000)).subscribe({
            next: (result) => {
                if (!result.face) {
                    showError("Failed to detect a face on the ID card");
                    subscription.unsubscribe();
                    return;
                }
                addIDCardImages(result);
                addIDCardDetails(result);
                idCaptureResult = result;
            },
            error: (error) => {
                showError("ID capture failed");
            },
            complete: () => {
                if (idCaptureResult) {
                    showPage("facecapture");
                }
            }
        });
    };
    const qrCodeImg = generateQRCode(location.href);
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
}
window.onload = () => {
    fetch("/config.json").then(response => {
        return response.json();
    }).then((config) => {
        setup(config);
    }).catch(error => {
        alert("Failed to read configuration file");
    });
};
//# sourceMappingURL=demo.js.map