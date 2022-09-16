import { LivenessCheck } from "./livenessCheck"
import { ImageSource } from "./types"
import { canvasFromImageSource } from "./utils"

export class TrustmaticLivenessCheck extends LivenessCheck {

    async createLivenessCheckRequestBody(image: ImageSource): Promise<any> {
        const canvas = await canvasFromImageSource(image)
        const dataURL = canvas.toDataURL()
        return {
            "faceImageBase": dataURL,
            "sessionId": crypto["randomUUID"]()
        }
    }

    createLivenessCheckRequestHeaders(): Promise<any> {
        return Promise.resolve({
            "Accept": "application/json",
            "Content-Type": "application/json"
        })
    }

    async parseLivenessCheckResponse(response: Response): Promise<number> {
        const json = await response.json()
        if (json.hasError) {
            throw json.error
        }
        return json.score
    }

}