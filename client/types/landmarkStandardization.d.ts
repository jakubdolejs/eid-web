import { Point } from "./types";
/**
 * @category ID capture
 * @internal
 */
export declare class LandmarkStandardization {
    private eyeCenter;
    eyeVec: Point;
    eyeDist: number;
    right: Point;
    down: Point;
    constructor(leftEye: Point, rightEye: Point);
    private dot;
    private rotateClockwise90;
    standardize(pt: Point): Point;
}
