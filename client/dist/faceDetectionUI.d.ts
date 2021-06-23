import { FaceCaptureSettings, LiveFaceCapture } from "./faceDetection";
export interface FaceCaptureUI {
    readonly video: HTMLVideoElement;
    trigger(event: FaceCaptureEvent): void;
    on<Event extends FaceCaptureEvent>(eventType: FaceCaptureEventType, callback: (event: Event) => void): void;
}
export declare type FaceCaptureBaseEvent = {
    type: FaceCaptureEventType;
};
export declare enum FaceCaptureEventType {
    FACE_CAPTURED = "face captured",
    CAPTURE_FINISHED = "capture finished",
    CLOSE = "close",
    CANCEL = "cancel"
}
export declare type FaceCaptureSimpleEvent = {
    type: FaceCaptureEventType.CLOSE | FaceCaptureEventType.CANCEL | FaceCaptureEventType.CAPTURE_FINISHED;
} & FaceCaptureBaseEvent;
export declare type FaceCaptureFaceCapturedEvent = {
    type: FaceCaptureEventType.FACE_CAPTURED;
    capture: LiveFaceCapture;
} & FaceCaptureBaseEvent;
export declare type FaceCaptureEvent = FaceCaptureFaceCapturedEvent | FaceCaptureSimpleEvent;
export declare class VerIDFaceCaptureUI implements FaceCaptureUI {
    private cameraOverlayCanvas;
    private cameraOverlayContext;
    private videoContainer;
    private cancelButton;
    private eventListeners;
    private hasFaceBeenAligned;
    private processingIndicator;
    private angleBar;
    readonly video: HTMLVideoElement;
    readonly settings: FaceCaptureSettings;
    constructor(settings: FaceCaptureSettings);
    trigger(event: FaceCaptureEvent): void;
    on<Event extends FaceCaptureEvent>(eventType: FaceCaptureEventType, callback: (event: Event) => void): void;
    private drawFaceAlignmentProgress;
    private drawDetectedFace;
    private cleanup;
    private showCaptureFinished;
}
