import * as VerID from "@appliedrecognition/ver-id-browser";
        
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const faceImageHeight = 300;
        function cropImageToFace(image, face) {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");
            const scaleX = 0.01*image.naturalWidth;
            const scaleY = 0.01*image.naturalHeight;
            const facePixelWidth = face.width*scaleX;
            const facePixelHeight = face.height*scaleY;
            canvas.width = Math.ceil(faceImageHeight/facePixelHeight*facePixelWidth);
            canvas.height = faceImageHeight;
            context.drawImage(image, face.x*scaleX, face.y*scaleY, facePixelWidth, facePixelHeight, 0, 0, canvas.width, canvas.height);
            const dataURL = canvas.toDataURL();
            const croppedImage = new Image();
            croppedImage.src = dataURL;
            return croppedImage;
        }
        async function addFace(face, image, faceId) {
            faces[faceId] = face;
            const container = document.querySelector(`div.imageContainer.${faceId}`);
            container.innerHTML = "";
            container.appendChild(cropImageToFace(image, face));
            if (Object.entries(faces).length === 2) {
                const score = await faceRecognition.compareFaceTemplates(faces.file1.template, faces.file2.template);
                document.querySelector("#result").style.display = "block";
                document.querySelector("#score").innerText = `Comparison score: ${score.toFixed(2)}`;
            }
        }
        function onFileChange() {
            if (this.files[0]) {
                const fileReader = new FileReader();
                const fileId = this.id;
                fileReader.addEventListener("load", () => {
                    const dataURL = fileReader.result;
                    const image = new Image();
                    const imageContainer = document.querySelector(`div.imageContainer.${fileId}`);
                    imageContainer.style.display = "block";
                    image.addEventListener("load", async () => {
                        try {
                            const face = await faceRecognition.detectRecognizableFace(image);
                            await addFace(face, image, fileId);
                        } catch (error) {
                            imageContainer.style.display = "none";
                            alert(`Failed to detect face: ${error}`)
                        }
                    }, false);
                    image.src = dataURL;
                }, false);
                fileReader.readAsDataURL(this.files[0]);
            }
        }
        const faces = {};
        const configResponse = await fetch("/config.json", {"cache": "no-cache"});
        const config = await configResponse.json();
        const faceRecognition = new VerID.FaceRecognition(config.serviceURL);
        const file1 = document.querySelector("#file1");
        const file2 = document.querySelector("#file2");
        file1.addEventListener("change", onFileChange);
        file2.addEventListener("change", onFileChange);
    } catch (error) {
        alert("Failed to configure Ver-ID face detection");
    }
});