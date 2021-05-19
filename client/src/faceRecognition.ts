/**
 * Ver-ID face recognition
 * @packageDocumentation
 */

import { Rect, Size } from "./utils"

/**
 * Face that contains a template that can be used for face recognition
 */
export interface RecognizableFace {
    /**
     * Distance of the face from the left side of the image (percent of image width)
     */
    x: number
    /**
     * Distance of the face from the top side of the image (percent of image height)
     */
    y: number
    /**
     * Width of the face (percent of image width)
     */
    width: number,
    /**
     * Height of the face (percent of image height)
     */
    height: number,
    /**
     * Quality of the detected face – ranges from 0 (worst) to 10 (best)
     */
    quality: number
    /**
     * Base64-encoded face recognition template
     */
    template: string
}

interface DetectFaceRequest {
    image: string
    calculate_authenticity_score?: boolean
}

/**
 * Face recognition
 */
export class FaceRecognition {

    /**
     * Base URL of the server that accepts the face detection and comparison calls
     */
    readonly serviceURL: string

    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    constructor(serviceURL?: string) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : ""
    }

    /**
     * Detect a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional expected bounds of a face in the image
     * @returns Promise that delivers a face that can be used for face recognition
     */
    async detectRecognizableFace(image: HTMLImageElement | string, faceRect?: Rect): Promise<RecognizableFace> {
        let jpeg: string
        let cropRect: Rect = null
        let imageSize: Size = null
        if (image instanceof Image) {
            [jpeg, cropRect] = await this.cropImage(image, faceRect)
            imageSize = {"width": image.naturalWidth, "height": image.naturalHeight}
        } else if (typeof(image) == "string") {
            jpeg = image.replace(/^data\:image\/.+?;base64\,/i, "")
        } else {
            throw new Error("Invalid image parameter")
        }
        let response: Response = await fetch("data:image/jpeg;base64,"+jpeg)
        const body: Blob = await response.blob()
        response = await fetch(this.serviceURL+"/detect_face", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "image/jpeg"
            },
            "body": body
        })
        if (response.status != 200) {
            throw new Error("Failed to extract recognition template from face")
        }
        const json: RecognizableFace = await response.json()
        if (cropRect && imageSize) {
            const facePixelRect = {
                x: cropRect.x + json.x / 100 * cropRect.width,
                y: cropRect.y + json.y / 100 * cropRect.height,
                width: json.width / 100 * cropRect.width,
                height: json.height / 100 * cropRect.height
            }
            json.x = facePixelRect.x / imageSize.width * 100
            json.y = facePixelRect.y / imageSize.height * 100
            json.width = facePixelRect.width / imageSize.width * 100
            json.height = facePixelRect.height / imageSize.height * 100
        }
        return json
    }

    /**
     * Detect a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional bounds of a face in the image
     * @deprecated Please use {@linkcode detectRecognizableFace} instead
     * @returns Promise that delivers a face that can be used for face recognition
     */
    async createRecognizableFace(image: HTMLImageElement | string, faceRect?: Rect): Promise<RecognizableFace> {
        return this.detectRecognizableFace(image, faceRect)
    }

    private cropImage(image: HTMLImageElement, cropRect?: Rect): Promise<[string,Rect]> {
        return new Promise<[string,Rect]>((resolve, reject) => {
            const onImageLoaded = () => {
                try {
                    const canvas: HTMLCanvasElement = document.createElement("canvas")
                    if (cropRect) {
                        cropRect.x = Math.max(cropRect.x - cropRect.width * 0.1, 0)
                        cropRect.y = Math.max(cropRect.y - cropRect.height * 0.1, 0)
                        cropRect.width *= 1.2
                        cropRect.height *= 1.2
                        if (cropRect.x + cropRect.width > image.width) {
                            cropRect.width = image.width - cropRect.x
                        }
                        if (cropRect.y + cropRect.height > image.height) {
                            cropRect.height = image.height - cropRect.y
                        }
                    } else {
                        cropRect = new Rect(0, 0, image.width, image.height)
                    }
                    canvas.width = cropRect.width
                    canvas.height = cropRect.height
                    const ctx: CanvasRenderingContext2D = canvas.getContext("2d")
                    ctx.drawImage(image, 0-cropRect.x, 0-cropRect.y)
                    const jpeg: string = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/,"")
                    resolve([jpeg, cropRect])
                } catch (error) {
                    reject(error)
                }
            }
            if (image.complete) {
                onImageLoaded()
            } else {
                image.onload = onImageLoaded
                image.onerror = reject
            }
        })
    }

    /**
     * Compare face templates and return similarity score
     * @param template1 Face template
     * @param template2 Face template
     * @returns Similarity score between the two templates
     */
    async compareFaceTemplates(template1: string, template2: string): Promise<number> {
        if (!template1 || !template2) {
            throw new Error("Missing face templates")
        }
        const response: Response = await fetch(this.serviceURL+"/compare_faces", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json",
                "Accept": "text/plain"
            },
            "body": JSON.stringify([template1, template2])
        })
        if (response.status >= 400) {
            throw new Error("Face comparison failed")
        }
        const score: string = await response.text()
        return parseFloat(score)
    }
}