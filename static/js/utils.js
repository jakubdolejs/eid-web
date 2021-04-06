import { Bearing } from "./faceDetection.js";
export class CircularBuffer {
    constructor(capacity) {
        this.buffer = [];
        this.capacity = capacity;
    }
    enqueue(value) {
        if (this.buffer.length == this.capacity) {
            this.buffer.shift();
        }
        this.buffer.push(value);
    }
    dequeue() {
        if (this.buffer.length == 0) {
            return null;
        }
        return this.buffer.shift();
    }
    get length() {
        return this.buffer.length;
    }
    get isEmpty() {
        return this.buffer.length == 0;
    }
    get lastElement() {
        if (this.buffer.length > 0) {
            return this.buffer[this.buffer.length - 1];
        }
        return null;
    }
    get isFull() {
        return this.buffer.length == this.capacity;
    }
    get(index) {
        return this.buffer[index];
    }
    clear() {
        this.buffer = [];
    }
    reduce(fn) {
        return this.buffer.reduce(fn);
    }
}
export class Angle {
    constructor(yaw, pitch) {
        this.yaw = yaw || 0;
        this.pitch = pitch || 0;
    }
    get screenAngle() {
        return Math.atan2(this.pitch, 0 - this.yaw);
    }
}
export class Point {
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }
}
export class Rect {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    inset(xInset, yInset) {
        this.x += xInset;
        this.y += yInset;
        this.width -= xInset;
        this.height -= yInset;
    }
    contains(rect) {
        return this.x <= rect.x && this.y >= rect.y && this.x + this.width >= rect.x + rect.width && this.y + this.height > rect.y + rect.height;
    }
    get center() {
        return new Point(this.x + this.width / 2, this.y + this.height / 2);
    }
    scaledBy(scaleX, scaleY) {
        if (scaleY === undefined) {
            scaleY = scaleX;
        }
        return new Rect(this.x * scaleX, this.y * scaleY, this.width * scaleX, this.height * scaleY);
    }
}
export var Axis;
(function (Axis) {
    Axis[Axis["YAW"] = 0] = "YAW";
    Axis[Axis["PITCH"] = 1] = "PITCH";
})(Axis || (Axis = {}));
export class AngleBearingEvaluation {
    constructor(settings, pitchThresholdTolerance, yawThresholdTolerance) {
        this.settings = settings;
        this.pitchThresholdTolerance = pitchThresholdTolerance;
        this.yawThresholdTolerance = yawThresholdTolerance;
    }
    thresholdAngleForAxis(axis) {
        if (axis == Axis.PITCH) {
            return this.settings.pitchThreshold;
        }
        else {
            return this.settings.yawThreshold;
        }
    }
    angleForBearing(bearing) {
        var pitchDistance = this.thresholdAngleForAxis(Axis.PITCH);
        var yawDistance = this.thresholdAngleForAxis(Axis.YAW);
        var angle = new Angle();
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = 0 - pitchDistance;
                break;
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = pitchDistance;
                break;
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = yawDistance;
                break;
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = 0 - yawDistance;
                break;
        }
        return angle;
    }
    thresholdAngleToleranceForAxis(axis) {
        if (axis == Axis.PITCH) {
            return this.pitchThresholdTolerance;
        }
        else {
            return this.yawThresholdTolerance;
        }
    }
    angleMatchesBearing(angle, bearing) {
        var minAngle = this.minAngleForBearing.call(this, bearing);
        var maxAngle = this.maxAngleForBearing.call(this, bearing);
        return angle.pitch > minAngle.pitch && angle.pitch < maxAngle.pitch && angle.yaw > minAngle.yaw && angle.yaw < maxAngle.yaw;
    }
    isAngleBetweenBearings(angle, fromBearing, toBearing) {
        if (this.angleMatchesBearing(angle, fromBearing) || this.angleMatchesBearing(angle, toBearing)) {
            return true;
        }
        var fromAngle = this.angleForBearing(fromBearing);
        var toAngle = this.angleForBearing(toBearing);
        var radius = Math.max(this.thresholdAngleForAxis(Axis.PITCH), this.thresholdAngleForAxis(Axis.YAW));
        var angleRad = Math.atan2(toAngle.pitch - fromAngle.pitch, toAngle.yaw - fromAngle.yaw) + Math.PI * 0.5;
        var cosRad = Math.cos(angleRad) * radius;
        var sinRad = Math.sin(angleRad) * radius;
        var startRight = new Angle(fromAngle.yaw + cosRad, fromAngle.pitch + sinRad);
        var startLeft = new Angle(fromAngle.yaw - cosRad, fromAngle.pitch - sinRad);
        var endRight = new Angle(toAngle.yaw + cosRad, toAngle.pitch + sinRad);
        var endLeft = new Angle(toAngle.yaw - cosRad, toAngle.pitch - sinRad);
        return !this.isPointToRightOfPlaneBetweenPoints(angle, startRight, endRight)
            && this.isPointToRightOfPlaneBetweenPoints(angle, startLeft, endLeft)
            && (this.isPointToRightOfPlaneBetweenPoints(angle, startRight, startLeft) || this.isPointInsideCircleCentredInPointWithRadius(angle, fromAngle, radius));
    }
    offsetFromAngleToBearing(angle, bearing) {
        var result = new Angle();
        if (!this.angleMatchesBearing(angle, bearing)) {
            var bearingAngle = this.angleForBearing(bearing);
            result.yaw = (bearingAngle.yaw - angle.yaw) / (this.thresholdAngleForAxis(Axis.YAW) + this.thresholdAngleToleranceForAxis(Axis.YAW));
            result.pitch = (bearingAngle.pitch - angle.pitch) / (this.thresholdAngleForAxis(Axis.PITCH) + this.thresholdAngleToleranceForAxis(Axis.PITCH));
        }
        return result;
    }
    isPointToRightOfPlaneBetweenPoints(angle, start, end) {
        var d = (angle.yaw - start.yaw) * (end.pitch - start.pitch) - (angle.pitch - start.pitch) * (end.yaw - start.yaw);
        return d <= 0;
    }
    isPointInsideCircleCentredInPointWithRadius(angle, centre, radius) {
        return Math.hypot(angle.yaw - centre.yaw, angle.pitch - centre.pitch) < radius;
    }
    minAngleForBearing(bearing) {
        const pitchDistance = this.thresholdAngleForAxis(Axis.PITCH);
        const pitchTolerance = this.thresholdAngleToleranceForAxis(Axis.PITCH);
        const yawDistance = this.thresholdAngleForAxis(Axis.YAW);
        const yawTolerance = this.thresholdAngleToleranceForAxis(Axis.YAW);
        var angle = new Angle();
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = 0 - Number.MAX_VALUE;
                break;
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = pitchDistance - pitchTolerance;
                break;
            default:
                angle.pitch = 0 - pitchDistance + pitchTolerance;
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = yawDistance - yawTolerance;
                break;
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = 0 - Number.MAX_VALUE;
                break;
            default:
                angle.yaw = 0 - yawDistance + yawTolerance;
        }
        return angle;
    }
    maxAngleForBearing(bearing) {
        const pitchDistance = this.thresholdAngleForAxis(Axis.PITCH);
        const pitchTolerance = this.thresholdAngleToleranceForAxis(Axis.PITCH);
        const yawDistance = this.thresholdAngleForAxis(Axis.YAW);
        const yawTolerance = this.thresholdAngleToleranceForAxis(Axis.YAW);
        var angle = new Angle();
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = 0 - pitchDistance + pitchTolerance;
                break;
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = Number.MAX_VALUE;
                break;
            default:
                angle.pitch = pitchDistance - pitchTolerance;
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = Number.MAX_VALUE;
                break;
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = 0 - yawDistance + yawTolerance;
                break;
            default:
                angle.yaw = yawDistance - yawTolerance;
        }
        return angle;
    }
}
export class Smoothing {
    constructor(bufferSize) {
        this._smoothedValue = null;
        this.buffer = new CircularBuffer(bufferSize);
    }
    addSample(value) {
        this.buffer.enqueue(value);
        this._smoothedValue = this.calculateSmoothedValue();
    }
    removeFirstSample() {
        return this.buffer.dequeue();
    }
    get smoothedValue() {
        return this._smoothedValue;
    }
    calculateSmoothedValue() {
        var val = this.buffer.reduce(function (previous, next) {
            return previous + next;
        });
        return val / this.buffer.length;
    }
    reset() {
        this.buffer.clear();
        this._smoothedValue = null;
    }
}
export class RectSmoothing {
    constructor(bufferSize) {
        this._smoothedValue = null;
        this.xSmoothing = new Smoothing(bufferSize);
        this.ySmoothing = new Smoothing(bufferSize);
        this.widthSmoothing = new Smoothing(bufferSize);
        this.heightSmoothing = new Smoothing(bufferSize);
    }
    addSample(value) {
        this.xSmoothing.addSample(value.x);
        this.ySmoothing.addSample(value.y);
        this.widthSmoothing.addSample(value.width);
        this.heightSmoothing.addSample(value.height);
        this._smoothedValue = this.calculateSmoothedValue();
    }
    get smoothedValue() {
        return this._smoothedValue;
    }
    reset() {
        this.xSmoothing.reset();
        this.ySmoothing.reset();
        this.widthSmoothing.reset();
        this.heightSmoothing.reset();
        this._smoothedValue = null;
    }
    removeFirstSample() {
        this.xSmoothing.removeFirstSample();
        this.ySmoothing.removeFirstSample();
        this.widthSmoothing.removeFirstSample();
        this.heightSmoothing.removeFirstSample();
    }
    calculateSmoothedValue() {
        if (this.xSmoothing.smoothedValue == null) {
            return null;
        }
        return new Rect(this.xSmoothing.smoothedValue, this.ySmoothing.smoothedValue, this.widthSmoothing.smoothedValue, this.heightSmoothing.smoothedValue);
    }
}
export class AngleSmoothing {
    constructor(bufferSize) {
        this.yawSmoothing = new Smoothing(bufferSize);
        this.pitchSmoothing = new Smoothing(bufferSize);
        this._smoothedValue = null;
    }
    calculateSmoothedValue() {
        if (this.yawSmoothing.smoothedValue == null) {
            return null;
        }
        return new Angle(this.yawSmoothing.smoothedValue, this.pitchSmoothing.smoothedValue);
    }
    get smoothedValue() {
        return this._smoothedValue;
    }
    addSample(value) {
        this.yawSmoothing.addSample(value.yaw);
        this.pitchSmoothing.addSample(value.pitch);
        this._smoothedValue = this.calculateSmoothedValue();
    }
    reset() {
        this.yawSmoothing.reset();
        this.pitchSmoothing.reset();
        this._smoothedValue = null;
    }
    removeFirstSample() {
        this.yawSmoothing.removeFirstSample();
        this.pitchSmoothing.removeFirstSample();
    }
}
//# sourceMappingURL=utils.js.map