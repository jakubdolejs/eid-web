import { LivenessCheck } from "./livenessCheck";
import { ImageSource } from "./types";
export declare class TrustmaticLivenessCheck extends LivenessCheck {
    createLivenessCheckRequestBody(image: ImageSource): Promise<any>;
    createLivenessCheckRequestHeaders(): Promise<any>;
    parseLivenessCheckResponse(response: Response): Promise<number>;
}
