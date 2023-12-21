'use strict';

/**
 * Ver-ID face recognition
 * @packageDocumentation
 */

import { blobFromImageSource, sizeOfImageSource } from "./utils"
import { Rect } from "./types";
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
            const blob = await blobFromImageSource(entry[1].image, cropRect)
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
        const json: {name: string, face: RecognizableFace}[] = (await response.json()).filter((entry: {face?: RecognizableFace|null}) => entry.face != null)
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
        const body: Blob = await blobFromImageSource(image, faceRect)
        const response = await fetch(this.serviceURL+"/detect_face", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": body.type
            },
            "body": body
        })
        if (response.status != 200) {
            throw new Error("Failed to extract recognition template from face")
        }
        const json: RecognizableFace = await response.json()
        if (!json.x || !json.y || !json.width || !json.height || !json.template) {
            throw new Error("Failed to detect face in image")
        }
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

    /**
     * Compare face templates and return similarity score
     * @param template1 Face template
     * @param template2 Face template
     * @returns Similarity score between the two templates
     */
    public compareFaceTemplates(template1: string, template2: string): Promise<number> {
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