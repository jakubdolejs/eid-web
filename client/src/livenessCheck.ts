import { ImageSource } from "./types"

export abstract class LivenessCheck {

    async checkLiveness(image: ImageSource): Promise<number> {
        try {
            const body = await this.createLivenessCheckRequestBody(image)
            const headers = await this.createLivenessCheckRequestHeaders()
            const response = await fetch("/check_liveness", {"method": "POST", "cache": "no-cache", "body": JSON.stringify(body), "headers": headers})
            return this.parseLivenessCheckResponse(response)
        } catch (error: any) {
            throw new Error("Liveness check failed: "+error?.message)
        }
    }

    abstract createLivenessCheckRequestBody(image: ImageSource): Promise<any>

    abstract createLivenessCheckRequestHeaders(): Promise<any>

    abstract parseLivenessCheckResponse(response: Response): Promise<number>
}