'use strict';

import { LandmarkStandardization } from "./landmarkStandardization"
import { Point, Angle } from "./utils"

function getMidPointBetweenPoints(p1: Point, p2: Point): Point {
    return new Point(p1.x + (p2.x - p1.x) / 2, p1.y + (p2.y - p1.y) /2)
}

function getLeftEye(landmarks: Point[]): Point {
    if (landmarks.length != 68) {
        throw new Error()
    }
    return getMidPointBetweenPoints(landmarks[37], landmarks[40])
}

function getRightEye(landmarks: Point[]): Point {
    if (landmarks.length != 68) {
        throw new Error()
    }
    return getMidPointBetweenPoints(landmarks[43], landmarks[46])
}

/**
 * Estimate an angle of a face from its landmarks
 * @param landmarks Face landmarks
 * @param estimateFn Estimation function
 * @returns Angle
 * @category Face detection
 * @internal
 */
export function estimateFaceAngle(landmarks: Point[], estimateFn: (landmarks: Point[]) => Angle): Angle {
    const ls: LandmarkStandardization = new LandmarkStandardization(getLeftEye(landmarks), getRightEye(landmarks))
    const pts: Point[] = landmarks.map(pt => ls.standardize(pt))
    const angle: Angle = estimateFn(pts)
    angle.roll = Math.atan2(ls.eyeVec.y, ls.eyeVec.x) * Math.PI / 180
    return angle
}