'use strict';

/**
 * @internal
 */
export class NormalDistribution {

    readonly mean: number
    readonly standardDeviation: number

    constructor(mean: number = 0, standardDeviation: number = 1) {
        this.mean = mean
        this.standardDeviation = standardDeviation
    }

    private erf(x: number): number {
        if (Math.abs(x) > 40.0) {
            return x > 0 ? 1 : -1
        }
        const ret = Gamma.regularizedGammaP(0.5, x * x, 1.0e-15, 10000)
        return x < 0 ? 0-ret : ret
    }

    cumulativeProbability(x: number): number {
        const dev = x - this.mean
        if (Math.abs(dev) > 40.0 * this.standardDeviation) {
            return dev < 0 ? 0.0 : 1.0
        }
        return 0.5 * (1 + this.erf(dev / (this.standardDeviation * Math.sqrt(2))))
    }
}

class Gamma {
    
    static lanczos: number[] = [
        0.99999999999999709182,
        57.156235665862923517,
        -59.597960355475491248,
        14.136097974741747174,
        -0.49191381609762019978,
        0.33994649984811888699e-4,
        0.46523628927048575665e-4,
        -0.98374475304879564677e-4,
        0.15808870322491248884e-3,
        -0.21026444172410488319e-3,
        0.21743961811521264320e-3,
        -0.16431810653676389022e-3,
        0.84418223983852743293e-4,
        -0.26190838401581408670e-4,
        0.36899182659531622704e-5
    ]
    
    static halfLog2Pi: number = 0.5 * Math.log(2.0 * Math.PI)
    
    static regularizedGammaP(a: number, x: number, epsilon: number, maxIterations: number): number {
        if (isNaN(a) || isNaN(x) || a <= 0.0 || x < 0.0) {
            return NaN
        } else if (x == 0.0) {
            return 0.0
        } else if (x >= a + 1) {
            return 1.0 - Gamma.regularizedGammaQ(a, x, epsilon, maxIterations)
        } else {
            let n: number = 0
            let an: number = 1.0 / a
            let sum: number = an
            while (Math.abs(an/sum) > epsilon && n < maxIterations && sum < Infinity) {
                n = n + 1.0
                an = an * (x / (a + n))
                sum += an
            }
            if (n >= maxIterations) {
                throw new Error()
            } else if (!isFinite(sum)) {
                return 1.0
            } else {
                return Math.exp(0 - x + (a * Math.log(x)) - Gamma.logGamma(a)) * sum
            }
        }
    }
    
    static regularizedGammaQ(a: number, x: number, epsilon: number, maxIterations: number): number {
        if (isNaN(a) || isNaN(x) || a <= 0.0 || x < 0.0) {
            return NaN
        }
        if (x == 0.0) {
            return 1.0
        }
        if (x < a + 1.0) {
            return 1.0 - Gamma.regularizedGammaP(a, x, epsilon, maxIterations)
        }
        const cf = new ContinuedFraction((n: number, x1: number) => {
            return ((2.0 * n) + 1.0) - a + x1
        }, (n: number, x1: number) => {
            return n * (a - n)
        })
        let ret = 1.0 / cf.evaluate(x, epsilon, maxIterations)
        ret = Math.exp(0 - x + (a * Math.log(x)) - Gamma.logGamma(a)) * ret
        return ret
    }
    
    static logGamma(x: number): number {
        if (isNaN(x) || x <= 0.0) {
            return NaN
        }
        const g: number = 607.0 / 128.0
        let sum: number = 0.0
        let i = this.lanczos.length-1
        while (i>0) {
            sum += this.lanczos[i] / (x + i)
            i -= 1
        }
        sum += this.lanczos[0]
        
        const tmp: number = x + g + 0.5
        return ((x + 0.5) * Math.log(tmp)) - tmp + Gamma.halfLog2Pi + Math.log(sum / x)
    }
}

class ContinuedFraction {
    
    readonly getA: (a: number, b: number) => number
    readonly getB: (a: number ,b: number) => number
    
    constructor(getA: (a: number, b: number) => number, getB: (a: number, b: number) => number) {
        this.getA = getA
        this.getB = getB
    }
    
    evaluate(x: number, epsilon: number, maxIterations: number): number {
        let p0 = 1.0
        let p1 = this.getA(0, x)
        let q0 = 0.0
        let q1 = 1.0
        let c = p1 / q1
        let n: number = 0
        let relativeError = Number.MAX_VALUE
        while (n < maxIterations && relativeError > epsilon) {
            n += 1
            const a = this.getA(n, x)
            const b = this.getB(n, x)
            let p2 = a * p1 + b * p0
            let q2 = a * q1 + b * q0
            let infinite = false
            if (!isFinite(p2) || !isFinite(q2)) {
                /*
                 * Need to scale. Try successive powers of the larger of a or b
                 * up to 5th power. Throw ConvergenceException if one or both
                 * of p2, q2 still overflow.
                 */
                var scaleFactor = 1.0
                var lastScaleFactor = 1.0
                let maxPower = 5
                let scale = Math.max(a,b)
                if (scale <= 0) {  // Can't scale
                    throw new Error()
                }
                infinite = true
                for (let i=0; i<maxPower; i++) {
                    lastScaleFactor = scaleFactor
                    scaleFactor *= scale
                    if (a != 0.0 && a > b) {
                        p2 = p1 / lastScaleFactor + (b / scaleFactor * p0)
                        q2 = q1 / lastScaleFactor + (b / scaleFactor * q0)
                    } else if (b != 0) {
                        p2 = (a / scaleFactor * p1) + p0 / lastScaleFactor
                        q2 = (a / scaleFactor * q1) + q0 / lastScaleFactor
                    }
                    infinite = !isFinite(p2) || !isFinite(q2)
                    if (!infinite) {
                        break
                    }
                }
            }

            if (infinite) {
               // Scaling failed
               throw new Error()
            }

            const r = p2 / q2

            if (isNaN(r)) {
                throw new Error()
            }
            relativeError = Math.abs(r / c - 1.0)

            // prepare for next iteration
            c = p2 / q2
            p0 = p1
            p1 = p2
            q0 = q1
            q1 = q2
        }

        if (n >= maxIterations) {
            throw new Error()
        }

        return c
    }
}