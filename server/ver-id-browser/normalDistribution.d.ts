export declare class NormalDistribution {
    readonly mean: number;
    readonly standardDeviation: number;
    constructor(mean?: number, standardDeviation?: number);
    private erf;
    cumulativeProbability(x: number): number;
}
