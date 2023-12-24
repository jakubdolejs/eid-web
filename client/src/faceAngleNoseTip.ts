'use strict';

import { clamp } from "./utils"
import { Point } from "./types";
import { Angle } from "./types";

/**
 * @param landmarks Face landmarks
 * @returns Angle
 * @category Face detection
 * @internal
 */
export function estimateFaceAngle(landmarks: Point[]): Angle {
    if (landmarks.length != 68) {
        throw new Error("Face angle calculation requires 68 face landmarks")
    }
    const noseTip: Point = new Point(landmarks[30].x, landmarks[30].y)
    noseTip.y -= 0.3125
    const dest: Angle = new Angle()
    dest.yaw = clamp(45 * noseTip.x, 90) * 2
    dest.pitch = clamp(45 * (noseTip.y - 0.3), 90) * 2
    return dest
}