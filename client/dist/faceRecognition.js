/**
 * Ver-ID face recognition
 * @packageDocumentation
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Rect } from "./utils";
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
     * Detect a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional expected bounds of a face in the image
     * @returns Promise that delivers a face that can be used for face recognition
     */
    detectRecognizableFace(image, faceRect) {
        return __awaiter(this, void 0, void 0, function* () {
            let jpeg;
            let cropRect = null;
            let imageSize = null;
            if (image instanceof Image) {
                [jpeg, cropRect] = yield this.cropImage(image, faceRect);
                imageSize = { "width": image.naturalWidth, "height": image.naturalHeight };
            }
            else if (typeof (image) == "string") {
                jpeg = image.replace(/^data\:image\/.+?;base64\,/i, "");
            }
            else {
                throw new Error("Invalid image parameter");
            }
            let response = yield fetch("data:image/jpeg;base64," + jpeg);
            const body = yield response.blob();
            response = yield fetch(this.serviceURL + "/detect_face", {
                "method": "POST",
                "mode": "cors",
                "cache": "no-cache",
                "headers": {
                    "Content-Type": "image/jpeg"
                },
                "body": body
            });
            if (response.status != 200) {
                throw new Error("Failed to extract recognition template from face");
            }
            const json = yield response.json();
            if (cropRect && imageSize) {
                const facePixelRect = {
                    x: cropRect.x + json.x / 100 * cropRect.width,
                    y: cropRect.y + json.y / 100 * cropRect.height,
                    width: json.width / 100 * cropRect.width,
                    height: json.height / 100 * cropRect.height
                };
                json.x = facePixelRect.x / imageSize.width * 100;
                json.y = facePixelRect.y / imageSize.height * 100;
                json.width = facePixelRect.width / imageSize.width * 100;
                json.height = facePixelRect.height / imageSize.height * 100;
            }
            return json;
        });
    }
    /**
     * Detect a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional bounds of a face in the image
     * @deprecated Please use {@linkcode detectRecognizableFace} instead
     * @returns Promise that delivers a face that can be used for face recognition
     */
    createRecognizableFace(image, faceRect) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.detectRecognizableFace(image, faceRect);
        });
    }
    cropImage(image, cropRect) {
        return new Promise((resolve, reject) => {
            const onImageLoaded = () => {
                try {
                    const canvas = document.createElement("canvas");
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
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(image, 0 - cropRect.x, 0 - cropRect.y);
                    const jpeg = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/, "");
                    resolve([jpeg, cropRect]);
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
            const response = yield fetch(this.serviceURL + "/compare_faces", {
                "method": "POST",
                "mode": "cors",
                "cache": "no-cache",
                "headers": {
                    "Content-Type": "application/json",
                    "Accept": "text/plain"
                },
                "body": JSON.stringify([template1, template2])
            });
            if (response.status >= 400) {
                throw new Error("Face comparison failed");
            }
            const score = yield response.text();
            return parseFloat(score);
        });
    }
}
//# sourceMappingURL=faceRecognition.js.map