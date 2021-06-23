/**
 * Ver-ID face recognition
 * @packageDocumentation
 */

import { blobFromImageSource, imageFromImageSource, Rect, sizeOfImageSource } from "./utils"
import { RecognizableFace, RecognizableFaceDetectionInput, RecognizableFaceDetectionOutput, Size, ImageSource } from "./types"

/**
 * Face recognition
 * @category Face recognition
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

    private blobFromImage(image: ImageSource, cropRect?: Rect): Promise<Blob> {
        if (!cropRect) {
            return blobFromImageSource(image)
        }
        return new Promise(async (resolve, reject) => {
            try {
                const img = await imageFromImageSource(image)
                const canvas = document.createElement("canvas")
                canvas.width = cropRect.width
                canvas.height = cropRect.height
                const x = 0 - cropRect.x
                const y = 0 - cropRect.y
                const context = canvas.getContext("2d")
                context.drawImage(img, x, y)
                canvas.toBlob((blob: Blob) => {
                    resolve(blob)
                }, "image/jpeg", 0.95)
            } catch(error) {
                reject(error)
            }
        })
    }

    public async detectRecognizableFacesInImages(images: RecognizableFaceDetectionInput): Promise<RecognizableFaceDetectionOutput> {
        if (Object.values(images).length == 0) {
            return {}
        }
        const formData = new FormData()
        const cropRects: {[k: string]: Rect} = {}
        const imageSizes: {[k: string]: Size} = {}
        await Promise.all(Object.entries(images).map(async (entry) => {
            const imageSize = await sizeOfImageSource(entry[1].image)
            const cropRect = this.adjustImageCropRect(imageSize, entry[1].faceRect)
            cropRects[entry[0]] = cropRect
            imageSizes[entry[0]] = imageSize
            const blob = await this.blobFromImage(entry[1].image, cropRect)
            formData.append(entry[0], blob)
        }))
        const response = await fetch(this.serviceURL+"/detect_face", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "body": formData
        })
        if (response.status != 200) {
            throw new Error("Failed to detect recognizable faces")
        }
        const json: {name: string, face: RecognizableFace}[] = await response.json()
        const out: RecognizableFaceDetectionOutput = {}
        json.forEach((entry) => {
            const face = entry.face
            const rect = this.faceCoordinatesToPixels(face, imageSizes[entry.name], cropRects[entry.name])
            face.x = rect.x
            face.y = rect.y
            face.width = rect.width
            face.height = rect.height
            out[entry.name] = face
        })
        return out
    }

    /**
     * Detect a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional expected bounds of a face in the image
     * @returns Promise that delivers a face that can be used for face recognition
     */
    public async detectRecognizableFace(image: ImageSource, faceRect?: Rect): Promise<RecognizableFace> {
        const body: Blob = await this.blobFromImage(image, faceRect)
        const response = await fetch(this.serviceURL+"/detect_face", {
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
        const imageSize = await sizeOfImageSource(image)
        const cropRect = this.adjustImageCropRect(imageSize, faceRect)
        const facePixelRect = this.faceCoordinatesToPixels(json, imageSize, cropRect)
        json.x = facePixelRect.x
        json.y = facePixelRect.y
        json.width = facePixelRect.width
        json.height = facePixelRect.height
        return json
    }

    /**
     * Detect a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional bounds of a face in the image
     * @deprecated Please use {@linkcode detectRecognizableFace} instead
     * @returns Promise that delivers a face that can be used for face recognition
     * @internal
     */
    public async createRecognizableFace(image: HTMLImageElement | string, faceRect?: Rect): Promise<RecognizableFace> {
        return this.detectRecognizableFace(image, faceRect)
    }

    private faceCoordinatesToPixels(face: RecognizableFace, imageSize: Size, cropRect: Rect): Rect {
        const facePixelRect = {
            x: cropRect.x + face.x / 100 * cropRect.width,
            y: cropRect.y + face.y / 100 * cropRect.height,
            width: face.width / 100 * cropRect.width,
            height: face.height / 100 * cropRect.height
        }
        return new Rect(
            facePixelRect.x / imageSize.width * 100,
            facePixelRect.y / imageSize.height * 100,
            facePixelRect.width / imageSize.width * 100,
            facePixelRect.height / imageSize.height * 100
        )
    }

    private adjustImageCropRect(imageSize: Size, cropRect?: Rect): Rect {
        if (!cropRect) {
            return new Rect(0, 0, imageSize.width, imageSize.height)
        }
        const adjustedCropRect: Rect = new Rect(cropRect.x, cropRect.y, cropRect.width, cropRect.height)
        adjustedCropRect.x = Math.max(adjustedCropRect.x - adjustedCropRect.width * 0.1, 0)
        adjustedCropRect.y = Math.max(adjustedCropRect.y - adjustedCropRect.height * 0.1, 0)
        adjustedCropRect.width *= 1.2
        adjustedCropRect.height *= 1.2
        if (adjustedCropRect.x + adjustedCropRect.width > imageSize.width) {
            adjustedCropRect.width = imageSize.width - adjustedCropRect.x
        }
        if (adjustedCropRect.y + adjustedCropRect.height > imageSize.height) {
            adjustedCropRect.height = imageSize.height - adjustedCropRect.y
        }
        return adjustedCropRect
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
    public async compareFaceTemplates(template1: string, template2: string): Promise<number> {
        if (!template1 || !template2) {
            throw new Error("Missing face templates")
        }
        return this.compareFaceTemplateToTemplates(template1, [template2])
    }

    public async compareFaceTemplateToTemplates(template: string, templates: string[]): Promise<number> {
        const response: Response = await fetch(this.serviceURL+"/compare_faces", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json",
                "Accept": "text/plain"
            },
            "body": JSON.stringify({target: template, faces: templates})
        })
        if (response.status >= 400) {
            throw new Error("Face comparison failed")
        }
        const score: string = await response.text()
        return parseFloat(score)
    }
}