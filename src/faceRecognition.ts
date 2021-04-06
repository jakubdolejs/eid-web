import { Rect } from "./utils.js"

export class RecognizableFace {
    jpeg: string
    faceTemplate: string

    constructor(jpeg: string, faceTemplate: string) {
        this.jpeg = jpeg
        this.faceTemplate = faceTemplate
    }
}

export async function createRecognizableFace(image: any, faceRect?: Rect): Promise<RecognizableFace> {
    var jpeg: string
    if (image instanceof Image) {
        var canvas = document.createElement("canvas")
        if (faceRect) {
            faceRect.x = Math.max(faceRect.x - faceRect.width * 0.1, 0)
            faceRect.y = Math.max(faceRect.y - faceRect.height * 0.1, 0)
            faceRect.width *= 1.2
            faceRect.height *= 1.2
            if (faceRect.x + faceRect.width > image.width) {
                faceRect.width = image.width - faceRect.x
            }
            if (faceRect.y + faceRect.height > image.height) {
                faceRect.height = image.height - faceRect.y
            }
        } else {
            faceRect = new Rect(0, 0, image.width, image.height)
        }
        canvas.width = faceRect.width
        canvas.height = faceRect.height
        var ctx = canvas.getContext("2d")
        ctx.drawImage(image, 0-faceRect.x, 0-faceRect.y)
        jpeg = canvas.toDataURL("image/jpeg").replace(/^data:image\/jpeg;base64,/,"")
    } else if (typeof(image) == "string") {
        jpeg = image
    } else {
        throw new Error("Invalid image parameter")
    }
    var response = await fetch("/detectFace", {
        "method": "POST",
        "mode": "cors",
        "cache": "no-cache",
        "headers": {
            "Content-Type": "application/json"
        },
        "body": JSON.stringify({"image": jpeg})
    })
    var json = await response.json()
    return new RecognizableFace(json.jpeg, json.faceTemplate)
}

export async function compareFaceTemplates(template1: string, template2: string): Promise<number> {
    if (!template1 || !template2) {
        throw new Error("Missing face templates")
    }
    var response = await fetch("/compareFaces", {
        "method": "POST",
        "mode": "cors",
        "cache": "no-cache",
        "headers": {
            "Content-Type": "application/json"
        },
        "body": JSON.stringify([template1, template2])
    })
    var score = await response.text()
    return parseFloat(score)
}