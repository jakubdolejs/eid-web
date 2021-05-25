import { Observable } from "rxjs";
import { RecognizableFace } from "./faceRecognition";
import { Size } from "./utils";
import { BlinkIdRecognizerResult, IdBarcodeRecognizerResult, BlinkIdCombinedRecognizerResult, MetadataCallbacks, ImageOrientation } from "@microblink/blinkid-in-browser-sdk";
declare type ProgressListener = (progress: number) => void;
export declare type IdCaptureStatus = "pass" | "review" | "fail";
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
export interface Address {
    street: string;
    city: string;
    postalCode: string;
    jurisdiction: string;
}
export interface IDDocument {
    documentNumber: string;
    firstName: string;
    lastName: string;
    warnings: Set<Warning>;
    dateOfBirth: DocumentDate;
    dateOfExpiry: DocumentDate;
    recognizer: RecognizerType;
}
export interface DatedDocument {
    dateOfIssue: DocumentDate;
}
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
export interface ImageQuality {
    brightness: number;
    contrast: number;
    sharpness: number;
}
export declare type RecognizerType = "BLINK_ID" | "USDL" | "PASSPORT";
export interface DocumentDate {
    day: number;
    month: number;
    year: number;
    successfullyParsed?: boolean;
    originalString?: string;
}
export interface ClassInfo {
    country: string;
    region: string;
    type: string;
    countryName: string;
    isoAlpha3CountryCode: string;
    isoAlpha2CountryCode: string;
    isoNumericCountryCode: string;
}
export interface DocumentFrontPage extends IDDocument, ImageDocument, DatedDocument {
    classInfo: ClassInfo;
    fullName: string;
    address: string;
    authenticityScores: {
        [k: string]: number;
    };
    authenticityScore: number;
}
export interface DocumentBackPage extends IDDocument, DatedDocument {
    barcode: string;
    issuerIdentificationNumber: string;
    fullName: string;
    address: Address;
}
export interface PassportDocument extends IDDocument, ImageDocument {
    rawMRZString: string;
    issuer: string;
    nationality: string;
    mrtdVerified: boolean;
    recognitionStatus: string;
}
export declare type CapturedDocument<T extends RecognizerType> = T extends "PASSPORT" ? PassportDocument : T extends "USDL" ? DocumentBackPage : DocumentFrontPage;
export declare enum DocumentPages {
    FRONT = "front",
    BACK = "back",
    FRONT_AND_BACK = "front and back"
}
export declare type IdCaptureResult = {
    face?: RecognizableFace;
    pages: DocumentPages;
    result: SupportedRecognizerResult;
    capturedImage?: {
        data: ImageData;
        orientation: ImageOrientation;
    };
};
export declare class Warning {
    readonly code: number;
    readonly description: string;
    constructor(code: number, description: string);
}
export declare type SupportedRecognizerResult = BlinkIdCombinedRecognizerResult | BlinkIdRecognizerResult | IdBarcodeRecognizerResult;
export interface IIdCaptureUI {
    setProgress(progress: number): void;
    showPrompt(text: string, force: boolean): void;
    showFlipCardInstruction(onDone?: () => void): void;
    removeProgressBar(): void;
    hideCameraOverlay(): void;
    showCameraOverlay(): void;
    cleanup(): void;
    createMetadataCallbacks(onFirstSide?: () => void): MetadataCallbacks;
    readonly progressListener: ProgressListener;
    readonly video: HTMLVideoElement;
    onCancel: () => void;
}
export declare class IdCapture {
    readonly serviceURL: string;
    private readonly faceRecognition;
    private readonly loadBlinkWasmModule;
    private percentLoaded;
    private loadListeners;
    private wasmSDK;
    constructor(settings: IdCaptureSettings, serviceURL?: string);
    private onLoadProgressCallback;
    private registerLoadListener;
    private unregisterLoadListener;
    private createBlinkIdCombinedRecognizer;
    private createBlinkIdRecognizer;
    private createBarcodeRecognizer;
    private imageDataToImage;
    private convertToIdCaptureResult;
    private runIdCaptureSession;
    /**
     * Detect ID card in images
     * @param images Base64-encoded images of the ID card
     * @returns Promise
     */
    detectIdCard(images: {
        front?: string;
        back?: string;
    }): Promise<IdCaptureResponse>;
    private emitResult;
    private recognizerRunner;
    private getRecognizerRunner;
    private createRecognizers;
    /**
     * Capture ID card using the device camera
     * @returns Observable
     */
    captureIdCard(settings?: IdCaptureSessionSettings): Observable<IdCaptureResult>;
}
export declare class IdCaptureSettings {
    licenceKey: string;
    resourcesPath: string;
    constructor(licenceKey: string, resourcesPath: string);
}
export declare class IdCaptureSessionSettings {
    pages: DocumentPages;
    saveCapturedImages: boolean;
    constructor(pages?: DocumentPages, saveCapturedImages?: boolean);
}
export {};
