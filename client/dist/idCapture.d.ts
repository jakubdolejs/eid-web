import { Observable } from "rxjs";
import { RecognizableFace } from "./faceRecognition";
import { BlinkIdCombinedRecognizerResult } from "@microblink/blinkid-in-browser-sdk/types";
import { Size } from "./utils";
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
export interface IdCaptureResult {
    face?: RecognizableFace;
    result: BlinkIdCombinedRecognizerResult;
}
export declare class Warning {
    readonly code: number;
    readonly description: string;
    constructor(code: number, description: string);
}
export declare class IdCapture {
    readonly serviceURL: string;
    private readonly faceRecognition;
    private readonly loadBlinkWasmModule;
    private percentLoaded;
    private loadListeners;
    constructor(settings: IdCaptureSettings, serviceURL?: string);
    private onLoadProgressCallback;
    private registerLoadListener;
    private unregisterLoadListener;
    /**
     * Detect ID card in images
     * @param images Base64-encoded images of the ID card
     * @returns Promise
     */
    detectIdCard(images: {
        front?: string;
        back?: string;
    }): Promise<IdCaptureResponse>;
    /**
     * Capture ID card using the device camera
     * @returns Observable
     */
    captureIdCard(): Observable<IdCaptureResult>;
}
export declare class IdCaptureSettings {
    licenceKey: string;
    resourcesPath: string;
    constructor(licenceKey: string, resourcesPath: string);
}
