import { Observable, Subscriber } from "rxjs"
import * as BlinkIDSDK from "@microblink/blinkid-in-browser-sdk/es/blinkid-sdk"
import { RecognizableFace, FaceRecognition } from "./faceRecognition"
import { BlinkIdCombinedRecognizer, BlinkIdCombinedRecognizerResult, BlinkIdCombinedRecognizerSettings, RecognizerRunner, VideoRecognizer, WasmSDK, WasmSDKLoadSettings } from "@microblink/blinkid-in-browser-sdk/types"
import { Size, Rect } from "./utils"

export interface IdCaptureResult {
    face: RecognizableFace,
    result: BlinkIdCombinedRecognizerResult
}

type ProgressListener = (progress: number) => void

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

    async detectIdCard(images: { front?: string, back?: string }): Promise<{ face?: RecognizableFace }[]> {
        const body: {front?: string, back?: string, calculate_authenticity_score?: boolean} = images
        body.calculate_authenticity_score = true
        const response: Response = await fetch(this.serviceURL + "/detectIdCard", {
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
        const json = await response.json()
        const imageSide = json.reduce(function(last: {fullDocumentImageBase64?: string}, current: {fullDocumentImageBase64?: string}) {
            if (last.fullDocumentImageBase64) {
                return last
            } else if (current.fullDocumentImageBase64) {
                return current
            } else {
                return null
            }
        })
        if (imageSide) {
            json.face = await this.faceRecognition.createRecognizableFace(imageSide.fullDocumentImageBase64)
        }
        return json
    }

    /**
     * @returns 
     * @experimental
     * @alpha
     */
    captureIdCard(): Observable<IdCaptureResult> {
        return new Observable((subscriber: Subscriber<IdCaptureResult>) => {
            if (!BlinkIDSDK.isBrowserSupported()) {
                subscriber.error(new Error("Unsupported browser"))
                return
            }
    
            const videoContainer: HTMLDivElement = document.createElement("div")
            videoContainer.style.position = "fixed"
            videoContainer.style.left = "0px"
            videoContainer.style.top = "0px"
            videoContainer.style.right = "0px"
            videoContainer.style.bottom = "0px"
            videoContainer.style.backgroundColor = "black"
            document.body.appendChild(videoContainer)
    
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

            const cameraOverlayCanvas: HTMLCanvasElement = document.createElement("canvas")
            cameraOverlayCanvas.style.position = "absolute"
            cameraOverlayCanvas.style.left = "0px"
            cameraOverlayCanvas.style.top = "0px"
            const cameraOverlayContext: CanvasRenderingContext2D = cameraOverlayCanvas.getContext("2d")
    
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
            cancelButton.onclick = () => {
                subscriber.complete()
            }

            const prompt: HTMLDivElement = document.createElement("div")
            prompt.style.textShadow = "0px 1px 5px rgba(0, 0, 0, 0.5)"
            prompt.style.fontFamily = "Helvetica, Arial, sans-serif"
            prompt.style.color = "white"
            prompt.style.position = "absolute"
            prompt.style.left = "8px"
            prompt.style.right = "8px"
            prompt.style.top = "16px"
            prompt.style.textAlign = "center"
            
            videoContainer.appendChild(video)
            videoContainer.appendChild(cameraOverlayCanvas)
            videoContainer.appendChild(cancelButton)
            videoContainer.appendChild(prompt)

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
            const progressBar = document.createElement("div")
            progressBar.style.position = "absolute"
            progressBar.style.left = "0px"
            progressBar.style.top = "0px"
            progressBar.style.height = "100%"
            progressBar.style.width = "0%"
            progressBar.style.backgroundColor = "white"
            progressBarContainer.appendChild(progressBar)
            
            videoContainer.appendChild(progressBarContainer)

            let promptLock: boolean = false

            function updatePrompt(text: string, force: boolean = false) {
                if (promptLock && !force) {
                    return
                }
                promptLock = true
                prompt.innerText = text
                setTimeout(() => promptLock = false, 1000)
            }

            const cardAspectRatio: number = 85.6/53.98

            function drawCardOutline(strokeStyle: string | CanvasGradient | CanvasPattern) {
                const scale: number = Math.min(videoContainer.clientWidth / video.videoWidth, videoContainer.clientHeight / video.videoHeight)
                cameraOverlayCanvas.width = video.videoWidth * scale
                cameraOverlayCanvas.height = video.videoHeight * scale
                cameraOverlayCanvas.style.left = ((videoContainer.clientWidth - cameraOverlayCanvas.width) / 2)+"px"
                cameraOverlayCanvas.style.top = ((videoContainer.clientHeight - cameraOverlayCanvas.height) / 2)+"px"
                cameraOverlayContext.clearRect(0, 0, cameraOverlayCanvas.width, cameraOverlayCanvas.height)
                
                const cardSize: Size = {"width": 0, "height": 0}
                if (cameraOverlayCanvas.width/cameraOverlayCanvas.height > cardAspectRatio) {
                    cardSize.height = cameraOverlayCanvas.height * 0.85
                    cardSize.width = cardSize.height * cardAspectRatio
                } else {
                    cardSize.width = cameraOverlayCanvas.width * 0.85
                    cardSize.height = cardSize.width / cardAspectRatio
                }
                const cardRect: Rect = new Rect(cameraOverlayCanvas.width / 2 - cardSize.width / 2, cameraOverlayCanvas.height / 2 - cardSize.height / 2, cardSize.width, cardSize.height)
                const cornerRadius: number = cardRect.width * 0.05
                const offset: number = cardRect.height * 0.25
                cameraOverlayContext.strokeStyle = strokeStyle
                cameraOverlayContext.lineWidth = 6
                cameraOverlayContext.beginPath()
                // Top left corner
                cameraOverlayContext.moveTo(cardRect.x, cardRect.y + offset)
                cameraOverlayContext.arcTo(cardRect.x, cardRect.y, cardRect.x + cornerRadius, cardRect.y, cornerRadius)
                cameraOverlayContext.lineTo(cardRect.x + offset, cardRect.y)
                // Top right corner
                cameraOverlayContext.moveTo(cardRect.right - offset, cardRect.y)
                cameraOverlayContext.arcTo(cardRect.right, cardRect.y, cardRect.right, cardRect.y + offset, cornerRadius)
                cameraOverlayContext.lineTo(cardRect.right, cardRect.y + offset)
                // Bottom right corner
                cameraOverlayContext.moveTo(cardRect.right, cardRect.bottom - offset)
                cameraOverlayContext.arcTo(cardRect.right, cardRect.bottom, cardRect.right - offset, cardRect.bottom, cornerRadius)
                cameraOverlayContext.lineTo(cardRect.right - offset, cardRect.bottom)
                // Bottom left corner
                cameraOverlayContext.moveTo(cardRect.x + offset, cardRect.bottom)
                cameraOverlayContext.arcTo(cardRect.x, cardRect.bottom, cardRect.x, cardRect.bottom - offset, cornerRadius)
                cameraOverlayContext.lineTo(cardRect.x, cardRect.bottom - offset)
                cameraOverlayContext.stroke()
            }

            video.onplaying = () => {
                drawCardOutline("white")
            }

            let flipTimeout: any

            const loadListener = (progress: number) => {
                progressBar.style.width = progress+"%"
            }
            this.registerLoadListener(loadListener)
            
            let run = async () => {
                function cleanup() {
                    if (videoRecognizer) {
                        videoRecognizer.releaseVideoFeed()
                        videoRecognizer = null
                    }
                    if (recognizerRunner) {
                        recognizerRunner.delete()
                        recognizerRunner = null
                    }
                    if (recognizer) {
                        recognizer.delete()
                        recognizer = null
                    }
                }
                let recognizer: BlinkIdCombinedRecognizer
                let videoRecognizer: VideoRecognizer
                let recognizerRunner: RecognizerRunner
                try {
                    const wasmSDK: WasmSDK = await this.loadBlinkWasmModule
                    this.unregisterLoadListener(loadListener)
                    if (progressBarContainer.parentNode) {
                        progressBarContainer.parentNode.removeChild(progressBarContainer)
                    }
                    recognizer = await BlinkIDSDK.createBlinkIdCombinedRecognizer(wasmSDK)
                    const recognizerSettings: BlinkIdCombinedRecognizerSettings = await recognizer.currentSettings()
                    recognizerSettings.returnFullDocumentImage = true
                    await recognizer.updateSettings(recognizerSettings)
                    recognizerRunner = await BlinkIDSDK.createRecognizerRunner(wasmSDK, [recognizer], true, {
                        onQuadDetection: (quad: any) => {
                            switch (quad.detectionStatus) {
                                case BlinkIDSDK.DetectionStatus.Fail:
                                    updatePrompt("Scanning")
                                    drawCardOutline("white")
                                    break
                                case BlinkIDSDK.DetectionStatus.Success:
                                case BlinkIDSDK.DetectionStatus.FallbackSuccess:
                                    updatePrompt("Hold it")
                                    drawCardOutline("green")
                                    break
                                case BlinkIDSDK.DetectionStatus.CameraAtAngle:
                                    updatePrompt("Point straight at the ID card")
                                    drawCardOutline("white")
                                    break
                                case BlinkIDSDK.DetectionStatus.CameraTooHigh:
                                    updatePrompt("Move closer")
                                    drawCardOutline("white")
                                    break
                                case BlinkIDSDK.DetectionStatus.CameraTooNear:
                                case BlinkIDSDK.DetectionStatus.DocumentTooCloseToEdge:
                                case BlinkIDSDK.DetectionStatus.Partial:
                                    updatePrompt("Move away")
                                    drawCardOutline("white")
                                    break
                            }
                        },
                        onFirstSideResult: () => {
                            updatePrompt("Flip the card", true)
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
                            videoContainer.appendChild(flipAnimationContainer)
                            cameraOverlayCanvas.style.visibility = "hidden"
                            setTimeout(function() {
                                flipAnimation.className = "flipped"
                            }, 10)
                            flipTimeout = setTimeout(function() {
                                videoContainer.removeChild(flipAnimationContainer)
                                document.head.removeChild(style)
                                drawCardOutline("white")
                                cameraOverlayCanvas.style.visibility = "visible"
                                flipTimeout = null
                            }, 2000)
                        },
                        onDetectionFailed: () => {
                            drawCardOutline("white")
                        }
                    })
                    videoRecognizer = await BlinkIDSDK.VideoRecognizer.createVideoRecognizerFromCameraStream(video, recognizerRunner)
                    const getResult = async (state: BlinkIDSDK.RecognizerResultState) => {
                        if (state !== BlinkIDSDK.RecognizerResultState.Empty) {
                            const blinkIdResult: BlinkIdCombinedRecognizerResult = await recognizer.getResult()
                            if (!subscriber.closed && blinkIdResult.state !== BlinkIDSDK.RecognizerResultState.Empty) {
                                return blinkIdResult
                            }
                        }
                        throw new Error("Failed to recognize ID card")
                    }
                    const convertToIdCaptureResult = (combinedResult: BlinkIdCombinedRecognizerResult) => {
                        cleanup()
                        updatePrompt("Detecting face on ID card", true)
                        cameraOverlayCanvas.style.visibility = "hidden"
                        return new Promise<IdCaptureResult>((resolve: (value: IdCaptureResult) => void, reject: (error: any) => void) => {
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
                                    scale = 1
                                    img.src = canvas.toDataURL()
                                    return
                                }
                                this.faceRecognition.createRecognizableFace(img, null, true).then(face => {
                                    resolve({
                                        "result": combinedResult,
                                        "face": face
                                    })
                                }).catch(error => {
                                    resolve({
                                        "result": combinedResult,
                                        "face": null
                                    })
                                })
                            }
                            img.onerror = (error) => {
                                reject(error)
                            }
                            img.src = canvas.toDataURL()
                        })
                    }
                    const idCaptureResult = await convertToIdCaptureResult(await getResult(await videoRecognizer.recognize()))
                    return idCaptureResult
                } finally {
                    this.unregisterLoadListener(loadListener)
                    cleanup()
                }
            }
            run().then(result => {
                if (!subscriber.closed) {
                    subscriber.next(result)
                    subscriber.complete()
                }
            }).catch(error => {
                if (progressBarContainer.parentNode) {
                    progressBarContainer.parentNode.removeChild(progressBarContainer)
                }
                if (!subscriber.closed) {
                    subscriber.error(error)
                }
            })
            return () => {
                clearTimeout(flipTimeout)
                if (videoContainer.parentNode) {
                    videoContainer.parentNode.removeChild(videoContainer)
                }
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