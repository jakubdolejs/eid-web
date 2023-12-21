import * as VerID from "@appliedrecognition/ver-id-browser";
        
document.addEventListener("DOMContentLoaded", async () => {
    try {
        async function addDocumentImage(result) {
            const cardImageData = await result.documentImage("front", true, 640);
            const blob = await VerID.blobFromImageSource(cardImageData);
            const img = new Image();
            const src = URL.createObjectURL(blob);
            img.src = src;
            try {
                await img.decode();
                document.querySelector("#result .document").innerHTML = ""
                document.querySelector("#result .document").appendChild(img);
            } finally {
                URL.revokeObjectURL(src);
            }
        }
        function addDocumentData(result) {
            const data = result.result;
            const table = document.createElement("table");
            const tbody = document.createElement("tbody");
            table.appendChild(tbody);
            function addRow(key, value) {
                const row = document.createElement("tr");
                const keyCell = document.createElement("td");
                keyCell.innerText = key;
                const valueCell = document.createElement("td");
                valueCell.innerText = value;
                row.appendChild(keyCell);
                row.appendChild(valueCell);
                tbody.appendChild(row);
            }
            const stringProps = {"firstName": "First name", "lastName": "Last name", "documentNumber": "Document number"}
            const scripts = ["latin", "arabic", "cyrillic"]
            for (const key in stringProps) {
                if (key in data) {
                    if (typeof data[key] === "string") {
                        addRow(stringProps[key], data[key])
                    } else {
                        for (const script of scripts) {
                            if (data[key][script]) {
                                addRow(stringProps[key], data[key][script]);
                                break;
                            }
                        }
                    }
                }
            }
            document.querySelector("#result .data").innerHTML = ""
            document.querySelector("#result .data").appendChild(table);
        }
        const captureButton = document.querySelector("#capture");
        const configResponse = await fetch("/config.json", {"cache": "no-cache"});
        const config = await configResponse.json();
        const settings = new VerID.IdCaptureSettings(config.blinkIDLicenceKey, undefined, config.serviceURL);
        const idCapture = new VerID.IdCapture(settings);
        captureButton.removeAttribute("disabled");
        captureButton.addEventListener("click", () => {
            document.querySelector("#result .document").innerHTML = ""
            document.querySelector("#result .data").innerHTML = ""
            document.querySelector("#template").innerHTML = ""
            document.querySelector("#result").style.display = "none"
            const sessionSettings = new VerID.IdCaptureSessionSettings(VerID.DocumentPages.FRONT_AND_BACK, 60000);
            idCapture.captureIdCard(sessionSettings).subscribe({
                next: async (result) => {
                    await addDocumentImage(result);
                    addDocumentData(result);
                    if (result.face?.template) {
                        document.querySelector("#template").innerText = result.face.template;
                    }
                    document.querySelector("#result").style.display = "block"
                },
                error: (error) => {
                    alert(`ID capture failed: ${error}`)
                }
            })
        })
    } catch (error) {
        alert("Failed to configure Ver-ID face detection");
    }
});