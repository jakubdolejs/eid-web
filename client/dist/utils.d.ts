import { LivenessDetectionSessionSettings } from "./faceDetection";
import { Axis, Bearing, ImageSource, Size } from "./types";
import { Subscriber } from "rxjs";
/**
 * Circular (ring) buffer implementation
 *
 * @typeParam Type - Type of value the buffer contains
 * @internal
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
 * @internal
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
 * @internal
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
 * @internal
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
 * @internal
 */
export declare class AngleBearingEvaluation {
    settings: LivenessDetectionSessionSettings;
    pitchThresholdTolerance: number;
    yawThresholdTolerance: number;
    constructor(settings: LivenessDetectionSessionSettings, pitchThresholdTolerance: number, yawThresholdTolerance: number);
    thresholdAngleForAxis(axis: Axis): number;
    angleForBearing(bearing: Bearing): Angle;
    thresholdAngleToleranceForAxis(axis: Axis): number;
    angleMatchesBearing(angle: Angle, bearing: Bearing): boolean;
    isAngleBetweenBearings(angle: Angle, fromBearing: Bearing, toBearing: Bearing): boolean;
    offsetFromAngleToBearing(angle: Angle, bearing: Bearing): Angle;
    private isPointToRightOfPlaneBetweenPoints;
    isPointInsideCircleCentredInPointWithRadius(angle: Angle, centre: Angle, radius: number): boolean;
    minAngleForBearing(bearing: Bearing): Angle;
    maxAngleForBearing(bearing: Bearing): Angle;
}
/**
 * @internal
 */
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
/**
 * @internal
 */
export declare type ObservableNextEvent<T> = {
    type: "next";
    value: T;
};
/**
 * @internal
 */
export declare type ObservableErrorEvent = {
    type: "error";
    error: any;
};
/**
 * @internal
 */
export declare type ObservableCompleteEvent = {
    type: "complete";
};
declare type ObservableEvent<T> = ObservableNextEvent<T> | ObservableErrorEvent | ObservableCompleteEvent;
/**
 * @internal
 */
export declare function emitRxEvent<T>(subscriber: Subscriber<T>, event: ObservableEvent<T>): void;
/**
 * @internal
 */
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
/**
 * @internal
 */
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
/**
 * Clamp a number so that it's between {@code 0-limit} and {@code limit}
 * @param a Number to clamp
 * @param limit Value to limit the clamped number to
 * @returns Clamped number
 * @internal
 */
export declare function clamp(a: number, limit: number): number;
/**
 *
 * @param imageSource
 * @returns
 * @internal
 */
export declare function blobFromImageSource(imageSource: ImageSource, cropRect?: Rect): Promise<Blob>;
/**
 *
 * @param canvas Canvas to extract the blob from
 * @returns Promise resolving to a blob containing the canvas image
 */
export declare function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob>;
/**
 * Resize image
 * @param image Blob containing an image
 * @param maxSize The image will be scaled so that its longer side is at most maxSize
 * @returns Promise resolving to a blob containing the resized image
 * @internal
 */
export declare function resizeImage(image: ImageData, maxSize: number): Promise<ImageData>;
export declare function cropImage(imageSource: ImageSource, cropRect: Rect): Promise<Blob>;
/**
 *
 * @param imageSource
 * @returns
 * @internal
 */
export declare function canvasFromImageSource(imageSource: ImageSource, cropRect?: Rect): Promise<HTMLCanvasElement>;
/**
 *
 * @param imageSource
 * @returns
 * @internal
 * @deprecated
 */
export declare function imageFromImageSource(imageSource: ImageSource): Promise<HTMLImageElement>;
/**
 *
 * @param imageSource
 * @returns
 * @internal
 */
export declare function sizeOfImageSource(imageSource: ImageSource): Promise<Size>;
export declare function loadImage(src: string, image?: HTMLImageElement): Promise<HTMLImageElement>;
export {};
