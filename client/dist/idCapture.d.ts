import { Observable } from "rxjs";
import { DocumentPages, IdCaptureResponse, IdCaptureResult, IdCaptureUIFactory } from "./types";
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
    private createBlinkIdCombinedRecognizer;
    private createBlinkIdRecognizer;
    private createBarcodeRecognizer;
    private imageDataToImage;
    private convertToIdCaptureResult;
    private getResultFromRecognizer;
    private getRecognizerName;
    private removeRecognizer;
    private getRecognitionCallback;
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
    private recognizerRunner;
    private getRecognizerRunner;
    private createRecognizers;
    private createMetadataCallbacks;
    private emitEvent;
    /**
     * Capture ID card using the device camera
     * @param settings Session settings
     * @returns Observable
     */
    captureIdCard(settings?: IdCaptureSessionSettings): Observable<IdCaptureResult>;
}
/**
 * ID capture settings
 */
export declare class IdCaptureSettings {
    /**
     * Microblink licence key (must be issued for the domain name of the running application)
     */
    licenceKey: string;
    /**
     * Path to resources used by the ID capture
     */
    resourcesPath: string;
    /**
     * URL for the server accepting the supporting face detection and ID capture calls
     */
    serviceURL: string;
    /**
     * Construtor
     * @param licenceKey Microblink licence key (must be issued for the domain name of the running application)
     * @param resourcesPath Path to resources used by the ID capture
     * @param serviceURL URL for the server accepting the supporting face detection and ID capture calls
     */
    constructor(licenceKey: string, resourcesPath: string, serviceURL?: string);
}
/**
 * ID capture session settings
 */
export declare class IdCaptureSessionSettings {
    /**
     * Pages to capture
     */
    pages: DocumentPages;
    /**
     * Indicates whether the session should save the images obtained from the camera that have been used in successful capture
     */
    saveCapturedImages: boolean;
    /**
     * Session timeout in milliseconds
     */
    timeout: number;
    /**
     * Create ID capture UI
     * @returns Function that creates an instance of the IdCaptureUI interface
     */
    createUI: IdCaptureUIFactory;
    /**
     * Constructor
     * @param pages Pages to capture
     * @param timeout Session timeout in milliseconds (default = infinity)
     * @param saveCapturedImages Indicates whether the session should save the images obtained from the camera that have been used in successful capture (default = `false`)
     */
    constructor(pages?: DocumentPages, timeout?: number, saveCapturedImages?: boolean);
}
