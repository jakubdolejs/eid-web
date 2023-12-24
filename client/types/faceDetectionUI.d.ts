import { FaceCapture } from "./types";
import { LivenessDetectionSessionSettings } from "./livenessDetectionSession";
/**
 * @category Face detection
 */
export interface LivenessDetectionSessionUI {
    readonly video: HTMLVideoElement;
    trigger(event: LivenessDetectionSessionEvent): void;
    on<Event extends LivenessDetectionSessionEvent>(eventType: LivenessDetectionSessionEventType, callback: (event: Event) => void): void;
}
/**
 * @category Face detection
 */
export declare type LivenessDetectionSessionBaseEvent = {
    type: LivenessDetectionSessionEventType;
};
/**
 * @category Face detection
 */
export declare enum LivenessDetectionSessionEventType {
    LOADED = "face detection loaded",
    FACE_CAPTURED = "face captured",
    CAPTURE_FINISHED = "capture finished",
    CLOSE = "close",
    CANCEL = "cancel"
}
/**
 * @category Face detection
 */
export declare type LivenessDetectionSessionSimpleEvent = {
    type: LivenessDetectionSessionEventType.LOADED | LivenessDetectionSessionEventType.CLOSE | LivenessDetectionSessionEventType.CANCEL | LivenessDetectionSessionEventType.CAPTURE_FINISHED;
} & LivenessDetectionSessionBaseEvent;
/**
 * @category Face detection
 */
export declare type LivenessDetectionSessionFaceCapturedEvent = {
    type: LivenessDetectionSessionEventType.FACE_CAPTURED;
    capture: FaceCapture;
} & LivenessDetectionSessionBaseEvent;
/**
 * @category Face detection
 */
export declare type LivenessDetectionSessionEvent = LivenessDetectionSessionFaceCapturedEvent | LivenessDetectionSessionSimpleEvent;
/**
 * @category Face detection
 */
export declare class VerIDLivenessDetectionSessionUI implements LivenessDetectionSessionUI {
    private cameraOverlayCanvas;
    private cameraOverlayContext;
    private videoContainer;
    private cancelButton;
    private eventListeners;
    private hasFaceBeenAligned;
    private processingIndicator;
    private _video;
    readonly settings: LivenessDetectionSessionSettings;
    constructor(settings: LivenessDetectionSessionSettings);
    get video(): HTMLVideoElement;
    trigger(event: LivenessDetectionSessionEvent): void;
    on<Event extends LivenessDetectionSessionEvent>(eventType: LivenessDetectionSessionEventType, callback: (event: Event) => void): void;
    private drawDetectedFace;
    private cleanup;
    private showCaptureFinished;
}
