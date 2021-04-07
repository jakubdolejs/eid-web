import { FaceDetection, Bearing } from "/js/faceDetection.js"
import { FaceRecognition } from "/js/faceRecognition.js"
import captureImage from "https://cdn.jsdelivr.net/gh/AppliedRecognition/Ver-ID-Image-Capture-JS@3.1.0/dist/imageCapture.min.js"
import generateQRCode from "https://cdn.jsdelivr.net/gh/AppliedRecognition/Ver-ID-Image-Capture-JS@3.1.0/dist/qrCodeGenerator.min.js"
import { IdCapture } from "/js/idCapture.js"

var faceCaptureSubscription
var liveFaceTemplate, liveFaceImage, idCardFaceImage
var promptElement = document.getElementById("prompt")
var faceRecognition = new FaceRecognition()
var faceDetection = new FaceDetection()
var idCapture = new IdCapture()

generateQRCode(location.href).then(qrCode => {
    var img = document.createElement("img")
    img.src = qrCode
    document.querySelector("div.qr details").appendChild(img)
    document.querySelector("div.qr").style.display = "block"
}).catch(console.error)

document.getElementById("startCapture").onclick = function() {
    if (!FaceDetection.isLivenessDetectionSupported()) {
        alert("Liveness detection is not supported by your browser")
        return false
    }
    var button = this
    button.style.display = "none"
    if (liveFaceTemplate && liveFaceImage) {
        var options = {
            "useFrontCamera": false,
            "size": {
                "width": 2000,
                "height": 2000
            },
            "scaling": "fill"
        }
        captureImage(options).then(dataURL => {
            return dataURL.replace(/^data\:image\/jpeg;base64,/i, "")
        }).then(jpeg => {
            promptElement.innerText = "Detecting ID card in image"
            return idCapture.detectIdCard({"front":jpeg})
        }).then(idCard => {
            promptElement.innerText = "Detecting face in ID card"
            return faceRecognition.createRecognizableFace(idCard[0].fullDocumentImageBase64)
        }).then(idCardFace => {
            idCardFaceImage = new Image()
            idCardFaceImage.src = "data:image/jpeg;base64,"+idCardFace.jpeg
            return faceRecognition.compareFaceTemplates(idCardFace.faceTemplate, liveFaceTemplate)
        }).then(score => {
            promptElement.innerHTML = '<div>Comparison result</div>'
            var images = document.createElement("div")
            images.className = "images"
            var image1 = document.createElement("div")
            image1.appendChild(liveFaceImage)
            images.appendChild(image1)
            var image2 = document.createElement("div")
            image2.appendChild(idCardFaceImage)
            images.appendChild(image2)
            promptElement.appendChild(images)
            var scoreElement = document.createElement("div")
            scoreElement.className = "score"
            scoreElement.innerText = score+""
            promptElement.appendChild(scoreElement)
            button.innerText = "Capture live face"
            liveFaceTemplate = null
            liveFaceImage = null
            idCardFaceImage = null
        }).catch(error => {
            promptElement.innerText = "Image capture failed"
        }).finally(() => {
            button.style.display = "inline"
        })
    } else {
        if (!faceCaptureSubscription) {
            var bearings = {}
            bearings[Bearing.STRAIGHT] = "Straight"
            bearings[Bearing.LEFT] = "Left"
            bearings[Bearing.UP] = "Up"
            bearings[Bearing.RIGHT] = "Right"
            bearings[Bearing.DOWN] = "Down"
            bearings[Bearing.LEFT_UP] = "Left and up"
            bearings[Bearing.RIGHT_UP] = "Right and up"
            bearings[Bearing.LEFT_DOWN] = "Left and down"
            bearings[Bearing.RIGHT_DOWN] = "Right and down"

            faceCaptureSubscription = faceDetection.livenessDetectionSession().subscribe({
                "next": result => {
                    faceCaptureSubscription = null
                    button.style.display = "inline"
                    promptElement.innerText = ""
                    var capture = result.faceCaptures[0]
                    capture.faceImage.then(img => {
                        liveFaceImage = img
                        liveFaceTemplate = capture.face.template
                        button.innerText = "Capture front of ID card"
                    }).catch(error => {
                        promptElement.innerText = "Failed to crop face image"
                    })
                },
                "error": error => {
                    faceCaptureSubscription = null
                    promptElement.innerText = "Session failed"
                    if (error && error.message) {
                        promptElement.innerText += ": "+error.message
                    }
                    button.style.display = "inline"
                },
                "complete": () => {
                    if (faceCaptureSubscription) {
                        button.style.display = "inline"
                        faceCaptureSubscription = null
                    }
                }
            })
        } else {
            faceCaptureSubscription.unsubscribe()
            faceCaptureSubscription = null
        }
    }
}