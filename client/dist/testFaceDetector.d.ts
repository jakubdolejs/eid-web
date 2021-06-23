import { LiveFaceCapture } from "./faceDetection";
import { FaceDetectionSource, FaceDetector, FaceDetectorFactory } from "./faceDetector";
import { FaceRequirementListener } from "./livenessDetectionSession";
import { FaceRequirements } from "./types";
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
    detectFace(source: FaceDetectionSource): Promise<LiveFaceCapture>;
}
export declare class TestFaceDetectorFactory implements FaceDetectorFactory {
    createFaceDetector(): Promise<FaceDetector>;
}
