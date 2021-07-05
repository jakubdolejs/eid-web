import { LivenessDetectionSessionSettings, FaceCapture } from "./faceDetection"
import { FaceAlignmentStatus } from "./types"
import { Rect } from "./utils"

/**
 * @category Face detection
 */
export interface LivenessDetectionSessionUI {
    readonly video: HTMLVideoElement
    trigger(event: LivenessDetectionSessionEvent): void
    on<Event extends LivenessDetectionSessionEvent>(eventType: LivenessDetectionSessionEventType, callback: (event: Event) => void): void
}

/**
 * @category Face detection
 */
export type LivenessDetectionSessionBaseEvent = {
    type: LivenessDetectionSessionEventType
}

/**
 * @category Face detection
 */
export enum LivenessDetectionSessionEventType {
    FACE_CAPTURED = "face captured",
    CAPTURE_FINISHED = "capture finished",
    CLOSE = "close",
    CANCEL = "cancel"
}

/**
 * @category Face detection
 */
export type LivenessDetectionSessionSimpleEvent = {
    type: LivenessDetectionSessionEventType.CLOSE | LivenessDetectionSessionEventType.CANCEL | LivenessDetectionSessionEventType.CAPTURE_FINISHED
} & LivenessDetectionSessionBaseEvent

/**
 * @category Face detection
 */
export type LivenessDetectionSessionFaceCapturedEvent = {
    type: LivenessDetectionSessionEventType.FACE_CAPTURED
    capture: FaceCapture
} & LivenessDetectionSessionBaseEvent

/**
 * @category Face detection
 */
export type LivenessDetectionSessionEvent = LivenessDetectionSessionFaceCapturedEvent | LivenessDetectionSessionSimpleEvent

/**
 * @category Face detection
 */
export class VerIDLivenessDetectionSessionUI implements LivenessDetectionSessionUI {
    
    private cameraOverlayCanvas: HTMLCanvasElement
    private cameraOverlayContext: CanvasRenderingContext2D
    private videoContainer: HTMLDivElement
    private cancelButton: HTMLAnchorElement
    private eventListeners: {[k in LivenessDetectionSessionEventType]?: (event: LivenessDetectionSessionEvent) => void} = {}
    private hasFaceBeenAligned = false
    private processingIndicator: HTMLDivElement
    readonly video: HTMLVideoElement
    readonly settings: LivenessDetectionSessionSettings

    constructor(settings: LivenessDetectionSessionSettings) {
        this.settings = settings

        this.cameraOverlayCanvas = document.createElement("canvas")
        this.cameraOverlayCanvas.style.position = "absolute"
        this.cameraOverlayCanvas.style.left = "0px"
        this.cameraOverlayCanvas.style.top = "0px"
        this.cameraOverlayContext = this.cameraOverlayCanvas.getContext("2d")

        this.videoContainer = document.createElement("div")
        this.videoContainer.style.position = "fixed"
        this.videoContainer.style.left = "0px"
        this.videoContainer.style.top = "0px"
        this.videoContainer.style.right = "0px"
        this.videoContainer.style.bottom = "0px"
        this.videoContainer.style.backgroundColor = "black"
        document.body.appendChild(this.videoContainer)

        this.video = document.createElement("video")
        this.video.setAttribute("autoplay", "autoplay")
        this.video.setAttribute("muted", "muted")
        this.video.setAttribute("playsinline", "playsinline")
        this.video.style.position = "absolute"
        this.video.style.left = "0px"
        this.video.style.top = "0px"
        this.video.style.right = "0px"
        this.video.style.bottom = "0px"
        this.video.style.width = "100%"
        this.video.style.height = "100%"
        if (settings.useFrontCamera) {
            this.video.style.transform = "scaleX(-1)"
        }

        this.cancelButton = document.createElement("a")
        this.cancelButton.href = "javascript:void(0)"
        this.cancelButton.innerText = "Cancel"
        this.cancelButton.style.textShadow = "0px 1px 5px rgba(0, 0, 0, 0.5)"
        this.cancelButton.style.fontFamily = "Helvetica, Arial, sans-serif"
        this.cancelButton.style.color = "white"
        this.cancelButton.style.textDecoration = "none"
        this.cancelButton.style.position = "absolute"
        this.cancelButton.style.bottom = " 16px"
        this.cancelButton.style.left = "8px"
        this.cancelButton.style.right = "8px"
        this.cancelButton.style.textAlign = "center"
        this.cancelButton.onclick = () => {
            this.trigger({"type": LivenessDetectionSessionEventType.CANCEL})
        }

        this.processingIndicator = document.createElement("div")
        this.processingIndicator.innerText = "Evaluating captured images"
        this.processingIndicator.style.fontFamily = "Helvetica, Arial, sans-serif"
        this.processingIndicator.style.color = "white"
        this.processingIndicator.style.position = "absolute"
        this.processingIndicator.style.display = "none"
        this.processingIndicator.style.alignItems = "center"
        this.processingIndicator.style.textAlign = "center"
        this.processingIndicator.style.height = "100%"
        this.processingIndicator.style.width = "200px"
        this.processingIndicator.style.margin = "0px auto"
        this.processingIndicator.style.left = "16px"
        this.processingIndicator.style.right = "16px"
        
        this.videoContainer.appendChild(this.video)
        this.videoContainer.appendChild(this.cameraOverlayCanvas)
        this.videoContainer.appendChild(this.processingIndicator)
        this.videoContainer.appendChild(this.cancelButton)
    }

    trigger(event: LivenessDetectionSessionEvent) {
        switch (event.type) {
            case LivenessDetectionSessionEventType.FACE_CAPTURED:
                this.drawDetectedFace(event.capture)
                break
            case LivenessDetectionSessionEventType.CLOSE:
                this.cleanup()
                break
            case LivenessDetectionSessionEventType.CANCEL:
                break
            case LivenessDetectionSessionEventType.CAPTURE_FINISHED:
                this.showCaptureFinished()
                break
        }
        if (this.eventListeners[event.type]) {
            this.eventListeners[event.type](event)
        }
    }

    on<Event extends LivenessDetectionSessionEvent>(eventType: LivenessDetectionSessionEventType, callback: (event: Event) => void) {
        if (callback) {
            this.eventListeners[eventType] = callback
        } else {
            delete this.eventListeners[eventType]
        }
    }

    private drawDetectedFace = (capture: FaceCapture): void => {
        const scale = Math.min(this.videoContainer.clientWidth / capture.image.width, this.videoContainer.clientHeight / capture.image.height)
        this.cameraOverlayCanvas.width = capture.image.width * scale
        this.cameraOverlayCanvas.height = capture.image.height * scale
        this.cameraOverlayCanvas.style.left = ((this.videoContainer.clientWidth - this.cameraOverlayCanvas.width) / 2)+"px"
        this.cameraOverlayCanvas.style.top = ((this.videoContainer.clientHeight - this.cameraOverlayCanvas.height) / 2)+"px"
        this.cameraOverlayContext.clearRect(0, 0, this.cameraOverlayCanvas.width, this.cameraOverlayCanvas.height)
        let ovalColor: string
        let textColor: string
        if (capture.faceAlignmentStatus == FaceAlignmentStatus.ALIGNED || capture.faceAlignmentStatus == FaceAlignmentStatus.FIXED) {
            this.hasFaceBeenAligned = true
            ovalColor = "green"
            textColor = "white"
        } else {
            ovalColor = "white"
            textColor = "black"
        }
        this.cameraOverlayContext.strokeStyle = ovalColor
        this.cameraOverlayContext.lineCap = "round"
        this.cameraOverlayContext.lineJoin = "round"
        let faceRect: Rect
        let cutoutRect: Rect
        if (capture.faceBounds) {
            cutoutRect = capture.faceBounds.scaledBy(scale)
            if (this.settings.useFrontCamera) {
                cutoutRect = cutoutRect.mirrored(capture.image.width * scale)
            }
            if (this.hasFaceBeenAligned) {
                faceRect = cutoutRect
            } else {
                faceRect = this.settings.expectedFaceRect({"width": this.cameraOverlayCanvas.width, "height": this.cameraOverlayCanvas.height})
            }
            if (capture.offsetAngleFromBearing) {
                const angle: number = Math.atan2(capture.offsetAngleFromBearing.pitch, capture.offsetAngleFromBearing.yaw)
                const distance: number = Math.hypot(capture.offsetAngleFromBearing.yaw, 0 - capture.offsetAngleFromBearing.pitch) * 2 * 1.7
                const arrowLength: number = faceRect.width / 5
                const arrowStemLength: number = Math.min(Math.max(arrowLength * distance, arrowLength * 0.75), arrowLength * 1.7)
                const arrowAngle: number = 40 * (Math.PI/180)
                const arrowTipX: number = faceRect.center.x + Math.cos(angle) * arrowLength / 2
                const arrowTipY: number = faceRect.center.y + Math.sin(angle) * arrowLength / 2
                const arrowPoint1X: number = arrowTipX + Math.cos(angle + Math.PI - arrowAngle) * arrowLength * 0.6
                const arrowPoint1Y: number = arrowTipY + Math.sin(angle + Math.PI - arrowAngle) * arrowLength * 0.6
                const arrowPoint2X: number = arrowTipX + Math.cos(angle + Math.PI + arrowAngle) * arrowLength * 0.6
                const arrowPoint2Y: number = arrowTipY + Math.sin(angle + Math.PI + arrowAngle) * arrowLength * 0.6
                const arrowStartX: number = arrowTipX + Math.cos(angle + Math.PI) * arrowStemLength
                const arrowStartY: number = arrowTipY + Math.sin(angle + Math.PI) * arrowStemLength

                this.cameraOverlayContext.lineWidth = 0.038 * faceRect.width
                this.cameraOverlayContext.beginPath()
                this.cameraOverlayContext.moveTo(arrowPoint1X, arrowPoint1Y)
                this.cameraOverlayContext.lineTo(arrowTipX, arrowTipY)
                this.cameraOverlayContext.lineTo(arrowPoint2X, arrowPoint2Y)
                this.cameraOverlayContext.moveTo(arrowTipX, arrowTipY)
                this.cameraOverlayContext.lineTo(arrowStartX, arrowStartY)
                this.cameraOverlayContext.stroke()
            }
        } else {
            faceRect = cutoutRect = this.settings.expectedFaceRect({"width": this.cameraOverlayCanvas.width, "height": this.cameraOverlayCanvas.height})
        }
        if (!this.hasFaceBeenAligned) {
            const cutoutPath = new Path2D()
            cutoutPath.rect(0, 0, this.cameraOverlayCanvas.width, this.cameraOverlayCanvas.height)
            cutoutPath.ellipse(cutoutRect.center.x, cutoutRect.center.y, cutoutRect.width / 2, cutoutRect.height / 2, 0, 0, Math.PI * 2, true)
            this.cameraOverlayContext.beginPath()
            this.cameraOverlayContext.fillStyle = "#00000099"
            this.cameraOverlayContext.fill(cutoutPath, "evenodd")
            this.cameraOverlayContext.fillStyle = "transparent"
        }
        this.cameraOverlayContext.lineWidth = 0.038 * faceRect.width
        this.cameraOverlayContext.beginPath()
        this.cameraOverlayContext.ellipse(faceRect.x + faceRect.width / 2, faceRect.y + faceRect.height / 2, faceRect.width /2, faceRect.height / 2, 0, 0, Math.PI * 2)
        this.cameraOverlayContext.stroke()
        
        let prompt: string
        switch (capture.faceAlignmentStatus) {
            case FaceAlignmentStatus.FIXED:
            case FaceAlignmentStatus.ALIGNED:
                prompt = "Great, hold it"
                break
            case FaceAlignmentStatus.MISALIGNED:
                prompt = "Slowly turn to follow the arrow"
                break
            default:
                prompt = "Align your face with the oval"
        }
        const textSize: number = 24
        const textY: number = Math.max(faceRect.y - this.cameraOverlayContext.lineWidth * 2, textSize)
        this.cameraOverlayContext.font = textSize+"px Helvetica, Arial, sans-serif"
        this.cameraOverlayContext.textAlign = "center"
        const textWidth: number = this.cameraOverlayContext.measureText(prompt).width
        const cornerRadius: number = 8
        const textRect: Rect = new Rect(
            this.cameraOverlayCanvas.width / 2 - textWidth / 2 - cornerRadius,
            textY - textSize,
            textWidth + cornerRadius * 2,
            textSize + cornerRadius
        )
        this.cameraOverlayContext.beginPath()
        this.cameraOverlayContext.moveTo(textRect.x + cornerRadius, textRect.y)
        this.cameraOverlayContext.lineTo(textRect.x + textRect.width - cornerRadius, textRect.y)
        this.cameraOverlayContext.quadraticCurveTo(textRect.x + textRect.width, textRect.y, textRect.x + textRect.width, textRect.y + cornerRadius)
        this.cameraOverlayContext.lineTo(textRect.x + textRect.width, textRect.y + textRect.height - cornerRadius)
        this.cameraOverlayContext.quadraticCurveTo(textRect.x + textRect.width, textRect.y + textRect.height, textRect.x + textRect.width - cornerRadius, textRect.y + textRect.height)
        this.cameraOverlayContext.lineTo(textRect.x + cornerRadius, textRect.y + textRect.height)
        this.cameraOverlayContext.quadraticCurveTo(textRect.x, textRect.y + textRect.height, textRect.x, textRect.y + textRect.height - cornerRadius)
        this.cameraOverlayContext.lineTo(textRect.x, textRect.y + cornerRadius)
        this.cameraOverlayContext.quadraticCurveTo(textRect.x, textRect.y, textRect.x + cornerRadius, textRect.y)
        this.cameraOverlayContext.closePath()
        this.cameraOverlayContext.fillStyle = ovalColor
        this.cameraOverlayContext.fill()
        this.cameraOverlayContext.fillStyle = textColor
        this.cameraOverlayContext.fillText(prompt, this.cameraOverlayCanvas.width / 2, textY)
    }

    private cleanup = () => {
        if (this.videoContainer.parentElement) {
            this.videoContainer.parentElement.removeChild(this.videoContainer)
        }
    }

    private showCaptureFinished = () => {
        this.video.style.display = "none"
        this.cameraOverlayCanvas.style.display = "none"
        this.processingIndicator.style.display = "flex"
    }
}