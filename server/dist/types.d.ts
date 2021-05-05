export interface Face {
    box?: number[];
    quality: number;
    template: string;
    classifiers?: {
        [k: string]: number;
    };
}
export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
export declare enum RecognizerType {
    BlinkId = "BLINK_ID",
    Usdl = "USDL"
}
export declare enum WaitOptions {
    One = "one",
    All = "all"
}
declare type ClassifierArray = (string | number)[];
export interface FaceDetectionRequest {
    user: string;
    image: string;
    wait: WaitOptions;
    parameters?: {
        classifiers?: ClassifierArray[];
        detector_version?: number;
    };
}
export interface FaceDetectionResponse {
    faces: Face[];
    status: string;
}
export interface DetectedFace {
    jpeg: string;
    faceTemplate: string;
}
export interface DetectFaceResponse extends DetectedFace {
    authenticityScores?: {
        [k: string]: number;
    };
}
export interface CompareFacesRequest {
    target: string;
    faces: string[];
}
export interface CompareFacesResponse {
    score: number;
    token?: string;
}
export interface Classifier {
    prefix: string;
    threshold: number;
}
export interface IDCardDate {
    day: number;
    month: number;
    year: number;
    originalString: string;
}
export interface IDCardImage {
    rawImage: ImageData;
    encodedImage: Uint8Array;
}
export interface IDCaptureResponse {
    face?: DetectedFace;
    result: IDCaptureResult;
}
export interface IDCaptureResult {
    address?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    documentNumber?: string;
    barcode?: {
        address?: string;
        addressDetailedInfo?: {
            city?: string;
            jurisdiction?: string;
            postalCode?: string;
            street?: string;
        };
        barcodeData: {
            barcodeFormat: number;
            rawBytes: Uint8Array;
            stringData: string;
            uncertain: boolean;
        };
        dateOfBirth: IDCardDate;
        dateOfExpiry: IDCardDate;
        dateOfIssue: IDCardDate;
        documentNumber: string;
        driverLicenseDetailedInfo?: {
            conditions: string;
            endorsements: string;
            restrictions: string;
            vehicleClass: string;
        };
        firstName: string;
        fullName: string;
        lastName: string;
        middleName?: string;
        sex: string;
    };
    classInfo?: {
        country: number;
        countryName: string;
        documentType: number;
        isoAlpha2CountryCode: string;
        isoAlpha3CountryCode: string;
        isoNumericCountryCode: string;
        region: number;
    };
    dataMatch?: number;
    dateOfBirth?: IDCardDate;
    dateOfExpiry?: IDCardDate;
    dateOfIssue?: IDCardDate;
    driverLicenseDetailedInfo?: {
        conditions: string;
        endorsements: string;
        restrictions: string;
        vehicleClass: string;
    };
    frontViz?: {
        address?: string;
        dateOfBirth?: IDCardDate;
        dateOfExpiry?: IDCardDate;
        dateOfIssue?: IDCardDate;
        firstName?: string;
        fullName?: string;
        lastName?: string;
        documentNumber?: string;
        sex?: string;
    };
    fullDocumentFrontImage?: IDCardImage;
    fullDocumentBackImage?: IDCardImage;
}
export {};
