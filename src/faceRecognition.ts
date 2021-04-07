/**
 * Ver-ID face recognition
 * @packageDocumentation
 */

import { Rect } from "./utils.js"

/**
 * Face that contains a template that can be used for face recognition
 */
export class RecognizableFace {
    /**
     * Base64-encoded JPEG image
     */
    jpeg: string
    /**
     * Base64-encoded JPEG image
     */
    faceTemplate: string

    /**
     * Constructor
     * @param jpeg Base64-encoded JPEG image
     * @param faceTemplate Base64-encoded JPEG image
     * @internal
     */
    constructor(jpeg: string, faceTemplate: string) {
        this.jpeg = jpeg
        this.faceTemplate = faceTemplate
    }
}

/**
 * Face recognition
 */
export class FaceRecognition {

    /**
     * Base URL of the server that accepts the face detection and comparison calls
     */
    serviceURL: string

    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    constructor(serviceURL?: string) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : ""
    }

    /**
     * Create a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional bounds of a face in the image
     * @returns Promise that delivers a face that can be used for face recognition
     */
    async createRecognizableFace(image: HTMLImageElement | string, faceRect?: Rect): Promise<RecognizableFace> {
        var jpeg: string
        if (image instanceof Image) {
            jpeg = await this.cropImage(image, faceRect)
        } else if (typeof(image) == "string") {
            jpeg = image
        } else {
            throw new Error("Invalid image parameter")
        }
        var response = await fetch(this.serviceURL+"/detectFace", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify({"image": jpeg})
        })
        if (response.status != 200) {
            throw new Error("Failed to extract recognition template from face")
        }
        var json = await response.json()
        return new RecognizableFace(json.jpeg, json.faceTemplate)
    }

    private cropImage(image: HTMLImageElement, cropRect?: Rect): Promise<string> {
        return new Promise((resolve, reject) => {
            const onImageLoaded = () => {
                try {
                    var canvas = document.createElement("canvas")
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
                    var ctx = canvas.getContext("2d")
                    ctx.drawImage(image, 0-cropRect.x, 0-cropRect.y)
                    let jpeg = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/,"")
                    resolve(jpeg)
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
        var response = await fetch(this.serviceURL+"/compareFaces", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify([template1, template2])
        })
        var score = await response.text()
        return parseFloat(score)
    }
}