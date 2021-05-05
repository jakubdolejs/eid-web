import { Observable } from "rxjs";
import { RecognizableFace } from "./faceRecognition";
import { BlinkIdCombinedRecognizerResult } from "@microblink/blinkid-in-browser-sdk/types";
export interface IdCaptureResult {
    face: RecognizableFace;
    result: BlinkIdCombinedRecognizerResult;
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
    detectIdCard(images: {
        front?: string;
        back?: string;
    }): Promise<{
        face?: RecognizableFace;
    }[]>;
    /**
     * @returns
     * @experimental
     * @alpha
     */
    captureIdCard(): Observable<IdCaptureResult>;
}
export declare class IdCaptureSettings {
    licenceKey: string;
    resourcesPath: string;
    constructor(licenceKey: string, resourcesPath: string);
}
