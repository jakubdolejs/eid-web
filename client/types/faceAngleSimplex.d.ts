import { Point } from "./types";
import { Angle } from "./types";
/**
 * @param landmarks Face landmarks
 * @returns Angle
 * @category Face detection
 * @internal
 */
export declare function estimateFaceAngle(landmarks: Point[]): Angle;
