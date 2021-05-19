import { Observable, Subscriber } from "rxjs"
import * as BlinkIDSDK from "@microblink/blinkid-in-browser-sdk/es/blinkid-sdk"
import { RecognizableFace, FaceRecognition } from "./faceRecognition"
import { Size, Rect } from "./utils"
import { 
    BlinkIdCombinedRecognizerSettings, 
    RecognizerRunner, 
    VideoRecognizer, 
    WasmSDK, 
    WasmSDKLoadSettings, 
    BlinkIdCombinedRecognizer, 
    BlinkIdCombinedRecognizerResult, 
    createBlinkIdCombinedRecognizer, 
    createRecognizerRunner, 
    RecognizerResultState, 
    MetadataCallbacks
} from "@microblink/blinkid-in-browser-sdk"

type ProgressListener = (progress: number) => void

export type IdCaptureStatus = "pass" | "review" | "fail"

export interface IdCaptureResponse {
    error?: any
    result: {
        front?: DocumentFrontPage,
        back?: DocumentBackPage,
        passport?: PassportDocument
    }
    warnings?: Warning[]
    status: IdCaptureStatus
}
export interface Address {
    street: string
    city: string
    postalCode: string
    jurisdiction: string
}

export interface IDDocument {
    documentNumber: string
    firstName: string
    lastName: string
    warnings: Set<Warning>
    dateOfBirth: DocumentDate
    dateOfExpiry: DocumentDate
    recognizer: RecognizerType
}

export interface DatedDocument {
    dateOfIssue: DocumentDate
}

export interface ImageDocument {
    image: string
    faces: {
        x: number,
        y: number,
        width: number,
        height: number,
        quality: number,
        template: string
    }[]
    imageAnalysis: ImageQuality
    imageSize: Size
}

export interface ImageQuality {
    brightness: number
    contrast: number
    sharpness: number
}

export type RecognizerType = "BLINK_ID" | "USDL" | "PASSPORT"

export interface DocumentDate {
    day: number
    month: number
    year: number
    successfullyParsed?: boolean
    originalString?: string
}

export interface ClassInfo {
    country: string
    region: string
    type: string
    countryName: string
    isoAlpha3CountryCode: string
    isoAlpha2CountryCode: string
    isoNumericCountryCode: string
}

export interface DocumentFrontPage extends IDDocument, ImageDocument, DatedDocument {
    classInfo: ClassInfo
    fullName: string
    address: string
    authenticityScores: {[k: string]: number}
    authenticityScore: number
}

export interface DocumentBackPage extends IDDocument, DatedDocument {
    barcode: string
    issuerIdentificationNumber: string
    fullName: string
    address: Address
}

export interface PassportDocument extends IDDocument, ImageDocument {
    rawMRZString: string
    issuer: string
    nationality: string
    mrtdVerified: boolean
    recognitionStatus: string
}

export type CapturedDocument<T extends RecognizerType> = T extends "PASSPORT" ? PassportDocument : T extends "USDL" ? DocumentBackPage : DocumentFrontPage

export interface IdCaptureResult {
    face?: RecognizableFace
    result: BlinkIdCombinedRecognizerResult
}

export class Warning {

    readonly code: number
    readonly description: string

    constructor(code: number, description: string) {
        this.code = code
        this.description = description
    }
}

class IdCaptureUI {

    private videoContainer: HTMLDivElement
    readonly video: HTMLVideoElement
    private cameraOverlayCanvas: HTMLCanvasElement
    private cameraOverlayContext: CanvasRenderingContext2D
    readonly cancelButton: HTMLAnchorElement
    private prompt: HTMLDivElement
    private progressBarContainer: HTMLDivElement
    private progressBar: HTMLDivElement
    private promptLock: boolean = false
    private flipTimeout: any
    readonly cardAspectRatio: number = 85.6/53.98
    onCancel: () => void | null = null

    constructor() {
        this.videoContainer = this.createVideoContainer()
        document.body.appendChild(this.videoContainer)
        this.video = this.createVideoElement()
        this.cameraOverlayCanvas = this.createCameraOverlayCanvas()
        this.cameraOverlayContext = this.cameraOverlayCanvas.getContext("2d")
        this.cancelButton = this.createCancelButton()
        this.prompt = this.createPromptElement()        
        this.videoContainer.appendChild(this.video)
        this.videoContainer.appendChild(this.cameraOverlayCanvas)
        this.videoContainer.appendChild(this.cancelButton)
        this.videoContainer.appendChild(this.prompt)
        this.progressBarContainer = this.createProgressBarContainer()
        this.progressBar = this.createProgressBarElement()
        this.progressBarContainer.appendChild(this.progressBar)        
        this.videoContainer.appendChild(this.progressBarContainer)
        this.cancelButton.onclick = () => {
            if (this.onCancel) {
                this.onCancel()
            }
        }
        this.video.onplaying = () => {
            this.drawCardOutline("white")
        }
    }

    private createVideoContainer(): HTMLDivElement {
        const videoContainer = document.createElement("div")
        videoContainer.style.position = "fixed"
        videoContainer.style.left = "0px"
        videoContainer.style.top = "0px"
        videoContainer.style.right = "0px"
        videoContainer.style.bottom = "0px"
        videoContainer.style.backgroundColor = "black"
        return videoContainer
    }

    private createVideoElement(): HTMLVideoElement {
        const video: HTMLVideoElement = document.createElement("video")
        video.setAttribute("autoplay", "autoplay")
        video.setAttribute("muted", "muted")
        video.setAttribute("playsinline", "playsinline")
        video.style.position = "absolute"
        video.style.left = "0px"
        video.style.top = "0px"
        video.style.right = "0px"
        video.style.bottom = "0px"
        video.style.width = "100%"
        video.style.height = "100%"
        return video
    }

    private createCameraOverlayCanvas(): HTMLCanvasElement {
        const cameraOverlayCanvas: HTMLCanvasElement = document.createElement("canvas")
        cameraOverlayCanvas.style.position = "absolute"
        cameraOverlayCanvas.style.left = "0px"
        cameraOverlayCanvas.style.top = "0px"
        return cameraOverlayCanvas
    }

    private createCancelButton(): HTMLAnchorElement {
        const cancelButton: HTMLAnchorElement = document.createElement("a")
        cancelButton.href = "javascript:void(0)"
        cancelButton.innerText = "Cancel"
        cancelButton.style.textShadow = "0px 1px 5px rgba(0, 0, 0, 0.5)"
        cancelButton.style.fontFamily = "Helvetica, Arial, sans-serif"
        cancelButton.style.color = "white"
        cancelButton.style.textDecoration = "none"
        cancelButton.style.position = "absolute"
        cancelButton.style.bottom = " 16px"
        cancelButton.style.left = "8px"
        cancelButton.style.right = "8px"
        cancelButton.style.textAlign = "center"
        return cancelButton
    }

    private createPromptElement(): HTMLDivElement {
        const prompt: HTMLDivElement = document.createElement("div")
        prompt.style.textShadow = "0px 1px 5px rgba(0, 0, 0, 0.5)"
        prompt.style.fontFamily = "Helvetica, Arial, sans-serif"
        prompt.style.color = "white"
        prompt.style.position = "absolute"
        prompt.style.left = "8px"
        prompt.style.right = "8px"
        prompt.style.top = "16px"
        prompt.style.textAlign = "center"
        return prompt
    }

    private createProgressBarContainer(): HTMLDivElement {
        const progressBarContainer: HTMLDivElement = document.createElement("div")
        progressBarContainer.style.position = "absolute"
        progressBarContainer.style.top = "0px"
        progressBarContainer.style.left = "0px"
        progressBarContainer.style.right = "0px"
        progressBarContainer.style.bottom = "0px"
        progressBarContainer.style.width = "50%"
        progressBarContainer.style.height = "20px"
        progressBarContainer.style.overflow = "hidden"
        progressBarContainer.style.border = "2px solid white"
        progressBarContainer.style.borderRadius = "4px"
        progressBarContainer.style.margin = "auto"
        return progressBarContainer
    }

    private createProgressBarElement(): HTMLDivElement {
        const progressBar = document.createElement("div")
        progressBar.style.position = "absolute"
        progressBar.style.left = "0px"
        progressBar.style.top = "0px"
        progressBar.style.height = "100%"
        progressBar.style.width = "0%"
        progressBar.style.backgroundColor = "white"
        return progressBar
    }

    drawCardOutline(strokeStyle: string | CanvasGradient | CanvasPattern) {
        const scale: number = Math.min(this.videoContainer.clientWidth / this.video.videoWidth, this.videoContainer.clientHeight / this.video.videoHeight)
        this.cameraOverlayCanvas.width = this.video.videoWidth * scale
        this.cameraOverlayCanvas.height = this.video.videoHeight * scale
        this.cameraOverlayCanvas.style.left = ((this.videoContainer.clientWidth - this.cameraOverlayCanvas.width) / 2)+"px"
        this.cameraOverlayCanvas.style.top = ((this.videoContainer.clientHeight - this.cameraOverlayCanvas.height) / 2)+"px"
        this.cameraOverlayContext.clearRect(0, 0, this.cameraOverlayCanvas.width, this.cameraOverlayCanvas.height)
        
        const cardSize: Size = {"width": 0, "height": 0}
        if (this.cameraOverlayCanvas.width/this.cameraOverlayCanvas.height > this.cardAspectRatio) {
            cardSize.height = this.cameraOverlayCanvas.height * 0.85
            cardSize.width = cardSize.height * this.cardAspectRatio
        } else {
            cardSize.width = this.cameraOverlayCanvas.width * 0.85
            cardSize.height = cardSize.width / this.cardAspectRatio
        }
        const cardRect: Rect = new Rect(this.cameraOverlayCanvas.width / 2 - cardSize.width / 2, this.cameraOverlayCanvas.height / 2 - cardSize.height / 2, cardSize.width, cardSize.height)
        const cornerRadius: number = cardRect.width * 0.05
        const offset: number = cardRect.height * 0.25
        this.cameraOverlayContext.strokeStyle = strokeStyle
        this.cameraOverlayContext.lineWidth = 6
        this.cameraOverlayContext.beginPath()
        // Top left corner
        this.cameraOverlayContext.moveTo(cardRect.x, cardRect.y + offset)
        this.cameraOverlayContext.arcTo(cardRect.x, cardRect.y, cardRect.x + cornerRadius, cardRect.y, cornerRadius)
        this.cameraOverlayContext.lineTo(cardRect.x + offset, cardRect.y)
        // Top right corner
        this.cameraOverlayContext.moveTo(cardRect.right - offset, cardRect.y)
        this.cameraOverlayContext.arcTo(cardRect.right, cardRect.y, cardRect.right, cardRect.y + offset, cornerRadius)
        this.cameraOverlayContext.lineTo(cardRect.right, cardRect.y + offset)
        // Bottom right corner
        this.cameraOverlayContext.moveTo(cardRect.right, cardRect.bottom - offset)
        this.cameraOverlayContext.arcTo(cardRect.right, cardRect.bottom, cardRect.right - offset, cardRect.bottom, cornerRadius)
        this.cameraOverlayContext.lineTo(cardRect.right - offset, cardRect.bottom)
        // Bottom left corner
        this.cameraOverlayContext.moveTo(cardRect.x + offset, cardRect.bottom)
        this.cameraOverlayContext.arcTo(cardRect.x, cardRect.bottom, cardRect.x, cardRect.bottom - offset, cornerRadius)
        this.cameraOverlayContext.lineTo(cardRect.x, cardRect.bottom - offset)
        this.cameraOverlayContext.stroke()
    }

    setProgress(progress: number) {
        this.progressBar.style.width = progress+"%"
    }

    showPrompt(text: string, force: boolean = false) {
        if (this.promptLock && !force) {
            return
        }
        this.promptLock = true
        this.prompt.innerText = text
        setTimeout(() => this.promptLock = false, 1000)
    }

    showFlipCardInstruction() {
        this.showPrompt("Flip the card", true)
        const style: HTMLStyleElement = document.createElement("style")
        style.innerText = ".flipped { transform: rotateY(180deg) !important; transition: transform 2s; }"
        document.head.appendChild(style)

        const flipAnimationContainer: HTMLDivElement = document.createElement("div")
        flipAnimationContainer.style.position = "absolute"
        flipAnimationContainer.style.top = "0px"
        flipAnimationContainer.style.right = "0px"
        flipAnimationContainer.style.bottom = "0px"
        flipAnimationContainer.style.left = "0px"
        flipAnimationContainer.style.perspective = "500px"

        const flipAnimation: HTMLDivElement = document.createElement("div")
        flipAnimation.style.position = "absolute"
        flipAnimation.style.top = "0px"
        flipAnimation.style.right = "0px"
        flipAnimation.style.bottom = "0px"
        flipAnimation.style.left = "0px"
        flipAnimation.style.margin = "auto"
        flipAnimation.style.width = "172px"
        flipAnimation.style.height = "108px"
        flipAnimation.style.borderRadius = "6px"
        flipAnimation.style.backgroundColor = "white"
        flipAnimation.style.transform = "rotateY(0deg)"

        flipAnimationContainer.appendChild(flipAnimation)
        this.videoContainer.appendChild(flipAnimationContainer)
        this.cameraOverlayCanvas.style.visibility = "hidden"
        setTimeout(function() {
            flipAnimation.className = "flipped"
        }, 10)
        this.flipTimeout = setTimeout(() => {
            this.videoContainer.removeChild(flipAnimationContainer)
            document.head.removeChild(style)
            this.drawCardOutline("white")
            this.cameraOverlayCanvas.style.visibility = "visible"
            this.flipTimeout = null
        }, 2000)
    }

    removeProgressBar() {
        if (this.progressBarContainer.parentNode) {
            this.progressBarContainer.parentNode.removeChild(this.progressBarContainer)
        }
    }

    hideCameraOverlay() {
        this.cameraOverlayCanvas.style.visibility = "hidden"
    }

    cleanup() {
        clearTimeout(this.flipTimeout)
        if (this.videoContainer.parentNode) {
            this.videoContainer.parentNode.removeChild(this.videoContainer)
        }
    }

    createMetadataCallbacks(onFirstSide?: () => void): MetadataCallbacks {
        return {
            onQuadDetection: (quad: any) => {
                switch (quad.detectionStatus) {
                    case BlinkIDSDK.DetectionStatus.Fail:
                        this.showPrompt("Scanning")
                        this.drawCardOutline("white")
                        break
                    case BlinkIDSDK.DetectionStatus.Success:
                    case BlinkIDSDK.DetectionStatus.FallbackSuccess:
                        this.showPrompt("Hold it")
                        this.drawCardOutline("green")
                        break
                    case BlinkIDSDK.DetectionStatus.CameraAtAngle:
                        this.showPrompt("Point straight at the ID card")
                        this.drawCardOutline("white")
                        break
                    case BlinkIDSDK.DetectionStatus.CameraTooHigh:
                        this.showPrompt("Move closer")
                        this.drawCardOutline("white")
                        break
                    case BlinkIDSDK.DetectionStatus.CameraTooNear:
                    case BlinkIDSDK.DetectionStatus.DocumentTooCloseToEdge:
                    case BlinkIDSDK.DetectionStatus.Partial:
                        this.showPrompt("Move away")
                        this.drawCardOutline("white")
                        break
                }
            },
            onFirstSideResult: () => {
                this.showFlipCardInstruction()
                if (onFirstSide) {
                    onFirstSide()
                }
            },
            onDetectionFailed: () => {
                this.drawCardOutline("white")
            }
        }
    }

    get progressListener(): ProgressListener {
        return (progress: number) => {
            this.setProgress(progress)
        }
    }
}

export class IdCapture {

    readonly serviceURL: string
    private readonly faceRecognition: FaceRecognition
    private readonly loadBlinkWasmModule: Promise<any>
    private percentLoaded: number = 0
    private loadListeners: Set<ProgressListener> = new Set();

    constructor(settings: IdCaptureSettings, serviceURL?: string) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : ""
        this.faceRecognition = new FaceRecognition(this.serviceURL)
        const loadSettings: WasmSDKLoadSettings = new BlinkIDSDK.WasmSDKLoadSettings(settings.licenceKey)
        loadSettings.engineLocation = location.origin+settings.resourcesPath
        loadSettings.loadProgressCallback = this.onLoadProgressCallback
        this.loadBlinkWasmModule = BlinkIDSDK.loadWasmModule(loadSettings)
    }

    private onLoadProgressCallback = (percentLoaded: number) => {
        this.percentLoaded = percentLoaded
        for (let listener of this.loadListeners) {
            listener(percentLoaded)
        }
    }

    private registerLoadListener(listener: ProgressListener) {
        listener(this.percentLoaded)
        this.loadListeners.add(listener)
    }

    private unregisterLoadListener(listener: ProgressListener) {
        this.loadListeners.delete(listener)
    }

    private convertToIdCaptureResult(combinedResult: BlinkIdCombinedRecognizerResult): Promise<IdCaptureResult> {
        return new Promise<IdCaptureResult>((resolveInner: (value: IdCaptureResult) => void, rejectInner: (error: any) => void) => {
            const imageData: ImageData = combinedResult.fullDocumentFrontImage.rawImage
            const canvas: HTMLCanvasElement = document.createElement("canvas")
            const maxSize: number = 640
            let scale: number = Math.min(maxSize / Math.max(imageData.width, imageData.height), 1)
            canvas.width = imageData.width
            canvas.height = imageData.height
            const ctx = canvas.getContext("2d")
            ctx.putImageData(imageData, 0, 0)
            const img = new Image()
            img.onload = () => {
                if (scale < 1) {
                    canvas.width = imageData.width * scale
                    canvas.height = imageData.height * scale
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                    img.src = canvas.toDataURL()
                    scale = 1
                    return
                }
                this.faceRecognition.detectRecognizableFace(img, null).then(face => {
                    resolveInner({
                        "result": combinedResult,
                        "face": face
                    })
                }).catch(error => {
                    resolveInner({
                        "result": combinedResult,
                        "face": null
                    })
                })
            }
            img.onerror = (error) => {
                rejectInner(error)
            }
            img.src = canvas.toDataURL()
        })
    }

    private async createBlinkIdCombinedRecognizer(wasmSDK: WasmSDK): Promise<BlinkIdCombinedRecognizer> {
        const recognizer: BlinkIdCombinedRecognizer = await createBlinkIdCombinedRecognizer(wasmSDK)
        const recognizerSettings: BlinkIdCombinedRecognizerSettings = await recognizer.currentSettings()
        recognizerSettings.returnFullDocumentImage = true
        await recognizer.updateSettings(recognizerSettings)
        return recognizer
    }

    private async runIdCaptureSession(ui: IdCaptureUI): Promise<IdCaptureResult> {
        let recognizer: BlinkIdCombinedRecognizer
        let videoRecognizer: VideoRecognizer
        let recognizerRunner: RecognizerRunner
        try {
            const wasmSDK: WasmSDK = await this.loadBlinkWasmModule
            this.unregisterLoadListener(ui.progressListener)
            ui.removeProgressBar()
            recognizer = await this.createBlinkIdCombinedRecognizer(wasmSDK)
            recognizerRunner = await createRecognizerRunner(wasmSDK, [recognizer], true, ui.createMetadataCallbacks())
            videoRecognizer = await VideoRecognizer.createVideoRecognizerFromCameraStream(ui.video, recognizerRunner)
            const recognitionState: RecognizerResultState = await videoRecognizer.recognize(60000)
            if (recognitionState == RecognizerResultState.Valid) {
                const combinedResult: BlinkIdCombinedRecognizerResult = await recognizer.getResult()
                ui.showPrompt("Detecting face on ID card", true)
                ui.hideCameraOverlay()
                return await this.convertToIdCaptureResult(combinedResult)
            } else {
                throw new Error("Session timed out")
            }
        } finally {
            this.unregisterLoadListener(ui.progressListener)
            ui.cleanup()
            if (videoRecognizer) {
                videoRecognizer.releaseVideoFeed()
            }
            if (recognizerRunner) {
                recognizerRunner.delete()
            }
            if (recognizer) {
                recognizer.delete()
            }
        }
    }

    /**
     * Detect ID card in images
     * @param images Base64-encoded images of the ID card
     * @returns Promise
     */
    async detectIdCard(images: { front?: string, back?: string }): Promise<IdCaptureResponse> {
        const body: {front?: string, back?: string} = images
        const response: Response = await fetch(this.serviceURL + "/", {
            "method": "POST",
            "mode": "cors",
            "cache": "no-cache",
            "headers": {
                "Content-Type": "application/json"
            },
            "body": JSON.stringify(body)
        })
        if (response.status != 200) {
            throw new Error("ID card detection failed")
        }
        return await response.json()
    }

    /**
     * Capture ID card using the device camera
     * @returns Observable
     */
    captureIdCard(): Observable<IdCaptureResult> {
        return new Observable((subscriber: Subscriber<IdCaptureResult>) => {
            if (!BlinkIDSDK.isBrowserSupported()) {
                subscriber.error(new Error("Unsupported browser"))
                return
            }
            const ui: IdCaptureUI = new IdCaptureUI()
            ui.onCancel = subscriber.complete
            this.registerLoadListener(ui.progressListener)
            this.runIdCaptureSession(ui).then(result => {
                if (!subscriber.closed) {
                    subscriber.next(result)
                    subscriber.complete()
                }
            }).catch(error => {
                ui.removeProgressBar()
                if (!subscriber.closed) {
                    subscriber.error(error)
                }
            })
            return () => {
                ui.cleanup()
            }
        })
    }
}

export class IdCaptureSettings {
    licenceKey: string
    resourcesPath: string

    constructor(licenceKey: string, resourcesPath: string) {
        this.licenceKey = licenceKey
        this.resourcesPath = resourcesPath
    }
}