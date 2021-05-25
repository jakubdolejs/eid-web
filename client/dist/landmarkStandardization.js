import { Point } from "./utils";
export class LandmarkStandardization {
    constructor(leftEye, rightEye) {
        this.eyeCenter = new Point();
        this.eyeCenter.x = 0.5 * (leftEye.x + rightEye.x);
        this.eyeCenter.y = 0.5 * (leftEye.y + rightEye.y);
        this.eyeVec = new Point(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
        this.eyeDist = Math.sqrt(this.dot(this.eyeVec, this.eyeVec));
        this.right = new Point(this.eyeVec.x / this.eyeDist, this.eyeVec.y / this.eyeDist);
        this.down = this.rotateClockwise90(this.right);
    }
    dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }
    rotateClockwise90(p) {
        return new Point(0 - p.y, p.x);
    }
    standardize(pt) {
        const p = new Point(pt.x, pt.y);
        p.x -= this.eyeCenter.x;
        p.y -= this.eyeCenter.y;
        p.x /= this.eyeDist;
        p.y /= this.eyeDist;
        return new Point(this.dot(p, this.right), this.dot(p, this.down));
    }
}
//# sourceMappingURL=landmarkStandardization.js.map