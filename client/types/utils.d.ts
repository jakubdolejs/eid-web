import { LivenessDetectionSessionSettings } from "./livenessDetectionSession";
import { Angle, Axis, Bearing, ImageSource, Rect, Size } from "./types";
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
    dequeue(): Type | undefined;
    /**
     * Number of elements in the buffer
     */
    get length(): number;
    /**
     * `true` if the buffer is empty
     */
    get isEmpty(): boolean;
    /**
     * Last element in the buffer or `undefined` if the buffer is empty
     */
    get lastElement(): Type | undefined;
    /**
     * `true` if the buffer is full
     */
    get isFull(): boolean;
    /**
     * Get an element in the buffer
     * @param index Index of the element
     * @returns Element at the given index or `undefined` if the buffer doesn't contain an element at the given index
     */
    get(index: number): Type | undefined;
    /**
     * Clear the buffer
     */
    clear(): void;
    /**
     * @param fn Function to use for reducing the buffer to a single value
     * @returns Result of applying the supplied function to each element of the array
     */
    reduce(fn: (previousValue: Type, currentValue: Type, currentIndex: number, array: Type[]) => Type): Type | null;
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
    removeFirstSample(): number | undefined;
    get smoothedValue(): number | undefined;
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
    get smoothedValue(): Rect | undefined;
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
    get smoothedValue(): Angle | undefined;
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
export declare function cropImage(imageSource: ImageSource, cropRect?: Rect): Promise<Blob>;
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
