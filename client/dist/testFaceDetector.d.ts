import { FaceCapture } from "./faceDetection";
import { FaceDetectionSource, FaceDetector, FaceDetectorFactory } from "./faceDetector";
import { FaceRequirements, FaceRequirementListener } from "./types";
/**
 * @category Face detection testing
 */
export declare class TestFaceDetector implements FaceDetector, FaceRequirementListener {
    private face;
    private requestedFace;
    private lastRequestTime;
    private turnDurationMs;
    private canvas;
    constructor();
    onChange: (requirements: FaceRequirements) => void;
    private valueBetween;
    private jitterValue;
    private jitterFace;
    detectFace(source: FaceDetectionSource): Promise<FaceCapture>;
}
/**
 * @category Face detection testing
 */
export declare class TestFaceDetectorFactory implements FaceDetectorFactory {
    createFaceDetector(): Promise<FaceDetector>;
}
