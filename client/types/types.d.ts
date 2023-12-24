import { BlinkIdMultiSideRecognizerResult, IdBarcodeRecognizerResult, BlinkIdMultiSideRecognizer, IdBarcodeRecognizer, BlinkIdSingleSideRecognizerResult, BlinkIdSingleSideRecognizer } from "@microblink/blinkid-in-browser-sdk";
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
export declare type SupportedRecognizerResult = BlinkIdMultiSideRecognizerResult | BlinkIdSingleSideRecognizerResult | IdBarcodeRecognizerResult;
declare type SupportedWrappedRecognizer = BlinkIdMultiSideRecognizer | BlinkIdSingleSideRecognizer | IdBarcodeRecognizer;
/**
 * @category ID capture
 */
export declare type SupportedRecognizer = SupportedWrappedRecognizer;
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
     * Face roll angle (degrees)
     */
    rotation: number;
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
/**
 * Angle
 * @internal
 */
export declare class Angle {
    /**
     * Yaw
     */
    yaw: number;
    /**
     * Pitch
     */
    pitch: number;
    /**
     * Roll
     */
    roll: number;
    /**
     * Constructor
     * @param yaw Yaw
     * @param pitch Pitch
     * @param roll Roll
     */
    constructor(yaw?: number, pitch?: number, roll?: number);
    /**
     * Arc tangent of the pitch and yaw (used for displaying the angle on screen)
     */
    get screenAngle(): number;
}
/**
 * Point
 * @internal
 */
export declare class Point {
    /**
     * Horizontal coordinate
     */
    x: number;
    /**
     * Vertical coordinate
     */
    y: number;
    /**
     * Constructor
     * @param x Horizontal coordinate
     * @param y Vertical coordinate
     */
    constructor(x?: number, y?: number);
}
/**
 * Rectangle
 * @internal
 */
export declare class Rect {
    /**
     * Left edge of the rectangle
     */
    x: number;
    /**
     * Top edge of the rectangle
     */
    y: number;
    /**
     * Top edge of the rectangle
     */
    width: number;
    /**
     * Rectangle height
     */
    height: number;
    /**
     * Constructor
     * @param x Left edge of the rectangle
     * @param y Top edge of the rectangle
     * @param width Top edge of the rectangle
     * @param height Rectangle height
     */
    constructor(x: number, y: number, width: number, height: number);
    /**
     * Inset all edges of the rectangle by the given amounts
     * @param xInset Horizontal inset
     * @param yInset Vertical inset
     */
    inset(xInset: number, yInset: number): void;
    /**
     * Find out whether this rectangle contains another rectangle
     * @param rect Challenge rectangle
     * @returns `true` if this rectangle contains the challenge rectangle
     */
    contains(rect: Rect): boolean;
    /**
     * Center of the rectangle
     */
    get center(): Point;
    /**
     * Scale rectangle by the given scale factor and return a new rectangle
     * @param scaleX Horizontal scale
     * @param scaleY Vertical scale (optional, if not specified scaleX will be used)
     * @returns New rectangle that is this rectangle scaled by the scale values
     */
    scaledBy(scaleX: number, scaleY?: number): Rect;
    /**
     * @param planeWidth Width of the plane in which the rectangle should be mirrored
     * @returns Rectangle mirrored horizontally along the plane's vertical axis
     */
    mirrored(planeWidth: number): Rect;
    get right(): number;
    get bottom(): number;
    equals: (other: Rect) => boolean;
}
/**
 * Extents of a face within a view
 * @remarks
 * Used by liveness detection session to determine the area where to show the face in relation to the containing view
 * @category Face detection
 */
export declare class FaceExtents {
    /**
     * Proportion of view width, e.g., 0.65 is 65% of the view width
     */
    readonly proportionOfViewWidth: number;
    /**
     * Proportion of view height, e.g., 0.85 is 85% of the view height
     */
    readonly proportionOfViewHeight: number;
    /**
     * Constructor
     * @param proportionOfViewWidth Proportion of view width
     * @param proportionOfViewHeight Proportion of view height
     */
    constructor(proportionOfViewWidth: number, proportionOfViewHeight: number);
}
/**
 * Capture of a live face
 * @category Face detection
 */
export declare class FaceCapture {
    /**
     * Image in which the face was detected
     */
    readonly image: Blob;
    /**
     * Face or `null` if no face is detected in the image
     */
    readonly face: Face | null;
    /**
     * Bearing requested at the time of capture
     */
    requestedBearing?: Bearing;
    /**
     * Smoothed bounds of the face and of the faces captured previously in the session
     */
    faceBounds?: Rect;
    /**
     * Smoothed angle of the face and of the faces captured previously in the session
     * @internal
     */
    faceAngle?: Angle;
    /**
     * Face alignment status at time of capture
     * @internal
     */
    faceAlignmentStatus?: FaceAlignmentStatus;
    /**
     * Difference between the angle of the requested bearing and the angle of the detected face
     * @internal
     */
    offsetAngleFromBearing?: Angle;
    /**
     * Number between 0 and 1 representing the trajectory to the requested bearing angle.
     * `1` means the face is moving straight towards the requested bearing.
     * `0` means the face is moving in the opposite direction than the requested bearing.
     */
    angleTrajectory: number | undefined;
    angleDistance: number;
    /**
     * Image cropped to the bounds of the detected face
     */
    readonly faceImage: Blob;
    readonly imageSize: Size;
    readonly time: number;
    /**
     * Constructor
     * @param image Image in which the face was detected
     * @param face Face or `null` if no face was detected in the image
     * @internal
     */
    private constructor();
    static create(image: Blob, face: Face | null): Promise<FaceCapture>;
}
/**
 * Face detected in an image
 * @category Face detection
 */
export declare class Face {
    /**
     * Bounds of the face
     */
    bounds: Rect;
    /**
     * Angle of the face
     */
    angle: Angle;
    /**
     * Face template (used for face recognition)
     */
    template?: string;
    /**
     * Constructor
     * @param bounds Bounds
     * @param angle Angle
     * @internal
     */
    constructor(bounds: Rect, angle: Angle);
}
export {};
