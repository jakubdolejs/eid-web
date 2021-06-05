import { FaceCaptureSettings } from "./faceDetection";
import { Axis, Bearing } from "./types";
import { Subscriber } from "rxjs";
/**
 * Circular (ring) buffer implementation
 *
 * @typeParam Type - Type of value the buffer contains
 */
export declare class CircularBuffer<Type> {
    private buffer;
    private capacity;
    /**
     * Constructor
     * @param capacity Capacity of the buffer
     */
    constructor(capacity: number);
    /**
     * Enqueue (add) an element into the buffer
     *
     * If the buffer is full the first value in the buffer will be discarded
     * @param value Element to add to the buffer
     */
    enqueue(value: Type): void;
    /**
     * Dequeue (remove) the first element from the buffer and return it
     * @returns First element in the buffer or `null` if the buffer is empty
     */
    dequeue(): Type;
    /**
     * Number of elements in the buffer
     */
    get length(): number;
    /**
     * `true` if the buffer is empty
     */
    get isEmpty(): boolean;
    /**
     * Last element in the buffer or `null` if the buffer is empty
     */
    get lastElement(): Type;
    /**
     * `true` if the buffer is full
     */
    get isFull(): boolean;
    /**
     * Get an element in the buffer
     * @param index Index of the element
     * @returns Element at the given index or `null` if the buffer doesn't contain an element at the given index
     */
    get(index: number): Type;
    /**
     * Clear the buffer
     */
    clear(): void;
    /**
     * @param fn Function to use for reducing the buffer to a single value
     * @returns Result of applying the supplied function to each element of the array
     */
    reduce(fn: (previousValue: Type, currentValue: Type, currentIndex: number, array: Type[]) => Type): Type;
}
/**
 * Angle
 */
export declare class Angle {
    /**
     * Yaw
     */
    yaw: number;
    /**
     * Pitch
     */
    pitch: number;
    /**
     * Roll
     */
    roll: number;
    /**
     * Constructor
     * @param yaw Yaw
     * @param pitch Pitch
     * @param roll Roll
     */
    constructor(yaw?: number, pitch?: number, roll?: number);
    /**
     * Arc tangent of the pitch and yaw (used for displaying the angle on screen)
     */
    get screenAngle(): number;
}
/**
 * Point
 */
export declare class Point {
    /**
     * Horizontal coordinate
     */
    x: number;
    /**
     * Vertical coordinate
     */
    y: number;
    /**
     * Constructor
     * @param x Horizontal coordinate
     * @param y Vertical coordinate
     */
    constructor(x?: number, y?: number);
}
/**
 * Rectangle
 */
export declare class Rect {
    /**
     * Left edge of the rectangle
     */
    x: number;
    /**
     * Top edge of the rectangle
     */
    y: number;
    /**
     * Top edge of the rectangle
     */
    width: number;
    /**
     * Rectangle height
     */
    height: number;
    /**
     * Constructor
     * @param x Left edge of the rectangle
     * @param y Top edge of the rectangle
     * @param width Top edge of the rectangle
     * @param height Rectangle height
     */
    constructor(x: number, y: number, width: number, height: number);
    /**
     * Inset all edges of the rectangle by the given amounts
     * @param xInset Horizontal inset
     * @param yInset Vertical inset
     */
    inset(xInset: number, yInset: number): void;
    /**
     * Find out whether this rectangle contains another rectangle
     * @param rect Challenge rectangle
     * @returns `true` if this rectangle contains the challenge rectangle
     */
    contains(rect: Rect): boolean;
    /**
     * Center of the rectangle
     */
    get center(): Point;
    /**
     * Scale rectangle by the given scale factor and return a new rectangle
     * @param scaleX Horizontal scale
     * @param scaleY Vertical scale (optional, if not specified scaleX will be used)
     * @returns New rectangle that is this rectangle scaled by the scale values
     */
    scaledBy(scaleX: number, scaleY?: number): Rect;
    /**
     * @param planeWidth Width of the plane in which the rectangle should be mirrored
     * @returns Rectangle mirrored horizontally along the plane's vertical axis
     */
    mirrored(planeWidth: number): Rect;
    get right(): number;
    get bottom(): number;
    equals: (other: Rect) => boolean;
}
/**
 * Evaluates angles in relation to bearings
 */
export declare class AngleBearingEvaluation {
    settings: FaceCaptureSettings;
    pitchThresholdTolerance: number;
    yawThresholdTolerance: number;
    constructor(settings: FaceCaptureSettings, pitchThresholdTolerance: number, yawThresholdTolerance: number);
    thresholdAngleForAxis(axis: Axis): number;
    angleForBearing(bearing: Bearing): Angle;
    thresholdAngleToleranceForAxis(axis: Axis): number;
    angleMatchesBearing(angle: Angle, bearing: Bearing): boolean;
    isAngleBetweenBearings(angle: Angle, fromBearing: Bearing, toBearing: Bearing): boolean;
    offsetFromAngleToBearing(angle: Angle, bearing: Bearing): Angle;
    private isPointToRightOfPlaneBetweenPoints;
    isPointInsideCircleCentredInPointWithRadius(angle: Angle, centre: Angle, radius: number): boolean;
    private minAngleForBearing;
    private maxAngleForBearing;
}
export declare class Smoothing {
    buffer: CircularBuffer<number>;
    private _smoothedValue;
    constructor(bufferSize: number);
    addSample(value: number): void;
    removeFirstSample(): number;
    get smoothedValue(): number;
    private calculateSmoothedValue;
    reset(): void;
}
export declare type ObservableNextEvent<T> = {
    type: "next";
    value: T;
};
export declare type ObservableErrorEvent = {
    type: "error";
    error: any;
};
export declare type ObservableCompleteEvent = {
    type: "complete";
};
declare type ObservableEvent<T> = ObservableNextEvent<T> | ObservableErrorEvent | ObservableCompleteEvent;
export declare function emitRxEvent<T>(subscriber: Subscriber<T>, event: ObservableEvent<T>): void;
export declare class RectSmoothing {
    private xSmoothing;
    private ySmoothing;
    private widthSmoothing;
    private heightSmoothing;
    private _smoothedValue;
    constructor(bufferSize: number);
    addSample(value: Rect): void;
    get smoothedValue(): Rect;
    reset(): void;
    removeFirstSample(): void;
    private calculateSmoothedValue;
}
export declare class AngleSmoothing {
    private yawSmoothing;
    private pitchSmoothing;
    private _smoothedValue;
    constructor(bufferSize: number);
    private calculateSmoothedValue;
    get smoothedValue(): Angle;
    addSample(value: Angle): void;
    reset(): void;
    removeFirstSample(): void;
}
export declare function clamp(a: number, limit: number): number;
export {};
