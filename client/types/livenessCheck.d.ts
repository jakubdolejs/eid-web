import { ImageSource } from "./types";
export declare abstract class LivenessCheck {
    checkLiveness(image: ImageSource): Promise<number>;
    abstract createLivenessCheckRequestBody(image: ImageSource): Promise<any>;
    abstract createLivenessCheckRequestHeaders(): Promise<any>;
    abstract parseLivenessCheckResponse(response: Response): Promise<number>;
}
