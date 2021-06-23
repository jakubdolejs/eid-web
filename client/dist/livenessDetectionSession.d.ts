import { Observable } from "rxjs";
import { FaceRecognition } from "./faceRecognition";
import { LivenessDetectionSessionSettings, FaceCapture, LivenessDetectionSessionResult } from "./faceDetection";
import { LivenessDetectionSessionUI } from "./faceDetectionUI";
import { Bearing, FaceRequirements, Size, FaceRequirementListener, FaceCaptureCallback } from "./types";
import { Angle, Rect } from "./utils";
import { FaceDetector } from "./faceDetector";
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
    faceDetectionCallback: FaceCaptureCallback;
    faceCaptureCallback: FaceCaptureCallback;
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
    private movedTooFast;
    private movedOpposite;
    private areAllBufferedFacesAligned;
    private setFaceAlignmentFromFace;
    private hasFaceMovedTooFar;
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
