import { BlinkIdCombinedRecognizerResult, BlinkIdRecognizerResult, IdBarcodeRecognizerResult, BlinkIdCombinedRecognizer, BlinkIdRecognizer, IdBarcodeRecognizer, SuccessFrameGrabberRecognizer } from "@microblink/blinkid-in-browser-sdk";
import { FaceCapture } from "./faceDetection";
import { Angle, Rect } from "./utils";
/**
 * @category ID capture
 */
export declare type IdCaptureStatus = "pass" | "review" | "fail";
/**
 * @category ID capture
 */
export interface IdCaptureResponse {
    error?: any;
    result: {
        front?: DocumentFrontPage;
        back?: DocumentBackPage;
        passport?: PassportDocument;
    };
    warnings?: Warning[];
    status: IdCaptureStatus;
}
/**
 * @category ID capture
 */
export interface Address {
    street: string;
    city: string;
    postalCode: string;
    jurisdiction: string;
}
/**
 * @category ID capture
 * @internal
 */
export interface IDDocument {
    documentNumber: string;
    firstName: string;
    lastName: string;
    warnings: Set<Warning>;
    dateOfBirth: DocumentDate;
    dateOfExpiry: DocumentDate;
    recognizer: RecognizerType;
}
/**
 * @category ID capture
 * @internal
 */
export interface DatedDocument {
    dateOfIssue: DocumentDate;
}
/**
 * @category ID capture
 * @internal
 */
export interface ImageDocument {
    image: string;
    faces: {
        x: number;
        y: number;
        width: number;
        height: number;
        quality: number;
        template: string;
    }[];
    imageAnalysis: ImageQuality;
    imageSize: Size;
}
/**
 * @internal
 */
export interface ImageQuality {
    brightness: number;
    contrast: number;
    sharpness: number;
}
/**
 * @category ID capture
 */
export declare type RecognizerType = "BLINK_ID" | "USDL" | "PASSPORT";
/**
 * @category ID capture
 */
export interface DocumentDate {
    day: number;
    month: number;
    year: number;
    successfullyParsed?: boolean;
    originalString?: string;
}
/**
 * @category ID capture
 */
export interface ClassInfo {
    country: string;
    region: string;
    type: string;
    countryName: string;
    isoAlpha3CountryCode: string;
    isoAlpha2CountryCode: string;
    isoNumericCountryCode: string;
}
/**
 * @category ID capture
 * @internal
 */
export interface DocumentFrontPage extends IDDocument, ImageDocument, DatedDocument {
    classInfo: ClassInfo;
    fullName: string;
    address: string;
    authenticityScores: {
        [k: string]: number;
    };
    authenticityScore: number;
}
/**
 * @category ID capture
 * @internal
 */
export interface DocumentBackPage extends IDDocument, DatedDocument {
    barcode: string;
    issuerIdentificationNumber: string;
    fullName: string;
    address: Address;
}
/**
 * @category ID capture
 * @internal
 */
export interface PassportDocument extends IDDocument, ImageDocument {
    rawMRZString: string;
    issuer: string;
    nationality: string;
    mrtdVerified: boolean;
    recognitionStatus: string;
}
/**
 * @category ID capture
 * @internal
 */
export declare type CapturedDocument<T extends RecognizerType> = T extends "PASSPORT" ? PassportDocument : T extends "USDL" ? DocumentBackPage : DocumentFrontPage;
/**
 * @category ID capture
 */
export declare enum DocumentPages {
    FRONT = "front",
    BACK = "back",
    FRONT_AND_BACK = "front and back"
}
/**
 * @category ID capture
 */
export declare enum DocumentSide {
    FRONT = "front",
    BACK = "back"
}
/**
 * @category ID capture
 */
export declare class IdCaptureResult {
    face?: RecognizableFace;
    pages: DocumentPages;
    result: SupportedRecognizerResult;
    constructor(result: SupportedRecognizerResult, pages: DocumentPages, face?: RecognizableFace);
    documentImage(side: DocumentSide, cropToDocument?: boolean, maxSize?: number): Promise<ImageData>;
}
export declare class Warning {
    readonly code: number;
    readonly description: string;
    constructor(code: number, description: string);
}
/**
 * @category ID capture
 */
export declare type SupportedRecognizerResult = BlinkIdCombinedRecognizerResult | BlinkIdRecognizerResult | IdBarcodeRecognizerResult;
declare type SupportedWrappedRecognizer = BlinkIdCombinedRecognizer | BlinkIdRecognizer | IdBarcodeRecognizer;
/**
 * @category ID capture
 */
export declare type SupportedRecognizer = SupportedWrappedRecognizer | SuccessFrameGrabberRecognizer<SupportedWrappedRecognizer>;
/**
 * @internal
 */
export declare type ProgressListener = (progress: number) => void;
/**
 * Image source
 */
export declare type ImageSource = HTMLCanvasElement | HTMLImageElement | HTMLVideoElement | Blob | ImageData | string;
/**
 * @category Face recognition
 */
export declare type RecognizableFaceDetectionInput = {
    [k: string]: {
        image: ImageSource;
        faceRect?: Rect;
    };
};
/**
 * @category Face recognition
 */
export declare type RecognizableFaceDetectionOutput = {
    [k: string]: RecognizableFace;
};
/**
 * ID capture UI interface
 *
 * Facilitates the implementation of a custom user interface for ID capture sessions
 * @category ID capture
 */
export interface IdCaptureUI {
    /**
     * Video element to display the camera feed
     */
    readonly video: HTMLVideoElement;
    /**
     * Trigger an ID capture event
     *
     * The trigger method will be called by the ID capture throughout the session.
     * It's up to your class to handle the triggers.
     * @param event Triggered event
     */
    trigger(event: IdCaptureEvent): void;
    /**
     * Set a listener for the given event type
     * @param eventType Event type to listen for
     * @param callback Callback to be invoked when the event is triggered
     */
    on<Event extends IdCaptureEvent>(eventType: IdCaptureEventType, callback: (event: Event) => void): void;
}
/**
 * @category ID capture
 */
export declare type IdCaptureEvent = {
    type: IdCaptureEventType;
};
/**
 * @category ID capture
 */
export declare type IdCaptureProgressEvent = IdCaptureEvent & {
    progress: number;
};
/**
 * ID capture event types
 * @category ID capture
 */
export declare enum IdCaptureEventType {
    /**
     * ID capture session has been cancelled (e.g., user clicking on a cancel button)
     */
    CANCEL = "cancel",
    /**
     * Page of an ID document has been captured
     */
    PAGE_CAPTURED = "page captured",
    /**
     * ID capture session requested to capture the next page of the ID document
     */
    NEXT_PAGE_REQUESTED = "next page requested",
    /**
     * Camera is too far from the document
     */
    CAMERA_TOO_FAR = "camera too far",
    /**
     * Camera is too close to the document
     */
    CAMERA_TOO_CLOSE = "camera too close",
    /**
     * Camera is pointing at the document at an angle
     */
    CAMERA_ANGLED = "camera angled",
    /**
     * ID capture session is looking for a face on the document
     */
    FINDING_FACE = "finding face",
    /**
     * ID capture is capturing the document
     */
    CAPTURING = "capturing",
    /**
     * ID capture session ended
     */
    CAPTURE_ENDED = "capture ended",
    /**
     * ID capture session started
     */
    CAPTURE_STARTED = "capture started",
    /**
     * ID capture library loading progressed
     */
    LOADING_PROGRESSED = "loading progressed",
    /**
     * ID capture library has been loaded
     */
    LOADED = "loaded",
    /**
     * Failed to load the ID capture library
     */
    LOADING_FAILED = "loading failed"
}
/**
 * Face that contains a template that can be used for face recognition
 * @category Face recognition
 */
export interface RecognizableFace {
    /**
     * Distance of the face from the left side of the image (percent of image width)
     */
    x: number;
    /**
     * Distance of the face from the top side of the image (percent of image height)
     */
    y: number;
    /**
     * Width of the face (percent of image width)
     */
    width: number;
    /**
     * Height of the face (percent of image height)
     */
    height: number;
    /**
     * Quality of the detected face – ranges from 0 (worst) to 10 (best)
     */
    quality: number;
    /**
     * Base64-encoded face recognition template
     */
    template: string;
}
/**
 * Axis
 * @category Face detection
 * @internal
 */
export declare enum Axis {
    /**
     * Yaw axis
     */
    YAW = 0,
    /**
     * Pitch axis
     */
    PITCH = 1
}
export interface Size {
    width: number;
    height: number;
}
/**
 * Face alignment status
 * @category Face detection
 * @internal
 */
export declare enum FaceAlignmentStatus {
    FOUND = 0,
    FIXED = 1,
    ALIGNED = 2,
    MISALIGNED = 3
}
/**
 * Bearing
 * @category Face detection
 */
export declare enum Bearing {
    STRAIGHT = 0,
    LEFT = 1,
    RIGHT = 2,
    UP = 3,
    DOWN = 4,
    LEFT_UP = 5,
    RIGHT_UP = 6,
    LEFT_DOWN = 7,
    RIGHT_DOWN = 8
}
/**
 * @category ID capture
 */
export declare type RecognizerName = "BlinkIdCombinedRecognizer" | "BlinkIdRecognizer" | "IdBarcodeRecognizer";
/**
 * @category ID capture
 */
export declare type IdCaptureUIFactory = () => IdCaptureUI;
export declare type Range<Type> = {
    from: Type;
    to: Type;
};
/**
 * @category Face detection
 */
export declare type FaceRequirements = {
    imageSize: Size;
    ideal: {
        bounds: Rect;
        angle: Angle;
    };
    accepted: {
        left: Range<number>;
        top: Range<number>;
        right: Range<number>;
        bottom: Range<number>;
        yaw: Range<number>;
        pitch: Range<number>;
    };
};
/**
 * @category Face detection
 */
export declare type FaceRequirementListener = {
    onChange: (requirements: FaceRequirements) => void;
};
/**
 * @category Face detection
 */
export declare type FaceCaptureCallback = (faceCapture: FaceCapture) => void;
export {};
