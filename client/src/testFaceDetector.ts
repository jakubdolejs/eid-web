'use strict';

import { Face } from "./types";
import { FaceCapture } from "./types";
import { FaceDetectionSource, FaceDetector, FaceDetectorFactory } from "./faceDetector";
import { FaceRequirements, FaceRequirementListener } from "./types";
import { sizeOfImageSource, canvasToBlob } from "./utils";

enum FaceImageSrc {
    STRAIGHT = "/images/straight.jpg",
    LEFT = "/images/left.jpg",
    RIGHT = "/images/right.jpg",
    UP_LEFT = "/images/up-left.jpg",
    UP_RIGHT = "/images/up-right.jpg"
}

/**
 * @category Face detection testing
 */
export class TestFaceDetector implements FaceDetector, FaceRequirementListener {

    private face: Face|undefined
    private requestedFace: Face|undefined
    private lastRequestTime: Date|undefined
    private turnDurationMs: number = 2000
    private canvas: HTMLCanvasElement
    private readonly images: Record<keyof typeof FaceImageSrc, HTMLImageElement>

    constructor(images: Record<keyof typeof FaceImageSrc, HTMLImageElement>) {
        this.images = images
        this.canvas = document.createElement("canvas")
    }
    
    onChange = (requirements: FaceRequirements) => {
        this.requestedFace = new Face(requirements.ideal.bounds, requirements.ideal.angle)
        this.lastRequestTime = new Date()
    }

    private valueBetween(origin: number, destination: number, progress: number): number {
        return origin + (destination - origin) * progress
    }

    private jitterValue = (value: number, delta: number): number => {
        const jitter: number = (0.5 - Math.random()) * delta
        return value + jitter
    }

    private jitterFace = (face: Face) => {
        let delta = face.bounds.width * 0.01
        face.bounds.x = this.jitterValue(face.bounds.x, delta)
        face.bounds.y = this.jitterValue(face.bounds.y, delta)
        face.bounds.width = this.jitterValue(face.bounds.width, delta)
        face.bounds.height = face.bounds.width * 1.25
        delta = 4
        face.angle.yaw = this.jitterValue(face.angle.yaw, delta)
        face.angle.pitch = this.jitterValue(face.angle.pitch, delta)
    }

    readonly detectFace = async (source: FaceDetectionSource): Promise<FaceCapture> => {
        let face: Face|undefined
        if (!this.face) {
            this.face = this.requestedFace
        }
        if (!this.face) {
            throw new Error("Face not detected")
        }
        face = this.face
        if (this.lastRequestTime) {
            const now = new Date().getTime();
            const progress = Math.min((now - this.lastRequestTime.getTime()) / this.turnDurationMs, 1)
            if (progress == 1) {
                face = this.face = this.requestedFace
            } else if (this.requestedFace) {
                face.bounds.x = this.valueBetween(this.face.bounds.x, this.requestedFace.bounds.x, progress)
                face.bounds.y = this.valueBetween(this.face.bounds.y, this.requestedFace.bounds.y, progress)
                face.bounds.width = this.valueBetween(this.face.bounds.width, this.requestedFace.bounds.width, progress)
                face.bounds.height = this.valueBetween(this.face.bounds.height, this.requestedFace.bounds.height, progress)
                face.angle.yaw = this.valueBetween(this.face.angle.yaw, this.requestedFace.angle.yaw, progress)
                face.angle.pitch = this.valueBetween(this.face.angle.pitch, this.requestedFace.angle.pitch, progress)
            }
        }
        const nameParts: string[] = []
        if (!this.requestedFace) {
            nameParts.push("STRAIGHT")
        } else {
            if (this.requestedFace.angle.pitch > 0) {
                nameParts.push("UP")
            }
            if (this.requestedFace.angle.yaw < 0) {
                nameParts.push("LEFT")
            } else if (this.requestedFace.angle.yaw > 0) {
                nameParts.push("RIGHT")
            } else {
                nameParts.push("STRAIGHT")
            }
        }
        const imageKey: keyof typeof FaceImageSrc = nameParts.join("_") as keyof typeof FaceImageSrc
        const image: HTMLImageElement = this.images[imageKey]
        const size = await sizeOfImageSource(source.element)
        let scale: number = 1
        if (size.width / size.height > image.naturalWidth / image.naturalHeight) {
            // The source image is "fatter", constrain height and crop the width
            scale = size.height / image.naturalHeight
        } else {
            scale = size.width / image.naturalWidth
        }
        this.canvas.width = size.width
        this.canvas.height = size.height
        this.canvas.getContext("2d")!.drawImage(image, size.width / 2 - image.naturalWidth * scale / 2, size.height / 2 - image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale)
        const blob = await canvasToBlob(this.canvas)
        if (face) {
            this.jitterFace(face)
        } else {
            throw new Error("Face not detected")
        }
        return FaceCapture.create(blob, face)
    }

}

/**
 * @category Face detection testing
 */
export class TestFaceDetectorFactory implements FaceDetectorFactory {

    async createFaceDetector(): Promise<FaceDetector> {
        const images: Record<keyof typeof FaceImageSrc, HTMLImageElement> = {
            "STRAIGHT": document.createElement("img"),
            "LEFT": document.createElement("img"),
            "RIGHT": document.createElement("img"),
            "UP_LEFT": document.createElement("img"),
            "UP_RIGHT": document.createElement("img")
        }
        await Promise.all(Object.entries(images).map(entry => {
            // @ts-ignore
            entry[1].src = FaceImageSrc[entry[0]]
            return entry[1].decode()
        }))
        return Promise.resolve(new TestFaceDetector(images))
    }
    
}