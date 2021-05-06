import { Point, Angle, clamp } from "./utils"

export function estimateFaceAngle(landmarks: Point[]): Angle {
    const tip: Point = landmarks[30]
    const base: Point = landmarks[33]
    const errfn: (vertex: Vertex) => number = angleFit(tip, base)
    const iyaw: number = clamp(90 * tip.x, 70)
    const ipitch: number = clamp(133 * (base.y - tip.y), 70)
    let state: State = new State(new Vertex(iyaw, ipitch), new Vertex(10, 10), errfn)
    stepUntil(state, errfn, spreadAll(1.0), 25)
    const best = state.best().second
    if (best.length != 2) {
        throw new Error()
    }
    return new Angle(best.first, 25 - best.second)
}

function degreesToRadians(degrees: number): number {
    return degrees * Math.PI/180
}

interface Pair<K,V> {
    first: K
    second: V
}

class State {

    private vertMap: Pair<number, Vertex>[] = []

    constructor(base: Vertex = null, delta: Vertex = null, errfn: (vert: Vertex) => number = null, frac: number = 0.125) {
        if (base == null && delta == null) {
            return
        }
        if (base.length != delta.length) {
            throw new Error()
        }
        for (let i=0; i<base.length; i++) {
            let vert = base
            for (let j=0; j<vert.length; j++) {
                if (j != i) {
                    vert.set(vert.get(j) + frac * delta.get(j), j)
                } else if (frac >= 0) {
                    vert.set(vert.get(j) - delta.get(j), j)
                } else {
                    vert.set(vert.get(j) + delta.get(j), j)
                }
            }
            this.insert(errfn(vert), vert)
        }
        this.insert(errfn(base), base)
    }

    begin(): IterableIterator<Pair<number,Vertex>> {
        return this.vertMap[Symbol.iterator]()
    }

    isEmpty(): boolean {
        return this.vertMap.length == 0
    }

    size(): number {
        return this.vertMap.length
    }

    best(): Pair<number,Vertex> {
        return this.vertMap[0]
    }

    worst(): Pair<number,Vertex> {
        return this.vertMap[this.vertMap.length-1]
    }

    coeffCount(): number {
        return this.isEmpty() ? 0 : this.vertMap.values().next().value.length
    }

    coeffMinMax(i: number): Pair<number,number> {
        let r: Pair<number,number>
        r.first = r.second = this.vertMap[i].second.first
        for (; i<this.vertMap.length; i++) {
            if (r.first > this.vertMap[i].second.first) {
                r.first = this.vertMap[i].second.first
            } else if (r.second < this.vertMap[i].second.first) {
                r.second = this.vertMap[i].second.first
            }
        }
        return r
    }

    insert(err: number, v: Vertex) {
        this.vertMap.push({first: err, second: v})
    }

    replaceWorst(err: number, v: Vertex) {
        const worst: Pair<number, Vertex> = this.worst()
        const replacement: Pair<number, Vertex> = {first: err, second: v}
        const worstIndex: number = this.vertMap.findIndex(val => val.first == worst.first && val.second.equals(worst.second))
        if (worstIndex > -1) {
            this.vertMap.splice(worstIndex, 1, replacement)
        } else {
            this.vertMap.push(replacement)
        }
    }

    swap(other: State) {
        this.vertMap = other.vertMap
    }
}

class Vertex {
    private values: number[]

    constructor(value1: number, value2: number) {
        this.values = [value1, value2]
    }

    get first(): number {
        return this.values[0]
    }

    get second(): number {
        return this.values[1]
    }

    set first(val: number) {
        this.values[0] = val
    }

    set second(val: number) {
        this.values[1] = val
    }

    get length(): number {
        return this.values.length
    }

    get(index: number): number {
        return this.values[index]
    }

    set(value: number, index: number) {
        if (index > 1 || index < 0) {
            throw new Error("Index out of range")
        }
        this.values[index] = value
    }
    
    add(another: Vertex) {
        if (this.length != another.length) {
            throw new Error()
        }
        for (let i=0; i<this.values.length; i++) {
            this.values[i] += another.get(i)
        }
    }

    subtract(another: Vertex) {
        if (this.length != another.length) {
            throw new Error()
        }
        for (let i=0; i<this.values.length; i++) {
            this.values[i] -= another.get(i)
        }
    }

    multiplyBy(another: Vertex) {
        if (this.length != another.length) {
            throw new Error()
        }
        for (let i=0; i<this.values.length; i++) {
            this.values[i] *= another.get(i)
        }
    }

    divideBy(another: Vertex) {
        if (this.length != another.length) {
            throw new Error()
        }
        for (let i=0; i<this.values.length; i++) {
            this.values[i] /= another.get(i)
        }
    }

    reflectedBy(another: Vertex, coeff: number): Vertex {
        let r = new Vertex(this.first, this.second)
        r.subtract(another)
        r.multiplyBy(new Vertex(coeff, coeff))
        r.add(this)
        return r
    }

    equals(other: Vertex): boolean {
        if (this.length != other.length) {
            return false
        }
        for (let i=0; i<this.length; i++) {
            if (this.get(i) != other.get(i)) {
                return false
            }
        }
        return true
    }
}

function angleFit(tip: Point, base: Point): (vert: Vertex) => number {
    return (vert: Vertex): number => {
        vert = new Vertex(clamp(vert.first, 80), clamp(vert.second, 80))
        const yaw = degreesToRadians(vert.first)
        const cyaw = Math.cos(yaw)
        const tyaw = Math.tan(yaw)

        const pitch = degreesToRadians(vert.second)
        const cpitch = Math.cos(pitch)
        const spitch = Math.sin(pitch)

        const xy = spitch * tyaw
        const xz = cpitch * tyaw
        const yy = cpitch / cyaw
        const yz = (0-spitch) / cyaw

        const tip_y = 0.69
        const tip_z = 0.24
        const tx = xy*tip_y + xz*tip_z
        const ty = yy*tip_y + yz*tip_z

        const base_y = 0.79
        const bx = xy*base_y
        const by = yy*base_y

        return Math.sqrt(tip.x-tx) + Math.sqrt(tip.y-ty) + Math.sqrt(base.x-bx) + Math.sqrt(base.y-by)
    }
}

function spreadAll(limit: number): (s: State) => boolean {
    return (s: State): boolean => {
        for (let i=0, n = s.coeffCount(); i < n; i++) {
            const r = s.coeffMinMax(i)
            const z = r[1] - r[0]
            if (z < 0) {
                throw new Error()
            }
            if (z > limit) {
                return false
            }
        }
        return true
    }
}

function step(s: State, errfn: (vert: Vertex) => number, alpha: number = 1.0, beta: number = 0.5, gamma: number = 2.0) {
    if (s.size() < 2) {
        throw new Error()
    }
    const worstV: Pair<number,Vertex> = s.worst()
    let it = s.begin()
    let result = it.next()
    let mid: Vertex = result.value
    while (!result.done) {
        mid.add(result.value)
        result = it.next()
    }
    mid.subtract(worstV.second)
    mid.divideBy(new Vertex(s.size() - 1, s.size() - 1))

    let v0 = mid.reflectedBy(worstV.second, alpha)
    let e0 = errfn(v0)

    if (e0 < s.best().first) {
        let v1 = mid.reflectedBy(worstV.second, gamma)
        let e1 = errfn(v1)
        if (e1 <= s.best().first) {
            s.replaceWorst(e1, v1)
        } else {
            s.replaceWorst(e0, v0)
        }
    } else if (e0 < s.worst().first) {
        s.replaceWorst(e0, v0)
    } else {
        let v1 = mid.reflectedBy(worstV.second, beta)
        let e1 = errfn(v1)
        if (e1 < s.worst().first) {
            s.replaceWorst(e1, v1)
        } else {
            let ns = new State()
            const best = s.best().second
            let bestV = best
            for (let val of s.begin()) {
                if (!val.second.equals(best)) {
                    let v = bestV.reflectedBy(val.second, beta)
                    ns.insert(errfn(v), v)
                }
            }
            ns.insert(errfn(bestV), bestV)
            s.swap(ns)
        }
    }
}

function stepUntil(s: State, errfn: (vert: Vertex) => number, pred: (s: State) => boolean, maxSteps: number = 1000, alpha: number = 1.0, beta: number = 0.5, gamma: number = 2.0): number {
    let n: number = 0
    while (n++ < maxSteps && !pred(s)) {
        step(s, errfn, alpha, beta, gamma)
    }
    return n
}