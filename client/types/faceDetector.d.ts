import { FaceCapture } from "./types";
import { ImageSource } from "./types";
/**
 * @category Face detection
 */
export declare type FaceDetectionSource = {
    element: ImageSource;
    mirrored: boolean;
};
/**
 * @category Face detection
 */
export interface FaceDetector {
    detectFace(source: FaceDetectionSource): Promise<FaceCapture>;
}
/**
 * @category Face detection
 */
export interface FaceDetectorFactory {
    createFaceDetector(): Promise<FaceDetector>;
}
/**
 * @category Face detection
 */
export declare class VerIDFaceDetector implements FaceDetector {
    detectFace: (source: FaceDetectionSource) => Promise<FaceCapture>;
    private calculateFaceAngle;
    private faceApiFaceToVerIDFace;
}
/**
 * @category Face detection testing
 */
export declare class VerIDFaceDetectorFactory implements FaceDetectorFactory {
    createFaceDetector: () => Promise<FaceDetector>;
}
