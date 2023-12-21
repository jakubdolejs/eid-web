import { FaceCapture } from "./types";
import { FaceDetectionSource, FaceDetector, FaceDetectorFactory } from "./faceDetector";
import { FaceRequirements, FaceRequirementListener } from "./types";
declare enum FaceImageSrc {
    STRAIGHT = "/images/straight.jpg",
    LEFT = "/images/left.jpg",
    RIGHT = "/images/right.jpg",
    UP_LEFT = "/images/up-left.jpg",
    UP_RIGHT = "/images/up-right.jpg"
}
/**
 * @category Face detection testing
 */
export declare class TestFaceDetector implements FaceDetector, FaceRequirementListener {
    private face;
    private requestedFace;
    private lastRequestTime;
    private turnDurationMs;
    private canvas;
    private readonly images;
    constructor(images: Record<keyof typeof FaceImageSrc, HTMLImageElement>);
    onChange: (requirements: FaceRequirements) => void;
    private valueBetween;
    private jitterValue;
    private jitterFace;
    readonly detectFace: (source: FaceDetectionSource) => Promise<FaceCapture>;
}
/**
 * @category Face detection testing
 */
export declare class TestFaceDetectorFactory implements FaceDetectorFactory {
    createFaceDetector(): Promise<FaceDetector>;
}
export {};
