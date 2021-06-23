import { Face, LiveFaceCapture } from "./faceDetection"
import * as faceapi from "face-api.js/build/es6"
import { estimateFaceAngle } from "./faceAngle"
import { estimateFaceAngle as estimateFaceAngleNoseTip } from "./faceAngleNoseTip"
import { Angle, imageFromFaceDetectionSource, Point, Rect } from "./utils"
import { Size } from "./types"

export type FaceDetectionElement = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
export type FaceDetectionSource = {
    element: FaceDetectionElement
    mirrored: boolean
}
export interface FaceDetector {
    detectFace(source: FaceDetectionSource): Promise<LiveFaceCapture>
}
export interface FaceDetectorFactory {
    createFaceDetector(): Promise<FaceDetector>
}

export class VerIDFaceDetector implements FaceDetector {

    private canvas: HTMLCanvasElement

    constructor() {
        this.canvas = document.createElement("canvas")
    }

    detectFace = async (source: FaceDetectionSource): Promise<LiveFaceCapture> => {
        const faceApiFace = await faceapi.detectSingleFace(source.element, new faceapi.TinyFaceDetectorOptions({"inputSize": 128})).withFaceLandmarks()
        let face: Face
        if (faceApiFace) {
            face = this.faceApiFaceToVerIDFace(faceApiFace, (source.element as HTMLVideoElement).videoWidth || (source.element as HTMLImageElement).naturalWidth || (source.element as HTMLCanvasElement).width, source.mirrored)
        } else {
            face = null
        }
        const image = imageFromFaceDetectionSource(this.canvas, source)
        return new LiveFaceCapture(image, face)
    }

    private calculateFaceAngle(face: any): Angle {
        const landmarks: Point[] = face.landmarks.positions.map(pt => new Point(pt.x, pt.y))
        return estimateFaceAngle(landmarks, estimateFaceAngleNoseTip)
    }

    private faceApiFaceToVerIDFace(face: any, imageWidth: number, mirrorOutput: boolean = false): Face {
        const angle: Angle = this.calculateFaceAngle(face)
        const leftEye: Point[] = face.landmarks.getLeftEye()
        const rightEye: Point[] = face.landmarks.getRightEye()
        const leftEyeCentre: Point = {
            "x": leftEye[0].x + (leftEye[3].x - leftEye[0].x) / 2,
            "y": leftEye[0].y + (leftEye[3].y - leftEye[0].y) / 2
        }
        const rightEyeCentre: Point = {
            "x": rightEye[0].x + (rightEye[3].x - rightEye[0].x) / 2,
            "y": rightEye[0].y + (rightEye[3].y - rightEye[0].y) / 2
        }
        const distanceBetweenEyes: number = Math.sqrt(Math.pow(rightEyeCentre.x - leftEyeCentre.x, 2) + Math.pow(rightEyeCentre.y - leftEyeCentre.y, 2))
        const ovalCentre: Point = {
            "x": leftEyeCentre.x + (rightEyeCentre.x - leftEyeCentre.x) / 2,
            "y": leftEyeCentre.y + (rightEyeCentre.y - leftEyeCentre.y) / 2
        }
        const ovalSize: Size = {
            "width": distanceBetweenEyes * 3,
            "height": 0
        }
        ovalSize.height = ovalSize.width / 4 * 5
        if (mirrorOutput) {
            ovalCentre.x = imageWidth - ovalCentre.x
            angle.yaw = 0-angle.yaw
        }
        ovalCentre.y += ovalSize.height * 0.04
        const veridFace: Face = new Face(new Rect(ovalCentre.x - ovalSize.width / 2, ovalCentre.y - ovalSize.height / 2, ovalSize.width, ovalSize.height), angle)
        if (mirrorOutput) {
            veridFace.bounds = veridFace.bounds.mirrored(imageWidth)
        }
        return veridFace
    }
}

export class VerIDFaceDetectorFactory implements FaceDetectorFactory {

    createFaceDetector = async(): Promise<FaceDetector> => {
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
            faceapi.nets.faceLandmark68Net.loadFromUri("/models")
        ])
        return new VerIDFaceDetector()
    }
}