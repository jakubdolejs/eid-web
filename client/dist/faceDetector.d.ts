import { LiveFaceCapture } from "./faceDetection";
export declare type FaceDetectionElement = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;
export declare type FaceDetectionSource = {
    element: FaceDetectionElement;
    mirrored: boolean;
};
export interface FaceDetector {
    detectFace(source: FaceDetectionSource): Promise<LiveFaceCapture>;
}
export interface FaceDetectorFactory {
    createFaceDetector(): Promise<FaceDetector>;
}
export declare class VerIDFaceDetector implements FaceDetector {
    private canvas;
    constructor();
    detectFace: (source: FaceDetectionSource) => Promise<LiveFaceCapture>;
    private calculateFaceAngle;
    private faceApiFaceToVerIDFace;
}
export declare class VerIDFaceDetectorFactory implements FaceDetectorFactory {
    createFaceDetector: () => Promise<FaceDetector>;
}
