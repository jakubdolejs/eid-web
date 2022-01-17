/**
 * Ver-ID face recognition
 * @packageDocumentation
 */
import { Rect } from "./utils";
import { RecognizableFace, RecognizableFaceDetectionInput, RecognizableFaceDetectionOutput, ImageSource } from "./types";
/**
 * Face recognition
 * @category Face recognition
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
    detectRecognizableFacesInImages(images: RecognizableFaceDetectionInput): Promise<RecognizableFaceDetectionOutput>;
    /**
     * Detect a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional expected bounds of a face in the image
     * @returns Promise that delivers a face that can be used for face recognition
     */
    detectRecognizableFace(image: ImageSource, faceRect?: Rect): Promise<RecognizableFace>;
    /**
     * Detect a face that can be used for face recognition
     * @param image Image in which to detect the face. Can be either an Image or a base-64 encoded jpeg or data URL
     * @param faceRect Optional bounds of a face in the image
     * @deprecated Please use {@linkcode detectRecognizableFace} instead
     * @returns Promise that delivers a face that can be used for face recognition
     * @internal
     */
    createRecognizableFace(image: HTMLImageElement | string, faceRect?: Rect): Promise<RecognizableFace>;
    private faceCoordinatesToPixels;
    private adjustImageCropRect;
    /**
     * Compare face templates and return similarity score
     * @param template1 Face template
     * @param template2 Face template
     * @returns Similarity score between the two templates
     */
    compareFaceTemplates(template1: string, template2: string): Promise<number>;
    compareFaceTemplateToTemplates(template: string, templates: string[]): Promise<number>;
}
