import { Point } from "./types";
import { Angle } from "./types";
/**
 * Estimate an angle of a face from its landmarks
 * @param landmarks Face landmarks
 * @param estimateFn Estimation function
 * @returns Angle
 * @category Face detection
 * @internal
 */
export declare function estimateFaceAngle(landmarks: Point[], estimateFn: (landmarks: Point[]) => Angle): Angle;
