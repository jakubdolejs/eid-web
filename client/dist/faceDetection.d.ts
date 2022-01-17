/**
 * Ver-ID face detection
 * @packageDocumentation
 */
import { Observable } from "rxjs";
import { Angle, Rect } from "./utils";
import { Size, Bearing, FaceRequirementListener, FaceAlignmentStatus, FaceCaptureCallback, ImageSource } from "./types";
import { LivenessDetectionSessionUI } from "./faceDetectionUI";
import { LivenessDetectionSession } from "./livenessDetectionSession";
import { FaceDetectorFactory } from "./faceDetector";
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
    readonly videoURL: string;
    /**
     * Constructor
     * @param startTime Date that represents the time the session was started
     * @internal
     */
    constructor(startTime: Date, faceCaptures?: FaceCapture[], videoURL?: string | undefined);
}
/**
 * Extents of a face within a view
 * @remarks
 * Used by liveness detection session to determine the area where to show the face in relation to the containing view
 * @category Face detection
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
 * Liveness detection session settings
 * @category Face detection
 */
export declare class LivenessDetectionSessionSettings {
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
     * @defaultValue `28`
     */
    yawThreshold: number;
    /**
     * Vertical (pitch) threshold where face is considered to be at an angle
     *
     * For example, a value of 15 indicates that a face with pitch -15 and below is oriented up and a face with pitch 15 or above is oriented down
     * @defaultValue `10`
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
    /**
     * Set to `true` to record a video of the session
     *
     * Note that some older browsers may not be capable of recording video
     * @defaultValue `false`
     */
    recordSessionVideo: boolean;
    /**
     * Background: Once the initial aligned face is detected the session will start capturing "control" faces at interval set in the `controlFaceCaptureInterval` property until `maxControlFaceCount` faces are collected or the session finishes.
     * These control faces are then compared to the aligned face to ensure that the person performing the liveness detection is the same person as the one on the aligned face.
     * This prevents attacks where a picture is presented to the camera and a live person finishes the liveness detection.
     * @defaultValue `3.7`
     */
    controlFaceSimilarityThreshold: number;
    /**
     * Interval at which to capture "control" faces.
     * See `controlFaceSimilarityThreshold` for an explanation.
     * @defaultValue `500`
     */
    controlFaceCaptureInterval: number;
    /**
     * Number of "control" faces to capture during a session.
     * See `controlFaceSimilarityThreshold` for an explanation.
     * @defaultValue `4`
     */
    maxControlFaceCount: number;
    /**
     * Set your own function if you wish to supply your own graphical user interface for the session.
     * @returns Function that supplies an instance of `FaceCaptureUI`
     */
    createUI: () => LivenessDetectionSessionUI;
    /**
     * @param imageSize Image size
     * @returns Boundary of where the session expects a face in a given image size.
     */
    readonly expectedFaceRect: (imageSize: Size) => Rect;
    /**
     * Minimum face detection speed in frames per second.
     * If the device cannot detect faces fast enough the session will fail with an error.
     * @defaultValue `5`
     */
    minFPS: number;
}
/**
 * Face detected in an image
 * @category Face detection
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
 * @category Face detection
 */
export declare class FaceCapture {
    /**
     * Image in which the face was detected
     */
    readonly image: Blob;
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
     * Face alignment status at time of capture
     * @internal
     */
    faceAlignmentStatus?: FaceAlignmentStatus;
    /**
     * Difference between the angle of the requested bearing and the angle of the detected face
     * @internal
     */
    offsetAngleFromBearing?: Angle;
    /**
     * Number between 0 and 1 representing the trajectory to the requested bearing angle.
     * `1` means the face is moving straight towards the requested bearing.
     * `0` means the face is moving in the opposite direction than the requested bearing.
     */
    angleTrajectory: number | undefined;
    angleDistance: number;
    /**
     * Image cropped to the bounds of the detected face
     */
    readonly faceImage: Blob;
    readonly imageSize: Size;
    /**
     * Constructor
     * @param image Image in which the face was detected
     * @param face Face or `null` if no face was detected in the image
     * @internal
     */
    private constructor();
    static create(image: Blob, face: Face): Promise<FaceCapture>;
}
