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
    CLOSE = "close",
    CANCEL = "cancel",
    MEDIA_STREAM_AVAILABLE = "media stream available"
}
export declare type FaceCaptureSimpleEvent = {
    type: FaceCaptureEventType.CLOSE | FaceCaptureEventType.CANCEL;
} & FaceCaptureBaseEvent;
export declare type FaceCaptureFaceCapturedEvent = {
    type: FaceCaptureEventType.FACE_CAPTURED;
    capture: LiveFaceCapture;
} & FaceCaptureBaseEvent;
export declare type FaceCaptureMediaStreamAvailableEvent = {
    type: FaceCaptureEventType.MEDIA_STREAM_AVAILABLE;
    stream: MediaStream;
} & FaceCaptureBaseEvent;
export declare type FaceCaptureEvent = FaceCaptureFaceCapturedEvent | FaceCaptureMediaStreamAvailableEvent | FaceCaptureSimpleEvent;
export declare class VerIDFaceCaptureUI implements FaceCaptureUI {
    private cameraOverlayCanvas;
    private cameraOverlayContext;
    private videoContainer;
    private cancelButton;
    private eventListeners;
    private hasFaceBeenAligned;
    readonly video: HTMLVideoElement;
    readonly settings: FaceCaptureSettings;
    constructor(settings: FaceCaptureSettings);
    trigger(event: FaceCaptureEvent): void;
    on<Event extends FaceCaptureEvent>(eventType: FaceCaptureEventType, callback: (event: Event) => void): void;
    private setVideoStream;
    private drawDetectedFace;
    private cleanup;
}
