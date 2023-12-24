/**
 * Ver-ID face detection
 * @packageDocumentation
 */
import { Observable } from "rxjs";
import { FaceRequirementListener, FaceCaptureCallback, ImageSource } from "./types";
import { LivenessDetectionSession } from "./livenessDetectionSession";
import { FaceDetectorFactory } from "./faceDetector";
import { LivenessDetectionSessionSettings } from "./livenessDetectionSession";
import { FaceCapture } from "./types";
import { Face } from "./types";
/**
 * Face detection
 * @category Face detection
 */
export declare class FaceDetection {
    /**
     * Base URL of the server that accepts the face detection calls
     */
    readonly serviceURL: string;
    private readonly faceRecognition;
    private readonly createFaceDetectorPromise;
    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    constructor(serviceURL?: string, faceDetectorFactory?: FaceDetectorFactory);
    detectFaceInImage(image: ImageSource): Promise<Face>;
    /**
     * @returns `true` if liveness detection is supported by the client
     */
    static isLivenessDetectionSupported(): boolean;
    /**
     * Start a liveness detection session. Subscribe to the returned Observable to start the session and to receive results.
     * @param session Session to use for for liveness detection
     * @returns Observable
     */
    captureFaces(session: LivenessDetectionSession): Observable<LivenessDetectionSessionResult>;
    /**
     * Create a liveness detection session. Subscribe to the returned Observable to start the session and to receive results.
     * @param settings Session settings
     * @param faceDetectionCallback Optional callback to invoke each time a frame is ran by face detection
     * @param faceCaptureCallback Optional callback to invoke when a face aligned to the requested bearing is captured
     * @deprecated Use {@linkcode captureFaces}
     * @hidden
     */
    livenessDetectionSession(settings?: LivenessDetectionSessionSettings, faceDetectionCallback?: FaceCaptureCallback, faceCaptureCallback?: FaceCaptureCallback, faceRequirementListener?: FaceRequirementListener): Observable<LivenessDetectionSessionResult>;
    private onFaceCapture;
    private onVideoPlay;
    private liveFaceCapture;
    private checkLivenessSessionAvailability;
    private livenessDetectionSessionResultObservable;
}
/**
 * Result of a liveness detection session
 * @category Face detection
 */
export declare class LivenessDetectionSessionResult {
    /**
     * Date that represents the time the session was started
     */
    readonly startTime: Date;
    /**
     * Session duration in seconds
     */
    duration: number;
    /**
     * Array of face captures collected during the session
     */
    readonly faceCaptures: Array<FaceCapture>;
    readonly videoURL: string | undefined;
    livenessScore?: number;
    /**
     * Constructor
     * @param startTime Date that represents the time the session was started
     * @internal
     */
    constructor(startTime: Date, faceCaptures?: FaceCapture[], videoURL?: string | undefined);
}
