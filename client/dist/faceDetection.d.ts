/**
 * Ver-ID face detection
 * @packageDocumentation
 */
import { Observable } from "rxjs";
import { Angle, Rect } from "./utils";
import { Bearing, FaceAlignmentStatus } from "./types";
/**
 * Face detection
 */
export declare class FaceDetection {
    /**
     * Base URL of the server that accepts the face detection calls
     */
    readonly serviceURL: string;
    private readonly faceRecognition;
    private readonly loadPromises;
    /**
     * Constructor
     * @param serviceURL Base URL of the server that accepts the face detection and comparison calls
     */
    constructor(serviceURL?: string);
    private calculateFaceAngle;
    private faceApiFaceToVerIDFace;
    detectFaceInImage(image: HTMLImageElement): Promise<Face>;
    /**
     * @returns `true` if liveness detection is supported by the client
     */
    static isLivenessDetectionSupported(): boolean;
    /**
     * Create a liveness detection session. Subscribe to the returned Observable to start the session and to receive results.
     * @param settings Session settings
     * @param faceDetectionCallback Optional callback to invoke each time a frame is ran by face detection
     * @param faceCaptureCallback Optional callback to invoke when a face aligned to the requested bearing is captured
     */
    livenessDetectionSession(settings?: FaceCaptureSettings, faceDetectionCallback?: (faceDetectionResult: LiveFaceCapture) => void, faceCaptureCallback?: (faceCapture: LiveFaceCapture) => void): Observable<LivenessDetectionSessionResult>;
}
/**
 * Result of a liveness detection session
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
    readonly faceCaptures: Array<LiveFaceCapture>;
    /**
     * Constructor
     * @param startTime Date that represents the time the session was started
     * @internal
     */
    constructor(startTime: Date, faceCaptures?: LiveFaceCapture[]);
}
/**
 * Extents of a face within a view
 * @remarks
 * Used by liveness detection session to determine the area where to show the face in relation to the containing view
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
 * Face capture settings
 */
export declare class FaceCaptureSettings {
    /**
     * Whether to use the device's front-facing (selfie) camera
     * @defaultValue `true`
     */
    useFrontCamera: boolean;
    /**
     * How many face captures should be collected in a session
     * @defaultValue `2`
     */
    faceCaptureCount: number;
    /**
     * Maximum session duration (seconds)
     * @defaultValue `30`
     */
    maxDuration: number;
    /**
     * Horizontal (yaw) threshold where face is considered to be at an angle
     *
     * For example, a value of 15 indicates that a face with yaw -15 and below is oriented left and a face with yaw 15 or above is oriented right
     * @defaultValue `20`
     */
    yawThreshold: number;
    /**
     * Vertical (pitch) threshold where face is considered to be at an angle
     *
     * For example, a value of 15 indicates that a face with pitch -15 and below is oriented up and a face with pitch 15 or above is oriented down
     * @defaultValue `15`
     */
    pitchThreshold: number;
    /**
     * Number of faces to collect per face capture
     * @defaultValue `2`
     */
    faceCaptureFaceCount: number;
    /**
     * When the face is fixed the face detection will pause to allow enough time for the user to read the on-screen instructions
     *
     * Decreasing the pause time will shorten the session but may lead to a frustrating user experience if the user isn't allowed enough time to read the prompts
     * @defaultValue `0.5`
     */
    pauseDuration: number;
    /**
     * Where a face is expected in relation to the camera frame
     * @defaultValue `FaceExtents(0.65, 0.85)`
     */
    expectedFaceExtents: FaceExtents;
    /**
     * Bearings the user may be asked to assume during the session
     *
     * Note that the user will unlikely be asked to assume all the bearings in the set. The array is simply a pool from which the session will draw a random member.
     * @defaultValue `[Bearing.STRAIGHT, Bearing.LEFT, Bearing.RIGHT, Bearing.LEFT_UP, Bearing.RIGHT_UP]`
     */
    bearings: Bearing[];
}
/**
 * Face detected in an image
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
/**
 * Capture of a live face
 */
export declare class LiveFaceCapture {
    /**
     * Image in which the face was detected
     */
    readonly image: HTMLImageElement;
    /**
     * Face or `null` if no face is detected in the image
     */
    readonly face: Face;
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
     * `true` if face is present
     *
     * Indicates that the face has been present in a number of consecutive frames
     * @internal
     */
    isFacePresent?: boolean;
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
    private _faceImage?;
    /**
     * Image cropped to the bounds of the detected face
     */
    get faceImage(): Promise<HTMLImageElement>;
    /**
     * Constructor
     * @param image Image in which the face was detected
     * @param face Face or `null` if no face was detected in the image
     * @internal
     */
    constructor(image: HTMLImageElement, face: Face);
}
