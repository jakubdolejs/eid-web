/**
 * Ver-ID face recognition
 * @packageDocumentation
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Rect } from "./utils.js";
/**
 * Face that contains a template that can be used for face recognition
 */
export class RecognizableFace {
    /**
     * Constructor
     * @param jpeg Base64-encoded JPEG image
     * @param faceTemplate Base64-encoded JPEG image
     * @internal
     */
    constructor(jpeg, faceTemplate) {
        this.jpeg = jpeg;
        this.faceTemplate = faceTemplate;
    }
}
/**
 * Face recognition
 */
export class FaceRecognition {
    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    constructor(serviceURL) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : "";
    }
    /**
     * Create a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional bounds of a face in the image
     * @returns Promise that delivers a face that can be used for face recognition
     */
    createRecognizableFace(image, faceRect) {
        return __awaiter(this, void 0, void 0, function* () {
            var jpeg;
            if (image instanceof Image) {
                jpeg = yield this.cropImage(image, faceRect);
            }
            else if (typeof (image) == "string") {
                jpeg = image;
            }
            else {
                throw new Error("Invalid image parameter");
            }
            var response = yield fetch(this.serviceURL + "/detectFace", {
                "method": "POST",
                "mode": "cors",
                "cache": "no-cache",
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": JSON.stringify({ "image": jpeg })
            });
            if (response.status != 200) {
                throw new Error("Failed to extract recognition template from face");
            }
            var json = yield response.json();
            return new RecognizableFace(json.jpeg, json.faceTemplate);
        });
    }
    cropImage(image, cropRect) {
        return new Promise((resolve, reject) => {
            const onImageLoaded = () => {
                try {
                    var canvas = document.createElement("canvas");
                    if (cropRect) {
                        cropRect.x = Math.max(cropRect.x - cropRect.width * 0.1, 0);
                        cropRect.y = Math.max(cropRect.y - cropRect.height * 0.1, 0);
                        cropRect.width *= 1.2;
                        cropRect.height *= 1.2;
                        if (cropRect.x + cropRect.width > image.width) {
                            cropRect.width = image.width - cropRect.x;
                        }
                        if (cropRect.y + cropRect.height > image.height) {
                            cropRect.height = image.height - cropRect.y;
                        }
                    }
                    else {
                        cropRect = new Rect(0, 0, image.width, image.height);
                    }
                    canvas.width = cropRect.width;
                    canvas.height = cropRect.height;
                    var ctx = canvas.getContext("2d");
                    ctx.drawImage(image, 0 - cropRect.x, 0 - cropRect.y);
                    let jpeg = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/, "");
                    resolve(jpeg);
                }
                catch (error) {
                    reject(error);
                }
            };
            if (image.complete) {
                onImageLoaded();
            }
            else {
                image.onload = onImageLoaded;
                image.onerror = reject;
            }
        });
    }
    /**
     * Compare face templates and return similarity score
     * @param template1 Face template
     * @param template2 Face template
     * @returns Similarity score between the two templates
     */
    compareFaceTemplates(template1, template2) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!template1 || !template2) {
                throw new Error("Missing face templates");
            }
            var response = yield fetch(this.serviceURL + "/compareFaces", {
                "method": "POST",
                "mode": "cors",
                "cache": "no-cache",
                "headers": {
                    "Content-Type": "application/json"
                },
                "body": JSON.stringify([template1, template2])
            });
            var score = yield response.text();
            return parseFloat(score);
        });
    }
}
//# sourceMappingURL=faceRecognition.js.map