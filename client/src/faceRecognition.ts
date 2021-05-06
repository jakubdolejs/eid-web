/**
 * Ver-ID face recognition
 * @packageDocumentation
 */

import { Rect } from "./utils"

/**
 * Face that contains a template that can be used for face recognition
 */
export interface RecognizableFace {
    /**
     * Base64-encoded JPEG image
     */
    jpeg: string
    /**
     * Base64-encoded JPEG image
     */
    faceTemplate: string
    /**
     * Authenticity scores keyed by licence model prefix
     */
    authenticityScores?: {
        [k: string]: number
    }
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
     * Create a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional bounds of a face in the image
     * @returns Promise that delivers a face that can be used for face recognition
     */
    async createRecognizableFace(image: HTMLImageElement | string, faceRect?: Rect, calculateAuthenticityScore: boolean = false): Promise<RecognizableFace> {
        let jpeg: string
        if (image instanceof Image) {
            jpeg = await this.cropImage(image, faceRect)
        } else if (typeof(image) == "string") {
            jpeg = image
        } else {
            throw new Error("Invalid image parameter")
        }
        const body: DetectFaceRequest = {"image": jpeg}
        if (calculateAuthenticityScore) {
            body.calculate_authenticity_score = true
        }
        const response: Response = await fetch(this.serviceURL+"/detectFace", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify(body)
        })
        if (response.status != 200) {
            throw new Error("Failed to extract recognition template from face")
        }
        const json: RecognizableFace = await response.json()
        return json
    }

    private cropImage(image: HTMLImageElement, cropRect?: Rect): Promise<string> {
        return new Promise<string>((resolve, reject) => {
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
        const response: Response = await fetch(this.serviceURL+"/compareFaces", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json",
                "Accept": "text/plain"
            },
            "body": JSON.stringify([template1, template2])
        })
        if (response.status != 200) {
            throw new Error("Face comparison failed")
        }
        const score: string = await response.text()
        return parseFloat(score)
    }
}