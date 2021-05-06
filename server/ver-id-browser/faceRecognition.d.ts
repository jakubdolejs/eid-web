/**
 * Ver-ID face recognition
 * @packageDocumentation
 */
import { Rect } from "./utils";
/**
 * Face that contains a template that can be used for face recognition
 */
export interface RecognizableFace {
    /**
     * Base64-encoded JPEG image
     */
    jpeg: string;
    /**
     * Base64-encoded JPEG image
     */
    faceTemplate: string;
    /**
     * Authenticity scores keyed by licence model prefix
     */
    authenticityScores?: {
        [k: string]: number;
    };
}
/**
 * Face recognition
 */
export declare class FaceRecognition {
    /**
     * Base URL of the server that accepts the face detection and comparison calls
     */
    readonly serviceURL: string;
    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    constructor(serviceURL?: string);
    /**
     * Create a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional bounds of a face in the image
     * @returns Promise that delivers a face that can be used for face recognition
     */
    createRecognizableFace(image: HTMLImageElement | string, faceRect?: Rect, calculateAuthenticityScore?: boolean): Promise<RecognizableFace>;
    private cropImage;
    /**
     * Compare face templates and return similarity score
     * @param template1 Face template
     * @param template2 Face template
     * @returns Similarity score between the two templates
     */
    compareFaceTemplates(template1: string, template2: string): Promise<number>;
}
