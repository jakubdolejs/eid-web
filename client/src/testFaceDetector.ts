import { Face, FaceCapture } from "./faceDetection";
import { FaceDetectionSource, FaceDetector, FaceDetectorFactory } from "./faceDetector";
import { FaceRequirements, FaceRequirementListener } from "./types";
import { sizeOfImageSource } from "./utils";

/**
 * @category Face detection testing
 */
export class TestFaceDetector implements FaceDetector, FaceRequirementListener {

    private face: Face
    private requestedFace: Face
    private lastRequestTime: Date
    private turnDurationMs: number = 2000
    private canvas: HTMLCanvasElement

    constructor() {
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

    detectFace(source: FaceDetectionSource): Promise<FaceCapture> {
        return new Promise((resolve, reject) => {
            let image: HTMLImageElement = new Image()
            let face: Face
            if (!this.face) {
                this.face = this.requestedFace
            }
            face = this.face
            if (this.lastRequestTime) {
                const now = new Date().getTime();
                const progress = Math.min((now - this.lastRequestTime.getTime()) / this.turnDurationMs, 1)
                if (progress == 1) {
                    face = this.face = this.requestedFace
                } else {
                    face.bounds.x = this.valueBetween(this.face.bounds.x, this.requestedFace.bounds.x, progress)
                    face.bounds.y = this.valueBetween(this.face.bounds.y, this.requestedFace.bounds.y, progress)
                    face.bounds.width = this.valueBetween(this.face.bounds.width, this.requestedFace.bounds.width, progress)
                    face.bounds.height = this.valueBetween(this.face.bounds.height, this.requestedFace.bounds.height, progress)
                    face.angle.yaw = this.valueBetween(this.face.angle.yaw, this.requestedFace.angle.yaw, progress)
                    face.angle.pitch = this.valueBetween(this.face.angle.pitch, this.requestedFace.angle.pitch, progress)
                }
            }
            const nameParts: string[] = []
            if (this.requestedFace.angle.pitch > 0) {
                nameParts.push("up")
            }
            if (this.requestedFace.angle.yaw < 0) {
                nameParts.push("left")
            } else if (this.requestedFace.angle.yaw > 0) {
                nameParts.push("right")
            } else {
                nameParts.push("straight")
            }
            image.onload = async () => {
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
                this.canvas.getContext("2d").drawImage(image, size.width / 2 - image.naturalWidth * scale / 2, size.height / 2 - image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale)
                this.canvas.toBlob(blob => {
                    image.onload = () => {
                        URL.revokeObjectURL(image.src)
                        if (face) {
                            this.jitterFace(face)
                        }
                        resolve(new FaceCapture(image, face))
                    }
                    image.src = URL.createObjectURL(blob)
                })
            }
            image.onerror = (ev) => {
                reject(ev)
            }
            image.src = "/images/"+nameParts.join("-")+".jpg"
        })
    }

}

/**
 * @category Face detection testing
 */
export class TestFaceDetectorFactory implements FaceDetectorFactory {

    createFaceDetector(): Promise<FaceDetector> {
        return Promise.resolve(new TestFaceDetector())
    }
    
}