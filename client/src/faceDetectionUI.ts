import { FaceCaptureSettings, LiveFaceCapture } from "./faceDetection"
import { FaceAlignmentStatus } from "./types"
import { Rect } from "./utils"

export interface FaceCaptureUI {
    readonly video: HTMLVideoElement
    trigger(event: FaceCaptureEvent): void
    on<Event extends FaceCaptureEvent>(eventType: FaceCaptureEventType, callback: (event: Event) => void): void
}

export type FaceCaptureBaseEvent = {
    type: FaceCaptureEventType
}

export enum FaceCaptureEventType {
    FACE_CAPTURED = "face captured",
    CLOSE = "close",
    CANCEL = "cancel",
    MEDIA_STREAM_AVAILABLE = "media stream available"
}

export type FaceCaptureSimpleEvent = {
    type: FaceCaptureEventType.CLOSE | FaceCaptureEventType.CANCEL
} & FaceCaptureBaseEvent

export type FaceCaptureFaceCapturedEvent = {
    type: FaceCaptureEventType.FACE_CAPTURED
    capture: LiveFaceCapture
} & FaceCaptureBaseEvent

export type FaceCaptureMediaStreamAvailableEvent = {
    type: FaceCaptureEventType.MEDIA_STREAM_AVAILABLE
    stream: MediaStream
} & FaceCaptureBaseEvent

export type FaceCaptureEvent = FaceCaptureFaceCapturedEvent | FaceCaptureMediaStreamAvailableEvent | FaceCaptureSimpleEvent

export class VerIDFaceCaptureUI implements FaceCaptureUI {
    
    private cameraOverlayCanvas: HTMLCanvasElement
    private cameraOverlayContext: CanvasRenderingContext2D
    private videoContainer: HTMLDivElement
    private cancelButton: HTMLAnchorElement
    private eventListeners: {[k in FaceCaptureEventType]?: (event: FaceCaptureEvent) => void} = {}
    private hasFaceBeenAligned = false
    readonly video: HTMLVideoElement
    readonly settings: FaceCaptureSettings

    constructor(settings: FaceCaptureSettings) {
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
            this.trigger({"type": FaceCaptureEventType.CANCEL})
        }
        
        this.videoContainer.appendChild(this.video)
        this.videoContainer.appendChild(this.cameraOverlayCanvas)
        this.videoContainer.appendChild(this.cancelButton)
    }

    trigger(event: FaceCaptureEvent) {
        switch (event.type) {
            case FaceCaptureEventType.MEDIA_STREAM_AVAILABLE:
                this.setVideoStream(event.stream)
                break
            case FaceCaptureEventType.FACE_CAPTURED:
                this.drawDetectedFace(event.capture)
                break
            case FaceCaptureEventType.CLOSE:
                this.cleanup()
                break
            case FaceCaptureEventType.CANCEL:
                break
        }
        if (this.eventListeners[event.type]) {
            this.eventListeners[event.type](event)
        }
    }

    on<Event extends FaceCaptureEvent>(eventType: FaceCaptureEventType, callback: (event: Event) => void) {
        if (callback) {
            this.eventListeners[eventType] = callback
        } else {
            delete this.eventListeners[eventType]
        }
    }

    private setVideoStream(stream: MediaStream) {
        if ("srcObject" in this.video) {
            this.video.srcObject = stream;
        } else {
            // @ts-ignore
            this.video.src = URL.createObjectURL(stream);
        }
    }

    private drawDetectedFace = (capture: LiveFaceCapture): void => {
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
}