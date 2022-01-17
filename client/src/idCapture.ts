'use strict';

import { Observable, Subscriber, Subscription } from "rxjs"
import * as BlinkIDSDK from "@microblink/blinkid-in-browser-sdk/es/blinkid-sdk"
import { FaceRecognition } from "./faceRecognition"
import { Rect, emitRxEvent } from "./utils"
import {
    Size,
    RecognizableFace,
    DocumentPages,
    IdCaptureResponse,
    IdCaptureResult,
    IdCaptureUI,
    SupportedRecognizerResult,
    ProgressListener,
    SupportedRecognizer,
    RecognizerName,
    IdCaptureUIFactory,
    IdCaptureEvent,
    IdCaptureEventType,
    IdCaptureProgressEvent,
    DocumentSide
} from "./types"
import { 
    BlinkIdCombinedRecognizerSettings, 
    RecognizerRunner, 
    VideoRecognizer, 
    WasmSDK, 
    WasmSDKLoadSettings, 
    BlinkIdRecognizerResult,
    BlinkIdCombinedRecognizer, 
    createBlinkIdCombinedRecognizer, 
    createRecognizerRunner, 
    RecognizerResultState, 
    MetadataCallbacks,
    SuccessFrameGrabberRecognizer,
    Recognizer,
    createBlinkIdRecognizer,
    BlinkIdRecognizer,
    BlinkIdRecognizerSettings,
    IdBarcodeRecognizer,
    createIdBarcodeRecognizer,
    OnScanningDone,
    DisplayableQuad,
    ExtensionFactors
} from "@microblink/blinkid-in-browser-sdk"

/**
 * Ver-ID's implementation of the `IdCaptureUI` interface
 * @category ID capture
 */
class VerIDIdCaptureUI implements IdCaptureUI {

    private videoContainer: HTMLDivElement
    private _video: HTMLVideoElement
    private cameraOverlayCanvas: HTMLCanvasElement
    private cameraOverlayContext: CanvasRenderingContext2D
    private _cancelButton: HTMLAnchorElement
    private prompt: HTMLDivElement
    private progressBarContainer: HTMLDivElement
    private progressBar: HTMLDivElement
    private promptLock = false
    private flipTimeout: ReturnType<typeof setTimeout> | undefined
    private animationClassNameTimeout: ReturnType<typeof setTimeout> | undefined
    private promptLockTimeout: ReturnType<typeof setTimeout> | undefined
    private eventListeners: {[k in IdCaptureEventType]?: (event: IdCaptureEvent) => void} = {}
    readonly cardAspectRatio: number = 85.6/53.98

    constructor() {
        this.videoContainer = this.createVideoContainer()
        document.body.appendChild(this.videoContainer)
        this._video = this.createVideoElement()
        this.cameraOverlayCanvas = this.createCameraOverlayCanvas()
        this.cameraOverlayContext = this.cameraOverlayCanvas.getContext("2d")
        this._cancelButton = this.createCancelButton()
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
            this.trigger({type: IdCaptureEventType.CANCEL})
        }
        this.video.onplaying = () => {
            this.drawCardOutline("white")
        }
    }

    get video() {
        return this._video
    }

    get cancelButton() {
        return this._cancelButton
    }

    on<Event extends IdCaptureEvent>(eventType: IdCaptureEventType, callback: (event: Event) => void) {
        if (callback) {
            this.eventListeners[eventType] = callback
        } else {
            delete this.eventListeners[eventType]
        }
    }

    trigger(event: IdCaptureEvent) {
        switch (event.type) {
            case IdCaptureEventType.CAPTURE_STARTED:
                this.showCameraOverlay()
                break
            case IdCaptureEventType.CANCEL:
                break
            case IdCaptureEventType.CAMERA_ANGLED:
                this.showPrompt("Point straight at the ID card")
                this.drawCardOutline("white")
                break
            case IdCaptureEventType.CAMERA_TOO_CLOSE:
                this.showPrompt("Move away")
                this.drawCardOutline("white")
                break
            case IdCaptureEventType.CAMERA_TOO_FAR:
                this.showPrompt("Move closer")
                this.drawCardOutline("white")
                break
            case IdCaptureEventType.CAPTURING:
                this.showPrompt("Scanning")
                this.drawCardOutline("white")
                break
            case IdCaptureEventType.CAPTURE_ENDED:
                this.cleanup()
                break
            case IdCaptureEventType.FINDING_FACE:
                this.showPrompt("Finding face on document", true)
                this.drawCardOutline("white")
                break
            case IdCaptureEventType.PAGE_CAPTURED:
                this.showPrompt("Hold it")
                this.drawCardOutline("green")
                break
            case IdCaptureEventType.NEXT_PAGE_REQUESTED:
                this.hideCameraOverlay()
                this.showPrompt("Flip the card", true)
                this.showFlipCardInstruction(() => {
                    this.trigger({type: IdCaptureEventType.CAPTURE_STARTED})
                })
                break
            case IdCaptureEventType.LOADING_PROGRESSED:
                this.setProgress((event as IdCaptureProgressEvent).progress)
                break
            case IdCaptureEventType.LOADED:
                this.removeProgressBar()
                break
        }
        if (this.eventListeners[event.type]) {
            this.eventListeners[event.type](event)
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

    private drawCardOutline(strokeStyle: string | CanvasGradient | CanvasPattern) {
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

    private setProgress(progress: number) {
        this.progressBar.style.width = progress+"%"
    }

    private showPrompt(text: string, force: boolean = false) {
        if (this.promptLock && !force) {
            return
        }
        this.promptLock = true
        this.prompt.innerText = text
        this.promptLockTimeout = setTimeout(() => this.promptLock = false, 700)
    }

    private showFlipCardInstruction(onDone?: () => void) {
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
        this.animationClassNameTimeout = setTimeout(function() {
            flipAnimation.className = "flipped"
        }, 10)
        const videoContainer = this.videoContainer
        this.flipTimeout = setTimeout(() => {
            videoContainer.removeChild(flipAnimationContainer)
            document.head.removeChild(style)
            this.drawCardOutline("white")
            this.cameraOverlayCanvas.style.visibility = "visible"
            if (onDone) {
                onDone()
            }
        }, 2000)
    }

    private removeProgressBar() {
        if (this.progressBarContainer.parentNode) {
            this.progressBarContainer.parentNode.removeChild(this.progressBarContainer)
        }
    }

    private hideCameraOverlay() {
        this.cameraOverlayCanvas.style.visibility = "hidden"
    }
    
    private showCameraOverlay() {
        this.cameraOverlayCanvas.style.visibility = "visible"
    }

    private clearTimeouts() {
        clearTimeout(this.animationClassNameTimeout)
        clearTimeout(this.flipTimeout)
        clearTimeout(this.promptLockTimeout)
    }

    private cleanup() {
        this.clearTimeouts()
        if (this.videoContainer.parentNode) {
            this.videoContainer.parentNode.removeChild(this.videoContainer)
        }
        this.videoContainer = undefined
        this.cameraOverlayCanvas = undefined
        this.cameraOverlayContext = undefined
        this._cancelButton.onclick = undefined
        this._cancelButton = undefined
        this.progressBar = undefined
        this._video = undefined
        this.prompt = undefined
    }
}

type CombinedResult = {
    result: SupportedRecognizerResult,
    pages: DocumentPages
}

/**
 * @category ID capture
 */
export class IdCapture {

    readonly serviceURL: string
    private readonly faceRecognition: FaceRecognition
    private readonly loadBlinkWasmModule: Promise<WasmSDK>
    private percentLoaded = 0
    private loadListeners: Set<ProgressListener> = new Set()
    private nextPageTimeout: ReturnType<typeof setTimeout> | undefined
    private captureEndTimeout: ReturnType<typeof setTimeout> | undefined
    private loadFailureTimeout: ReturnType<typeof setTimeout> | undefined

    constructor(settings: IdCaptureSettings, serviceURL?: string) {
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : settings.serviceURL
        this.faceRecognition = new FaceRecognition(this.serviceURL)
        const loadSettings: WasmSDKLoadSettings = new BlinkIDSDK.WasmSDKLoadSettings(settings.licenceKey)
        loadSettings.engineLocation = location.origin+settings.resourcesPath
        loadSettings.loadProgressCallback = this.onLoadProgressCallback
        this.loadBlinkWasmModule = BlinkIDSDK.loadWasmModule(loadSettings)
    }

    private onLoadProgressCallback = (percentLoaded: number) => {
        this.percentLoaded = percentLoaded
        for (const listener of this.loadListeners) {
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

    private async createBlinkIdCombinedRecognizer(wasmSDK: WasmSDK): Promise<BlinkIdCombinedRecognizer> {
        const recognizer: BlinkIdCombinedRecognizer = await createBlinkIdCombinedRecognizer(wasmSDK)
        const recognizerSettings: BlinkIdCombinedRecognizerSettings = await recognizer.currentSettings()
        recognizerSettings.returnFullDocumentImage = true
        recognizerSettings.fullDocumentImageExtensionFactors = new ExtensionFactors(0.1, 0.1, 0.1, 0.1)
        recognizerSettings.fullDocumentImageDpi = 600
        await recognizer.updateSettings(recognizerSettings)
        return recognizer
    }

    private async createBlinkIdRecognizer(wasmSDK: WasmSDK): Promise<BlinkIdRecognizer> {
        const recognizer: BlinkIdRecognizer = await createBlinkIdRecognizer(wasmSDK)
        const recognizerSettings: BlinkIdRecognizerSettings = await recognizer.currentSettings()
        recognizerSettings.returnFullDocumentImage = true
        await recognizer.updateSettings(recognizerSettings)
        return recognizer
    }

    private createBarcodeRecognizer(wasmSDK: WasmSDK): Promise<IdBarcodeRecognizer> {
        return createIdBarcodeRecognizer(wasmSDK)
    }

    private async convertToIdCaptureResult(result: CombinedResult): Promise<IdCaptureResult> {
        const idCaptureResult: IdCaptureResult = new IdCaptureResult(result.result, result.pages)
        let face: RecognizableFace
        try {
            const img = await idCaptureResult.documentImage(DocumentSide.FRONT, true, 640)
            face = await this.faceRecognition.detectRecognizableFace(img, null)
        } catch (_error) {
            face = null
        }
        idCaptureResult.face = face
        return idCaptureResult
    }

    private async getResultFromRecognizer(recognizer: SupportedRecognizer): Promise<CombinedResult> {
        const recognizerName: RecognizerName = recognizer.recognizerName as RecognizerName
        const result: SupportedRecognizerResult = await recognizer.getResult() as SupportedRecognizerResult
        let pages: DocumentPages
        if (recognizerName == "IdBarcodeRecognizer" || (recognizerName == "BlinkIdRecognizer" && (<BlinkIdRecognizerResult>result).barcode && (<BlinkIdRecognizerResult>result).barcode.barcodeData && (<BlinkIdRecognizerResult>result).barcode.barcodeData.stringData && (<BlinkIdRecognizerResult>result).barcode.barcodeData.stringData.length > 0)) {
            pages = DocumentPages.BACK
        } else if (recognizerName == "BlinkIdRecognizer") {
            pages = DocumentPages.FRONT
        } else {
            pages = DocumentPages.FRONT_AND_BACK
        }
        if (result.state == RecognizerResultState.Valid) {
            const combinedResult: CombinedResult = {
                pages: pages,
                result: result
            }
            return combinedResult
        } else {
            throw new Error("Invalid recognizer state")
        }
    }

    private getRecognizerName(recognizer: Recognizer): string {
        if ((recognizer as SuccessFrameGrabberRecognizer<any>).wrappedRecognizer) {
            return (recognizer as SuccessFrameGrabberRecognizer<any>).wrappedRecognizer.recognizerName
        } else {
            return recognizer.recognizerName
        }
    }

    private removeRecognizer(recognizer: SupportedRecognizer, recognizers: SupportedRecognizer[]): SupportedRecognizer[] {
        const recognizerName = this.getRecognizerName(recognizer)
        return recognizers.filter(val => this.getRecognizerName(val) != recognizerName)
    }

    private getRecognitionCallback(videoRecognizer: VideoRecognizer, recognizers: SupportedRecognizer[], callback: (error: any, result?: CombinedResult) => void): OnScanningDone {
        return async (state: RecognizerResultState) => {
            if (state == RecognizerResultState.Valid || state == RecognizerResultState.StageValid) {
                videoRecognizer.pauseRecognition()
                for (const recognizer of recognizers) {
                    try {
                        const combinedResult = await this.getResultFromRecognizer(recognizer)
                        if (combinedResult.result.state == RecognizerResultState.Valid) {
                            callback(null, combinedResult)
                            return
                        }
                    } catch (err) {
                        if (err && err.message == "Invalid recognizer state") {
                            videoRecognizer.resumeRecognition(false)
                        } else {
                            callback(err)
                        }
                        return
                    }
                }
                videoRecognizer.resumeRecognition(false)
            }
        }
    }

    private runIdCaptureSession(videoRecognizer: VideoRecognizer, recognizers: SupportedRecognizer[], settings: IdCaptureSessionSettings): Observable<CombinedResult> {
        return new Observable<CombinedResult>((subscriber: Subscriber<CombinedResult>) => {
            let emissionCount = 0
            videoRecognizer.startRecognition(this.getRecognitionCallback(videoRecognizer, recognizers, (error, result) => {
                if (error) {
                    emitRxEvent(subscriber, {"type": "error", "error": error})
                } else if (result) {
                    emissionCount ++
                    emitRxEvent(subscriber, {"type": "next", "value": result})
                    if (emissionCount == recognizers.length) {
                        emitRxEvent(subscriber, {"type": "complete"})
                    }
                }
            }), settings.timeout)
        })
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
        return response.json()
    }

    private recognizerRunner: RecognizerRunner

    private async getRecognizerRunner(wasmSDK: WasmSDK, recognizers: Recognizer[]): Promise<RecognizerRunner> {
        if (this.recognizerRunner) {
            this.recognizerRunner.reconfigureRecognizers(recognizers, false)
        } else {
            this.recognizerRunner = await createRecognizerRunner(wasmSDK, recognizers, false)
        }
        return this.recognizerRunner
    }

    private async createRecognizers(wasmSDK: WasmSDK, settings: IdCaptureSessionSettings): Promise<SupportedRecognizer[]> {
        const recognizers: SupportedRecognizer[] = []
        if (settings.pages == DocumentPages.FRONT_AND_BACK) {
            recognizers.push(await this.createBlinkIdCombinedRecognizer(wasmSDK))
        } else if (settings.pages == DocumentPages.FRONT) {
            recognizers.push(await this.createBlinkIdRecognizer(wasmSDK))
        } else {
            recognizers.push(await this.createBarcodeRecognizer(wasmSDK))
        }
        return recognizers
    }

    private createMetadataCallbacks(ui: IdCaptureUI): MetadataCallbacks {
        return {
            onQuadDetection: (quad: DisplayableQuad) => {
                switch (quad.detectionStatus) {
                    case BlinkIDSDK.DetectionStatus.Fail:
                        ui.trigger({type:IdCaptureEventType.CAPTURING})
                        break
                    case BlinkIDSDK.DetectionStatus.Success:
                    case BlinkIDSDK.DetectionStatus.FallbackSuccess:
                        ui.trigger({type:IdCaptureEventType.PAGE_CAPTURED})
                        break
                    case BlinkIDSDK.DetectionStatus.CameraAtAngle:
                        ui.trigger({type:IdCaptureEventType.CAMERA_ANGLED})
                        break
                    case BlinkIDSDK.DetectionStatus.CameraTooHigh:
                        ui.trigger({type:IdCaptureEventType.CAMERA_TOO_FAR})
                        break
                    case BlinkIDSDK.DetectionStatus.CameraTooNear:
                    case BlinkIDSDK.DetectionStatus.DocumentTooCloseToEdge:
                    case BlinkIDSDK.DetectionStatus.Partial:
                        ui.trigger({type:IdCaptureEventType.CAMERA_TOO_CLOSE})
                        break
                }
            },
            onDetectionFailed: () => {
                ui.trigger({type:IdCaptureEventType.CAPTURING})
            },
            onFirstSideResult: () => {
                ui.trigger({type:IdCaptureEventType.NEXT_PAGE_REQUESTED})
            }
        }
    }

    private clearTimeouts() {
        clearTimeout(this.nextPageTimeout)
        clearTimeout(this.captureEndTimeout)
        clearTimeout(this.loadFailureTimeout)
        this.nextPageTimeout = undefined
        this.captureEndTimeout = undefined
        this.loadFailureTimeout = undefined
    }

    /**
     * Capture ID card using the device camera
     * @param settings Session settings
     * @returns Observable
     */
    captureIdCard(settings?: IdCaptureSessionSettings): Observable<IdCaptureResult> {
        let sessionSubscription: Subscription
        return new Observable((subscriber: Subscriber<IdCaptureResult>) => {
            if (!BlinkIDSDK.isBrowserSupported()) {
                emitRxEvent(subscriber, {"type": "error", "error": new Error("Unsupported browser")})
                return
            }
            function disposeVideoRecognizer() {
                if (videoRecognizer != null) {
                    videoRecognizer.releaseVideoFeed()
                    videoRecognizer = null
                }
            }
            async function disposeRecognizerRunner() {
                if (recognizerRunner) {
                    await recognizerRunner.resetRecognizers(true)
                    recognizerRunner = null
                }
            }
            let resolvedSettings: IdCaptureSessionSettings
            if (!settings) {
                resolvedSettings = new IdCaptureSessionSettings()
            } else {
                resolvedSettings = settings
            }
            let videoRecognizer: VideoRecognizer
            let recognizerRunner: RecognizerRunner
            let recognizers: SupportedRecognizer[]
            const ui: IdCaptureUI = resolvedSettings.createUI()
            ui.on(IdCaptureEventType.CANCEL, () => {
                emitRxEvent(subscriber, {"type": "complete"})
            })
            const progressListener: ProgressListener = (progress: number) => {
                const event: IdCaptureProgressEvent = {
                    type: IdCaptureEventType.LOADING_PROGRESSED,
                    progress: progress
                }
                ui.trigger(event)
            }
            this.registerLoadListener(progressListener)
            this.loadBlinkWasmModule.then(async (wasmSDK: WasmSDK) => {
                ui.trigger({type:IdCaptureEventType.LOADED})
                try {
                    recognizers = await this.createRecognizers(wasmSDK, resolvedSettings)
                    const pageCount = recognizers.length
                    recognizerRunner = await this.getRecognizerRunner(wasmSDK, Object.values(recognizers))
                    await recognizerRunner.setMetadataCallbacks(this.createMetadataCallbacks(ui))
                    videoRecognizer = await VideoRecognizer.createVideoRecognizerFromCameraStream(ui.video, recognizerRunner)
                    ui.trigger({type:IdCaptureEventType.CAPTURE_STARTED})
                    let emissionCount = 0
                    sessionSubscription = this.runIdCaptureSession(videoRecognizer, recognizers, resolvedSettings).subscribe({
                        next: async (combinedResult: CombinedResult) => {
                            try {
                                if (combinedResult.pages != DocumentPages.BACK) {
                                    ui.trigger({type:IdCaptureEventType.FINDING_FACE})
                                }
                                const result = await this.convertToIdCaptureResult(combinedResult)
                                emitRxEvent(subscriber, {"type": "next", "value": result})
                                if (++emissionCount < pageCount) {
                                    ui.on(IdCaptureEventType.CAPTURE_STARTED, () => {
                                        if (videoRecognizer) {
                                            videoRecognizer.resumeRecognition(true)
                                            if (this.nextPageTimeout !== undefined) {
                                                clearTimeout(this.nextPageTimeout)
                                                this.nextPageTimeout = undefined
                                            }
                                            this.nextPageTimeout = setTimeout(() => {
                                                ui.trigger({type: IdCaptureEventType.NEXT_PAGE_REQUESTED})
                                            })
                                        }
                                    })
                                } else {
                                    disposeVideoRecognizer()
                                    emitRxEvent(subscriber, {"type": "complete"})
                                }
                            } catch (error) {
                                emitRxEvent(subscriber, {"type": "error", "error": error})
                            }
                        },
                        error: (error: any) => {
                            disposeVideoRecognizer()
                            emitRxEvent(subscriber, {"type": "error", "error": error})
                        }
                    })
                    sessionSubscription.add(() => {
                        disposeVideoRecognizer()
                        disposeRecognizerRunner()
                    })
                    recognizerRunner = null
                } catch (error) {
                    disposeRecognizerRunner()
                    emitRxEvent(subscriber, {"type": "error", "error": error})
                }
            }).catch(error => {
                this.loadFailureTimeout = setTimeout(() => {
                    ui.trigger({type:IdCaptureEventType.LOADING_FAILED})
                })
                emitRxEvent(subscriber, {"type": "error", "error": error})
            }).finally(() => {
                this.unregisterLoadListener(progressListener)
            })
            return () => {
                if (sessionSubscription) {
                    sessionSubscription.unsubscribe()
                }
                disposeVideoRecognizer()
                disposeRecognizerRunner()
                this.unregisterLoadListener(progressListener)
                if (this.captureEndTimeout !== undefined) {
                    clearTimeout(this.captureEndTimeout)
                    this.captureEndTimeout = undefined
                }
                this.captureEndTimeout = setTimeout(() => {
                    this.clearTimeouts()
                    ui.trigger({type:IdCaptureEventType.CAPTURE_ENDED})
                })
            }
        })
    }
}

/**
 * ID capture settings
 * @category ID capture
 */
export class IdCaptureSettings {
    /**
     * Microblink licence key (must be issued for the domain name of the running application)
     */
    licenceKey: string
    /**
     * Path to resources used by the ID capture
     */
    resourcesPath: string
    /**
     * URL for the server accepting the supporting face detection and ID capture calls
     */
    serviceURL: string

    /**
     * Construtor
     * @param licenceKey Microblink licence key (must be issued for the domain name of the running application)
     * @param resourcesPath Path to resources used by the ID capture
     * @param serviceURL URL for the server accepting the supporting face detection and ID capture calls
     */
    constructor(licenceKey: string, resourcesPath: string, serviceURL: string = "") {
        this.licenceKey = licenceKey
        this.resourcesPath = resourcesPath
        this.serviceURL = serviceURL ? serviceURL.replace(/[\/\s]+$/, "") : ""
    }
}

/**
 * ID capture session settings
 * @category ID capture
 */
export class IdCaptureSessionSettings {
    /**
     * Pages to capture
     */
    pages: DocumentPages
    /**
     * Session timeout in milliseconds
     */
    timeout: number
    /**
     * Create ID capture UI
     * @returns Function that creates an instance of the IdCaptureUI interface
     */
    createUI: IdCaptureUIFactory = () => new VerIDIdCaptureUI()

    /**
     * Constructor
     * @param pages Pages to capture
     * @param timeout Session timeout in milliseconds (default = infinity)
     * @param saveCapturedImages Indicates whether the session should save the images obtained from the camera that have been used in successful capture (default = `false`)
     */
    constructor(pages: DocumentPages = DocumentPages.FRONT_AND_BACK, timeout: number = Number.POSITIVE_INFINITY) {
        this.pages = pages
        this.timeout = timeout
    }
}