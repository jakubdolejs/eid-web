const express = require("express")
const axios = require("axios")
const path = require("path")
const multer = require("multer")
const fs = require("fs")
const util = require("util")
const jimp = require("jimp")
const bodyParser = require("body-parser")
const imageSize = require("image-size")
require("markdown-it")

const detcvURL = process.env.DETCV_URL
const idScannerURL = process.env.ID_SCANNER_URL
const recauthURL = process.env.RECAUTH_URL
if (!detcvURL) {
    console.error("Missing environment variable DETCV_URL")
    process.exit(1)
}
if (!idScannerURL) {
    console.error("Missing environment variable ID_SCANNER_URL")
    process.exit(1)
}
if (!recauthURL) {
    console.error("Missing environment variable RECAUTH_URL")
    process.exit(1)
}

const app = express()
app.set("views", path.join(__dirname, "views"))
app.set("view engine", "pug")
app.use(express.static("static"))
app.use(express.static("node_modules"))
app.use("/docs", express.static("docs"))
app.use("/src", express.static("src"))

async function detectFace(image) {
    let url = detcvURL+"/queue_image"
    let body = {"user":"test123456","image":image.toString("base64"),"wait":"one"}
    let result = await axios.post(url, body, {"headers": {"Content-Type": "application/json"},"maxContentLength":Infinity,"maxBodyLength":Infinity})
    if (result.status == 200 && result.data && result.data.status == "done" && result.data.faces && result.data.faces.length > 0) {
        let faces = result.data.faces.filter(f => {
            return f.hasOwnProperty("box")
        })
        if (faces.length > 0) {
            let face = faces.reduce((previous, current) => {
                if (previous.box[2] * previous.box[3] > current.box[2] * current.box[3]) {
                    return previous
                } else {
                    return current
                }
            })
            return face
        }
    }
    return null
 }

async function detectIdCard(image, recognizer) {
    let originalImageSize = imageSize(image)
    let maxImageWidth = 2000
    if (originalImageSize.width > maxImageWidth) {
        let jimpImage = await jimp.read(image)
        jimpImage.resize(maxImageWidth, jimp.AUTO, jimp.RESIZE_BICUBIC)
        image = await jimpImage.getBufferAsync(jimp.MIME_JPEG)
    }
    let url = idScannerURL+"/recognize/execute"
    let result = await axios.post(url, {
        "imageBase64": image.toString("base64"),
        "recognizerType": recognizer,
        "exportFullDocumentImage": recognizer == "BLINK_ID"
    }, {
        "maxContentLength":Infinity,
        "maxBodyLength":Infinity
    })
    if (result && result.data && result.data.data && result.data.data.result) {
        return result.data.data.result
    }
    throw new Error("Failed to detect ID card in image")
}

app.get("/", (req, res, next) => {
    try {
        res.render("readme.pug")
    } catch (error) {
        next(error)
    }
})

app.get("/demo", (req, res) => {
    res.render("demo.pug")
})

function imageFilter(req, file, cb) {
    cb(null, ["image/jpeg", "image/png"].indexOf(file.mimetype.toLowerCase()) > -1)
}

function imagesFromRequest(fieldNames) {
    return async function (req, res, next) {
        try {
            multer({"fileFilter": imageFilter}).fields(fieldNames.map(name => {
                return {"name": name, "maxCount":1}
            }))(req, res, async () => {
                bodyParser.json({"limit":"20MB"})(req, res, () => {
                    var images = {}
                    let readFile = util.promisify(fs.readFile)
                    fieldNames.forEach(async fieldName => {
                        if (req.files && req.files[fieldName] && req.files[fieldName].buffer) {
                            images[fieldName] = req.files[fieldName].buffer
                        } else if (req.files && req.files[fieldName] && req.files[fieldName].path) {
                            let image = await readFile(req.files[fieldName].path)
                            images[fieldName] = image
                        } else if (req.body && req.body[fieldName]) {
                            images[fieldName] = Buffer.from(req.body[fieldName], "base64")
                        }
                    });
                    if (Object.keys(images).length > 0) {
                        res.locals.images = images
                        next()
                    } else {
                        let error = new Error("Failed to extract images from request")
                        console.error(error)
                        next(error)
                    }
                })
            })            
        } catch (error) {
            console.error(error)
            next(error)
        }
    }
}

app.post("/detectFace", imagesFromRequest(["image"]), async (req, res, next) => {
    try {
        let face = await detectFace(res.locals.images["image"])
        let imgSize = imageSize(res.locals.images["image"])
        if (face) {
            let croppedImage = await jimp.read(res.locals.images["image"])
            let cropRect = {
                "x": Math.max(face.box[0]-face.box[2]/2, 0),
                "y": Math.max(face.box[1]-face.box[3]/2, 0),
                "width": face.box[2],
                "height": face.box[3]
            }
            cropRect.width = Math.min(imgSize.width - cropRect.x, cropRect.width)
            cropRect.height = Math.min(imgSize.height - cropRect.y, cropRect.height)
            croppedImage = (await croppedImage.crop(cropRect.x, cropRect.y, cropRect.width, cropRect.height).getBufferAsync(jimp.MIME_JPEG)).toString("base64")
            var response = {
                "jpeg": croppedImage,
                "faceTemplate": face.template
            }
            res.type("application/json")
            res.send(response)
        } else {
            res.sendStatus(404)
        }
    } catch (error) {
        next(error)
    }
})

app.post("/detectIdCard", imagesFromRequest(["front","back"]), async (req, res, next) => {
    try {
        if (res.locals.images) {
            var promises = []
            if (res.locals.images.front) {
                promises.push(detectIdCard(res.locals.images.front, "BLINK_ID"))
            }
            if (res.locals.images.back) {
                promises.push(detectIdCard(res.locals.images.back, "USDL"))
            }
            if (promises.length > 0) {
                let results = await Promise.all(promises)
                res.type("application/json")
                res.send(results)
                return
            }
        }
        res.sendStatus(400)
    } catch (error) {
        res.sendStatus(500)
    }
})

app.post("/compareFaces", bodyParser.json(), async (req, res, next) => {
    try {
        let url = recauthURL+"/compare_face"
        if (!req.body || req.body.length != 2) {
            res.status(400)
            next(new Error("Invalid request"))
        }
        let body = {
            "target": req.body[0],
            "faces": [req.body[1]]
        }
        let result = await axios.post(url, body, {"headers": {"Content-Type": "application/json"},"maxContentLength":Infinity,"maxBodyLength":Infinity})
        res.type("text/plain")
        res.send(""+result.data.score)
    } catch (error) {
        next(error)
    }
})

const port = process.env.PORT || 4445
app.listen(port, () => {
    console.log("Application listening on port "+port)
})