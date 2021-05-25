import { Point, Angle, clamp } from "./utils";
export function estimateFaceAngle(landmarks) {
    if (landmarks.length != 68) {
        throw new Error("Face angle calculation requires 68 face landmarks");
    }
    const noseTip = new Point(landmarks[30].x, landmarks[30].y);
    noseTip.y -= 0.3125;
    const dest = new Angle();
    dest.yaw = clamp(45 * noseTip.x, 90) * 2;
    dest.pitch = clamp(45 * (noseTip.y - 0.225775), 90) * 2;
    return dest;
}
//# sourceMappingURL=faceAngleNoseTip.js.map