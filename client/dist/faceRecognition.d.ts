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
     * Distance of the face from the left side of the image (pixels)
     */
    x: number;
    /**
     * Distance of the face from the top side of the image (pixels)
     */
    y: number;
    /**
     * Width of the face (pixels)
     */
    width: number;
    /**
     * Height of the face (pixels)
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
    createRecognizableFace(image: HTMLImageElement | string, faceRect?: Rect): Promise<RecognizableFace>;
    private cropImage;
    /**
     * Compare face templates and return similarity score
     * @param template1 Face template
     * @param template2 Face template
     * @returns Similarity score between the two templates
     */
    compareFaceTemplates(template1: string, template2: string): Promise<number>;
}
