import { LandmarkStandardization } from "./landmarkStandardization";
import { Point } from "./utils";
function getMidPointBetweenPoints(p1, p2) {
    return new Point(p1.x + (p2.x - p1.x) / 2, p1.y + (p2.y - p1.y) / 2);
}
function getLeftEye(landmarks) {
    if (landmarks.length != 68) {
        throw new Error();
    }
    return getMidPointBetweenPoints(landmarks[37], landmarks[40]);
}
function getRightEye(landmarks) {
    if (landmarks.length != 68) {
        throw new Error();
    }
    return getMidPointBetweenPoints(landmarks[43], landmarks[46]);
}
export function estimateFaceAngle(landmarks, estimateFn) {
    const ls = new LandmarkStandardization(getLeftEye(landmarks), getRightEye(landmarks));
    const pts = landmarks.map(pt => ls.standardize(pt));
    const angle = estimateFn(pts);
    angle.roll = Math.atan2(ls.eyeVec.y, ls.eyeVec.x) * Math.PI / 180;
    return angle;
}
//# sourceMappingURL=faceAngle.js.map