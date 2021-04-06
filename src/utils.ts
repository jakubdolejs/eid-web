import { Bearing, FaceCaptureSettings } from "./faceDetection.js"

export class CircularBuffer<Type> {
    private buffer: Array<Type> = []
    private capacity: number
    constructor(capacity: number) {
        this.capacity = capacity
    }
    enqueue(value: Type) {
        if (this.buffer.length == this.capacity) {
            this.buffer.shift()
        }
        this.buffer.push(value)
    }
    dequeue(): Type {
        if (this.buffer.length == 0) {
            return null
        }
        return this.buffer.shift()
    }
    get length(): number {
        return this.buffer.length
    }
    get isEmpty(): boolean {
        return this.buffer.length == 0
    }
    get lastElement(): Type {
        if (this.buffer.length > 0) {
            return this.buffer[this.buffer.length-1]
        }
        return null
    }
    get isFull(): boolean {
        return this.buffer.length == this.capacity
    }
    get(index: number): Type {
        return this.buffer[index]
    }
    clear() {
        this.buffer = []
    }
    reduce(fn: (previousValue: Type, currentValue: Type, currentIndex: number, array: Type[]) => Type) {
        return this.buffer.reduce(fn)
    }
}

export class Angle {
    yaw: number
    pitch: number
    constructor(yaw?: number, pitch?: number) {
        this.yaw = yaw || 0
        this.pitch = pitch || 0        
    }

    get screenAngle(): number {
        return Math.atan2(this.pitch, 0-this.yaw)
    }
}

export class Point {
    x: number
    y: number

    constructor(x?: number, y?: number) {
        this.x = x || 0
        this.y = y || 0
    }
}

export class Rect {

    x: number
    y: number
    width: number
    height: number

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
    }

    inset(xInset: number, yInset: number) {
        this.x += xInset
        this.y += yInset
        this.width -= xInset
        this.height -= yInset
    }

    contains(rect: Rect): boolean {
        return this.x <= rect.x && this.y >= rect.y && this.x + this.width >= rect.x + rect.width && this.y + this.height > rect.y + rect.height
    }

    get center(): Point {
        return new Point(this.x + this.width / 2, this.y + this.height / 2)
    }

    scaledBy(scaleX: number, scaleY: number): Rect {
        if (scaleY === undefined) {
            scaleY = scaleX
        }
        return new Rect(
            this.x * scaleX,
            this.y * scaleY,
            this.width * scaleX,
            this.height * scaleY
        )
    }
}

export enum Axis {
    YAW,
    PITCH
}

export class AngleBearingEvaluation {

    settings: FaceCaptureSettings
    pitchThresholdTolerance: number
    yawThresholdTolerance: number

    constructor(settings: FaceCaptureSettings, pitchThresholdTolerance: number, yawThresholdTolerance: number) {
        this.settings = settings
        this.pitchThresholdTolerance = pitchThresholdTolerance
        this.yawThresholdTolerance = yawThresholdTolerance
    }

    thresholdAngleForAxis(axis: Axis): number {
        if (axis == Axis.PITCH) {
            return this.settings.pitchThreshold
        } else {
            return this.settings.yawThreshold
        }
    }

    angleForBearing(bearing: Bearing): Angle {
        var pitchDistance: number = this.thresholdAngleForAxis(Axis.PITCH)
        var yawDistance: number = this.thresholdAngleForAxis(Axis.YAW)
        var angle = new Angle()
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = 0 - pitchDistance
                break
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = pitchDistance
                break
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = yawDistance
                break;
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = 0 - yawDistance
                break
        }
        return angle
    }

    thresholdAngleToleranceForAxis(axis: Axis): number {
        if (axis == Axis.PITCH) {
            return this.pitchThresholdTolerance
        } else {
            return this.yawThresholdTolerance
        }
    }

    angleMatchesBearing(angle: Angle, bearing: Bearing): boolean {
        var minAngle = this.minAngleForBearing.call(this, bearing)
        var maxAngle = this.maxAngleForBearing.call(this, bearing)
        return angle.pitch > minAngle.pitch && angle.pitch < maxAngle.pitch && angle.yaw > minAngle.yaw && angle.yaw < maxAngle.yaw
    }

    isAngleBetweenBearings(angle: Angle, fromBearing: Bearing, toBearing: Bearing) {
        if (this.angleMatchesBearing(angle, fromBearing) || this.angleMatchesBearing(angle, toBearing)) {
            return true
        }
        var fromAngle = this.angleForBearing(fromBearing)
        var toAngle = this.angleForBearing(toBearing)
        var radius = Math.max(this.thresholdAngleForAxis(Axis.PITCH), this.thresholdAngleForAxis(Axis.YAW))
        var angleRad = Math.atan2(toAngle.pitch-fromAngle.pitch, toAngle.yaw-fromAngle.yaw) + Math.PI*0.5
        var cosRad = Math.cos(angleRad) * radius
        var sinRad = Math.sin(angleRad) * radius
        var startRight = new Angle(fromAngle.yaw + cosRad, fromAngle.pitch + sinRad)
        var startLeft = new Angle(fromAngle.yaw - cosRad, fromAngle.pitch - sinRad)
        var endRight = new Angle(toAngle.yaw + cosRad, toAngle.pitch + sinRad)
        var endLeft = new Angle(toAngle.yaw - cosRad, toAngle.pitch - sinRad)
        return !this.isPointToRightOfPlaneBetweenPoints(angle, startRight, endRight)
            && this.isPointToRightOfPlaneBetweenPoints(angle, startLeft, endLeft)
            && (this.isPointToRightOfPlaneBetweenPoints(angle, startRight, startLeft) || this.isPointInsideCircleCentredInPointWithRadius(angle, fromAngle, radius))
    }

    offsetFromAngleToBearing(angle: Angle, bearing: Bearing): Angle {
        var result = new Angle()
        if (!this.angleMatchesBearing(angle, bearing)) {
            var bearingAngle = this.angleForBearing(bearing)
            result.yaw = (bearingAngle.yaw - angle.yaw) / (this.thresholdAngleForAxis(Axis.YAW) + this.thresholdAngleToleranceForAxis(Axis.YAW))
            result.pitch = (bearingAngle.pitch - angle.pitch) / (this.thresholdAngleForAxis(Axis.PITCH) + this.thresholdAngleToleranceForAxis(Axis.PITCH))
        }
        return result
    }

    private isPointToRightOfPlaneBetweenPoints(angle: Angle, start: Angle, end: Angle): boolean {
        var d = (angle.yaw - start.yaw) * (end.pitch - start.pitch) - (angle.pitch - start.pitch) * (end.yaw - start.yaw)
        return d <= 0
    }

    isPointInsideCircleCentredInPointWithRadius(angle: Angle, centre: Angle, radius: number): boolean {
        return Math.hypot(angle.yaw-centre.yaw, angle.pitch-centre.pitch) < radius
    }

    private minAngleForBearing(bearing: Bearing): Angle {
        const pitchDistance = this.thresholdAngleForAxis(Axis.PITCH)
        const pitchTolerance = this.thresholdAngleToleranceForAxis(Axis.PITCH)
        const yawDistance = this.thresholdAngleForAxis(Axis.YAW)
        const yawTolerance = this.thresholdAngleToleranceForAxis(Axis.YAW)
        var angle = new Angle()
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = 0 - Number.MAX_VALUE
                break
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = pitchDistance - pitchTolerance
                break
            default:
                angle.pitch = 0 - pitchDistance + pitchTolerance
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = yawDistance - yawTolerance
                break
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = 0 - Number.MAX_VALUE
                break
            default:
                angle.yaw = 0 - yawDistance + yawTolerance
        }
        return angle
    }

    private maxAngleForBearing(bearing: Bearing): Angle {
        const pitchDistance = this.thresholdAngleForAxis(Axis.PITCH)
        const pitchTolerance = this.thresholdAngleToleranceForAxis(Axis.PITCH)
        const yawDistance = this.thresholdAngleForAxis(Axis.YAW)
        const yawTolerance = this.thresholdAngleToleranceForAxis(Axis.YAW)
        var angle = new Angle()
        switch (bearing) {
            case Bearing.UP:
            case Bearing.LEFT_UP:
            case Bearing.RIGHT_UP:
                angle.pitch = 0 - pitchDistance + pitchTolerance
                break
            case Bearing.DOWN:
            case Bearing.LEFT_DOWN:
            case Bearing.RIGHT_DOWN:
                angle.pitch = Number.MAX_VALUE
                break
            default:
                angle.pitch = pitchDistance - pitchTolerance
        }
        switch (bearing) {
            case Bearing.LEFT:
            case Bearing.LEFT_DOWN:
            case Bearing.LEFT_UP:
                angle.yaw = Number.MAX_VALUE
                break
            case Bearing.RIGHT:
            case Bearing.RIGHT_DOWN:
            case Bearing.RIGHT_UP:
                angle.yaw = 0 - yawDistance + yawTolerance
                break
            default:
                angle.yaw = yawDistance - yawTolerance
        }
        return angle
    }
}

export class Smoothing {
    buffer: CircularBuffer<number>
    private _smoothedValue: number = null

    constructor(bufferSize: number) {
        this.buffer = new CircularBuffer(bufferSize)
    }

    addSample(value: number) {
        this.buffer.enqueue(value)
        this._smoothedValue = this.calculateSmoothedValue()
    }

    removeFirstSample(): number {
        return this.buffer.dequeue()
    }

    get smoothedValue(): number {
        return this._smoothedValue
    }

    private calculateSmoothedValue(): number {
        var val = this.buffer.reduce(function(previous, next) {
            return previous + next
        })
        return val / this.buffer.length
    }

    reset() {
        this.buffer.clear()
        this._smoothedValue = null
    }
}

export class RectSmoothing {

    private xSmoothing: Smoothing
    private ySmoothing: Smoothing
    private widthSmoothing: Smoothing
    private heightSmoothing: Smoothing
    private _smoothedValue: Rect = null

    constructor(bufferSize: number) {
        this.xSmoothing = new Smoothing(bufferSize)
        this.ySmoothing = new Smoothing(bufferSize)
        this.widthSmoothing = new Smoothing(bufferSize)
        this.heightSmoothing = new Smoothing(bufferSize)
    }

    addSample(value: Rect) {
        this.xSmoothing.addSample(value.x)
        this.ySmoothing.addSample(value.y)
        this.widthSmoothing.addSample(value.width)
        this.heightSmoothing.addSample(value.height)
        this._smoothedValue = this.calculateSmoothedValue()
    }

    get smoothedValue(): Rect {
        return this._smoothedValue
    }

    reset() {
        this.xSmoothing.reset()
        this.ySmoothing.reset()
        this.widthSmoothing.reset()
        this.heightSmoothing.reset()
        this._smoothedValue = null
    }

    removeFirstSample() {
        this.xSmoothing.removeFirstSample()
        this.ySmoothing.removeFirstSample()
        this.widthSmoothing.removeFirstSample()
        this.heightSmoothing.removeFirstSample()
    }
    
    private calculateSmoothedValue(): Rect {
        if (this.xSmoothing.smoothedValue == null) {
            return null
        }
        return new Rect(
            this.xSmoothing.smoothedValue,
            this.ySmoothing.smoothedValue,
            this.widthSmoothing.smoothedValue,
            this.heightSmoothing.smoothedValue
        )
    }
}

export class AngleSmoothing {
    
    private yawSmoothing: Smoothing
    private pitchSmoothing: Smoothing
    private _smoothedValue: Angle

    constructor(bufferSize: number) {
        this.yawSmoothing = new Smoothing(bufferSize)
        this.pitchSmoothing = new Smoothing(bufferSize)
        this._smoothedValue = null
    }

    private calculateSmoothedValue(): Angle {
        if (this.yawSmoothing.smoothedValue == null) {
            return null
        }
        return new Angle(
            this.yawSmoothing.smoothedValue,
            this.pitchSmoothing.smoothedValue
        )
    }

    get smoothedValue(): Angle {
        return this._smoothedValue
    }

    addSample(value: Angle) {
        this.yawSmoothing.addSample(value.yaw)
        this.pitchSmoothing.addSample(value.pitch)
        this._smoothedValue = this.calculateSmoothedValue()
    }

    reset() {
        this.yawSmoothing.reset()
        this.pitchSmoothing.reset()
        this._smoothedValue = null
    }

    removeFirstSample() {
        this.yawSmoothing.removeFirstSample()
        this.pitchSmoothing.removeFirstSample()
    }
}