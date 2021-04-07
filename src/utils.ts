import { Bearing, FaceCaptureSettings } from "./faceDetection.js"

/**
 * Circular (ring) buffer implementation
 * 
 * @typeParam Type - Type of value the buffer contains
 */
export class CircularBuffer<Type> {
    private buffer: Array<Type> = []
    private capacity: number
    /**
     * Constructor
     * @param capacity Capacity of the buffer
     */
    constructor(capacity: number) {
        this.capacity = capacity
    }
    /**
     * Enqueue (add) an element into the buffer
     * 
     * If the buffer is full the first value in the buffer will be discarded
     * @param value Element to add to the buffer
     */
    enqueue(value: Type) {
        if (this.buffer.length == this.capacity) {
            this.buffer.shift()
        }
        this.buffer.push(value)
    }
    /**
     * Dequeue (remove) the first element from the buffer and return it
     * @returns First element in the buffer or `null` if the buffer is empty
     */
    dequeue(): Type {
        if (this.buffer.length == 0) {
            return null
        }
        return this.buffer.shift()
    }
    /**
     * Number of elements in the buffer
     */
    get length(): number {
        return this.buffer.length
    }
    /**
     * `true` if the buffer is empty
     */
    get isEmpty(): boolean {
        return this.buffer.length == 0
    }
    /**
     * Last element in the buffer or `null` if the buffer is empty
     */
    get lastElement(): Type {
        if (this.buffer.length > 0) {
            return this.buffer[this.buffer.length-1]
        }
        return null
    }
    /**
     * `true` if the buffer is full
     */
    get isFull(): boolean {
        return this.buffer.length == this.capacity
    }
    /**
     * Get an element in the buffer
     * @param index Index of the element 
     * @returns Element at the given index or `null` if the buffer doesn't contain an element at the given index
     */
    get(index: number): Type {
        if (index < 0 || index >= this.buffer.length) {
            return null
        }
        return this.buffer[index]
    }
    /**
     * Clear the buffer
     */
    clear() {
        this.buffer = []
    }
    /**
     * @param fn Function to use for reducing the buffer to a single value
     * @returns Result of applying the supplied function to each element of the array
     */
    reduce(fn: (previousValue: Type, currentValue: Type, currentIndex: number, array: Type[]) => Type) {
        return this.buffer.reduce(fn)
    }
}

/**
 * Angle
 */
export class Angle {
    /**
     * Yaw
     */
    yaw: number
    /**
     * Pitch
     */
    pitch: number
    /**
     * Constructor
     * @param yaw Yaw
     * @param pitch Pitch
     */
    constructor(yaw?: number, pitch?: number) {
        this.yaw = yaw || 0
        this.pitch = pitch || 0        
    }

    /**
     * Arc tangent of the pitch and yaw (used for displaying the angle on screen)
     */
    get screenAngle(): number {
        return Math.atan2(this.pitch, 0-this.yaw)
    }
}

/**
 * Point
 */
export class Point {
    /**
     * Horizontal coordinate
     */
    x: number
    /**
     * Vertical coordinate
     */
    y: number

    /**
     * Constructor
     * @param x Horizontal coordinate
     * @param y Vertical coordinate
     */
    constructor(x?: number, y?: number) {
        this.x = x || 0
        this.y = y || 0
    }
}

/**
 * Rectangle
 */
export class Rect {
    /**
     * Left edge of the rectangle
     */
    x: number
    /**
     * Top edge of the rectangle
     */
    y: number
    /**
     * Top edge of the rectangle
     */
    width: number
    /**
     * Rectangle height
     */
    height: number

    /**
     * Constructor
     * @param x Left edge of the rectangle
     * @param y Top edge of the rectangle
     * @param width Top edge of the rectangle
     * @param height Rectangle height
     */
    constructor(x: number, y: number, width: number, height: number) {
        this.x = x
        this.y = y
        this.width = width
        this.height = height
    }

    /**
     * Inset all edges of the rectangle by the given amounts
     * @param xInset Horizontal inset
     * @param yInset Vertical inset
     */
    inset(xInset: number, yInset: number) {
        this.x += xInset
        this.y += yInset
        this.width -= xInset
        this.height -= yInset
    }

    /**
     * Find out whether this rectangle contains another rectangle
     * @param rect Challenge rectangle 
     * @returns `true` if this rectangle contains the challenge rectangle
     */
    contains(rect: Rect): boolean {
        return this.x <= rect.x && this.y >= rect.y && this.x + this.width >= rect.x + rect.width && this.y + this.height > rect.y + rect.height
    }

    /**
     * Center of the rectangle
     */
    get center(): Point {
        return new Point(this.x + this.width / 2, this.y + this.height / 2)
    }

    /**
     * Scale rectangle by the given scale factor and return a new rectangle
     * @param scaleX Horizontal scale
     * @param scaleY Vertical scale (optional, if not specified scaleX will be used)
     * @returns New rectangle that is this rectangle scaled by the scale values
     */
    scaledBy(scaleX: number, scaleY?: number): Rect {
        if (scaleY === undefined || scaleY == null) {
            scaleY = scaleX
        }
        return new Rect(
            this.x * scaleX,
            this.y * scaleY,
            this.width * scaleX,
            this.height * scaleY
        )
    }

    /**
     * @param planeWidth Width of the plane in which the rectangle should be mirrored 
     * @returns Rectangle mirrored horizontally along the plane's vertical axis
     */
    mirrored(planeWidth: number): Rect {
        return new Rect(planeWidth - this.x - this.width, this.y, this.width, this.height)
    }
}

/**
 * Axis
 */
export enum Axis {
    /**
     * Yaw axis
     */
    YAW,
    /**
     * Pitch axis
     */
    PITCH
}

/**
 * Evaluates angles in relation to bearings
 */
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