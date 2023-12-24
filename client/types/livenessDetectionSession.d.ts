import { Observable } from "rxjs";
import { FaceRecognition } from "./faceRecognition";
import { LivenessDetectionSessionResult } from "./faceDetection";
import { LivenessDetectionSessionUI } from "./faceDetectionUI";
import { FaceCapture, Rect, Angle, FaceExtents, Bearing, FaceRequirements, Size, FaceRequirementListener, FaceCaptureCallback } from "./types";
import { FaceDetector } from "./faceDetector";
import { LivenessCheck } from "./livenessCheck";
/**
 * @category Face detection
 */
export declare class LivenessDetectionSession {
    readonly ui: LivenessDetectionSessionUI;
    readonly startTime: number;
    readonly settings: LivenessDetectionSessionSettings;
    /**
     * @internal
     */
    readonly controlFaceCaptures: FaceCapture[];
    faceRecognition: FaceRecognition;
    faceDetector: FaceDetector;
    faceDetectionCallback: FaceCaptureCallback | undefined;
    faceCaptureCallback: FaceCaptureCallback | undefined;
    livenessCheck: LivenessCheck | undefined;
    /**
     * @internal
     */
    lastCaptureTime: number | null;
    private readonly faceBuffer;
    private faceAlignmentStatus;
    private fixTime;
    private alignedFaceCount;
    private angleHistory;
    private bearingGenerator;
    private bearingIterator;
    private previousBearing;
    private closed;
    private readonly angleBearingEvaluation;
    private readonly faceBoundsSmoothing;
    private readonly faceAngleSmoothing;
    private hasFaceBeenAligned;
    private mediaRecorder;
    private videoType;
    private faceRequirementListeners;
    private imageSize;
    private pendingFaceRequirementsNotificationBearing;
    private videoTrack;
    private previousFaceAngle;
    constructor(settings?: LivenessDetectionSessionSettings, faceRecognition?: FaceRecognition);
    readonly registerFaceRequirementListener: (listener: FaceRequirementListener) => void;
    readonly unregisterFaceRequirementListener: (listener: FaceRequirementListener) => void;
    /**
     * @internal
     */
    get requestedBearing(): Bearing;
    /**
     * @internal
     */
    readonly setupVideo: () => Promise<void>;
    /**
     * @internal
     */
    readonly faceAngleMatchesRequirements: (angle: Angle, requirements: FaceRequirements) => boolean;
    /**
     * @internal
     */
    readonly faceRequirements: (imageSize: Size, bearing?: Bearing) => FaceRequirements;
    /**
     * @internal
     */
    readonly isFaceFixedInImageSize: (actualFaceBounds: Rect, imageSize: Size) => boolean;
    /**
     * @internal
     */
    readonly detectFacePresence: (capture: FaceCapture) => FaceCapture;
    /**
     * @internal
     */
    readonly detectFaceAlignment: (capture: FaceCapture) => FaceCapture;
    /**
     * @internal
     */
    readonly detectSpoofAttempt: (capture: FaceCapture) => FaceCapture;
    /**
     * @internal
     */
    readonly createFaceCapture: (capture: FaceCapture) => Observable<FaceCapture>;
    /**
     * @internal
     */
    readonly checkLiveness: (result: LivenessDetectionSessionResult) => Observable<LivenessDetectionSessionResult>;
    /**
     * @internal
     */
    readonly resultFromCaptures: (captures: FaceCapture[]) => Observable<LivenessDetectionSessionResult>;
    /**
     * @internal
     */
    readonly onVideoSize: (videoSize: Size) => void;
    /**
     * @internal
     */
    readonly onMediaStreamAvailable: (stream: MediaStream) => void;
    readonly close: () => void;
    get isClosed(): boolean;
    protected cleanup: () => void;
    protected selectNextBearing: (availableBearings: Bearing[]) => Bearing;
    private getVideoURL;
    private compareControlFacesToCaptureFaces;
    private movedOpposite;
    private areAllBufferedFacesAligned;
    private setFaceAlignmentFromFace;
    private recordAngleDistanceAndTrajectory;
    private nextCaptureBearing;
    private notifyFaceRequirementListeners;
}
/**
 * @category Face detection testing
 */
export declare class MockLivenessDetectionSession extends LivenessDetectionSession {
    readonly setupVideo: () => Promise<void>;
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
     * @defaultValue `3.5`
     */
    minFPS: number;
}
