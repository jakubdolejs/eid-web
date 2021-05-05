var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from "express";
import axios from "axios";
import path from "path";
import multer from "multer";
import fs from "fs";
import jimp from "jimp";
import imageSize from "image-size";
import "markdown-it";
import { RecognizerType, WaitOptions } from "./types.js";
const detcvURL = process.env.DETCV_URL;
const idScannerURL = process.env.ID_SCANNER_URL;
const recauthURL = process.env.RECAUTH_URL;
const mbLicenceKey = process.env.MB_LICENCE_KEY;
const disableDemo = process.env.DISABLE_DEMO == "true" || process.env.DISABLE_DEMO == "1" ? true : false;
const authenticityModelPrefixes = process.env.AUTHENTICITY_MODEL_PREFIXES ? JSON.parse(Buffer.from(process.env.AUTHENTICITY_MODEL_PREFIXES, "base64").toString("utf-8")) : [];
if (!detcvURL) {
    console.error("Missing environment variable DETCV_URL");
    process.exit(1);
}
if (!recauthURL) {
    console.error("Missing environment variable RECAUTH_URL");
    process.exit(1);
}
if (!idScannerURL) {
    console.log("ID scanner is disabled");
}
if (authenticityModelPrefixes.length == 0) {
    console.log("Authenticity score prefixes not specified – authenticity check will be disabled");
}
if (disableDemo) {
    console.log("Demo is disabled");
}
const getVersion = () => __awaiter(this, void 0, void 0, function* () {
    const packageJson = JSON.parse(yield fs.promises.readFile("package.json", { "encoding": "utf-8" }));
    return packageJson.version;
});
const app = express();
app.set("views", path.resolve("views"));
app.set("view engine", "pug");
app.use(express.static("static"));
app.use(express.static("node_modules"));
app.use("/docs", express.static("docs"));
/**
 * Print information about the API
 */
app.get("/", (req, res, next) => {
    try {
        if (req.accepts("application/json")) {
            getVersion().then(version => {
                res.type("application/json").send({
                    "version": version
                });
            }).catch(error => {
                res.status(500).type("text/plain").send("Failed to get API version");
            });
        }
        else if (req.accepts("text/html")) {
            res.render("readme.pug");
        }
        else {
            res.status(406).type("text/plain").send("Not acceptable");
        }
    }
    catch (error) {
        next(error);
    }
});
/**
 * Print health status of the API
 */
app.get("/healthz", (req, res) => {
    if (req.accepts("text/plain")) {
        res.type("text/plain").status(200).send("healthy");
    }
    else {
        res.sendStatus(406);
    }
});
/**
 * Demo page featuring ID capture, live face capture and face comparison
 */
app.get("/demo", (req, res) => {
    if (disableDemo) {
        res.status(405).type("text/plain").send("Demo is disabled on this server");
    }
    else {
        res.render("demo.pug", { "licenceKey": mbLicenceKey });
    }
});
/**
 * Detect a face in an image
 */
app.post("/detectFace", imagesFromRequest(["image"]), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const face = yield detectFace(res.locals.images["image"], req.body && req.body.calculate_authenticity_score && authenticityModelPrefixes.length > 0 ? authenticityModelPrefixes.map(prefix => {
            return { "prefix": prefix, "threshold": 5 };
        }) : null);
        const imgSize = imageSize(res.locals.images["image"]);
        if (face) {
            const croppedJimpImage = yield jimp.read(res.locals.images["image"]);
            const cropRect = {
                "x": Math.max(face.box[0] - face.box[2] / 2, 0),
                "y": Math.max(face.box[1] - face.box[3] / 2, 0),
                "width": face.box[2],
                "height": face.box[3]
            };
            cropRect.width = Math.min(imgSize.width - cropRect.x, cropRect.width);
            cropRect.height = Math.min(imgSize.height - cropRect.y, cropRect.height);
            const croppedImage = (yield croppedJimpImage.crop(cropRect.x, cropRect.y, cropRect.width, cropRect.height).getBufferAsync(jimp.MIME_JPEG)).toString("base64");
            const response = {
                "jpeg": croppedImage,
                "faceTemplate": face.template
            };
            if (face.classifiers) {
                response.authenticityScores = face.classifiers;
            }
            res.type("application/json");
            res.set("Access-Control-Allow-Origin", "*");
            res.send(response);
        }
        else {
            res.sendStatus(404);
        }
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Detect an ID card in an image
 */
app.post("/detectIdCard", imagesFromRequest(["front", "back"]), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    if (!idScannerURL) {
        res.status(405).type("text/plain").send("ID card detection is not available on this server");
        return;
    }
    try {
        if (res.locals.images) {
            const promises = [];
            if (res.locals.images.front) {
                promises.push(detectIdCard(res.locals.images.front, RecognizerType.BlinkId));
            }
            if (res.locals.images.back) {
                promises.push(detectIdCard(res.locals.images.back, RecognizerType.Usdl));
            }
            if (promises.length > 0) {
                const results = yield Promise.all(promises);
                res.type("application/json");
                res.set("Access-Control-Allow-Origin", "*");
                res.send(results);
                return;
            }
        }
        res.status(400).type("text/plain").send("Bad request");
    }
    catch (error) {
        res.status(500).type("text/plain").send("Server error");
    }
}));
/**
 * Compare faces
 */
app.post("/compareFaces", express.json(), (req, res, next) => __awaiter(this, void 0, void 0, function* () {
    try {
        const url = recauthURL + "/compare_face";
        if (!req.body || req.body.length != 2) {
            res.status(400);
            throw new Error("Invalid request");
        }
        const body = {
            "target": req.body[0],
            "faces": [req.body[1]]
        };
        const result = yield axios.post(url, body, { "headers": { "Content-Type": "application/json" }, "maxContentLength": Infinity, "maxBodyLength": Infinity });
        if (result.status != 200) {
            throw new Error(result.statusText);
        }
        res.set("Access-Control-Allow-Origin", "*");
        if (req.accepts("application/json")) {
            res.type("application/json").send({ "score": result.data.score });
        }
        else if (req.accepts("text/plain")) {
            res.type("text/plain").send(String(result.data.score));
        }
        else {
            res.status(406).type("text/plain").send("Not acceptable");
        }
    }
    catch (error) {
        next(error);
    }
}));
/**
 * Error handling
 */
app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }
    if (!res.statusCode || res.statusCode == 200) {
        res.status(500);
    }
    res.type("text/plain").send("Error" + (typeof (error) == "string" ? ": " + error : (error && error.message ? ": " + error.message : "")));
});
function detectFace(image, classifiers) {
    return __awaiter(this, void 0, void 0, function* () {
        const url = detcvURL + "/queue_image";
        const body = {
            "user": "test123456",
            "image": image.toString("base64"),
            "wait": WaitOptions.One
        };
        if (classifiers) {
            body.parameters = {
                "classifiers": classifiers.map(classifier => [classifier.prefix, classifier.threshold])
            };
        }
        const result = yield axios.post(url, body, { "headers": { "Content-Type": "application/json" }, "maxContentLength": Infinity, "maxBodyLength": Infinity });
        if (result.status == 200 && result.data && result.data.status == "done" && result.data.faces && result.data.faces.length > 0) {
            const faces = result.data.faces.filter((f) => {
                return f.hasOwnProperty("box");
            });
            if (faces.length > 0) {
                const face = faces.reduce((previous, current) => {
                    if (previous.box[2] * previous.box[3] * previous.quality > current.box[2] * current.box[3] * current.quality) {
                        return previous;
                    }
                    else {
                        return current;
                    }
                });
                return face;
            }
        }
        return null;
    });
}
function detectIdCard(image, recognizer) {
    return __awaiter(this, void 0, void 0, function* () {
        const originalImageSize = imageSize(image);
        const maxImageWidth = 2000;
        if (originalImageSize.width > maxImageWidth) {
            const jimpImage = yield jimp.read(image);
            jimpImage.resize(maxImageWidth, jimp.AUTO, jimp.RESIZE_BICUBIC);
            image = yield jimpImage.getBufferAsync(jimp.MIME_JPEG);
        }
        const url = idScannerURL + "/recognize/execute";
        const result = yield axios.post(url, {
            "imageBase64": image.toString("base64"),
            "recognizerType": recognizer,
            "exportFullDocumentImage": recognizer == RecognizerType.BlinkId
        }, {
            "maxContentLength": Infinity,
            "maxBodyLength": Infinity
        });
        if (result && result.data && result.data.data && result.data.data.result) {
            return result.data.data.result;
        }
        throw new Error("Failed to detect ID card in image");
    });
}
function imageFilter(req, file, cb) {
    cb(null, ["image/jpeg", "image/png"].indexOf(file.mimetype.toLowerCase()) > -1);
}
function imagesFromRequest(fieldNames) {
    return function (req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                multer({ "fileFilter": imageFilter }).fields(fieldNames.map(name => {
                    return { "name": name, "maxCount": 1 };
                }))(req, res, () => __awaiter(this, void 0, void 0, function* () {
                    express.json({ "limit": "20MB" })(req, res, () => {
                        const images = {};
                        fieldNames.forEach((fieldName) => __awaiter(this, void 0, void 0, function* () {
                            if (req.files && req.files[fieldName] && req.files[fieldName].buffer) {
                                images[fieldName] = req.files[fieldName].buffer;
                            }
                            else if (req.files && req.files[fieldName] && req.files[fieldName].path) {
                                const image = yield fs.promises.readFile(req.files[fieldName].path);
                                images[fieldName] = image;
                            }
                            else if (req.body && req.body[fieldName]) {
                                images[fieldName] = Buffer.from(req.body[fieldName], "base64");
                            }
                        }));
                        if (Object.keys(images).length > 0) {
                            res.locals.images = images;
                            next();
                        }
                        else {
                            const error = new Error("Failed to extract images from request");
                            console.error(error);
                            next(error);
                        }
                    });
                }));
            }
            catch (error) {
                console.error(error);
                next(error);
            }
        });
    };
}
const port = process.env.PORT ? parseInt(process.env.PORT) : 4445;
if (isNaN(port)) {
    console.error("Invalid port number: " + process.env.PORT);
    process.exit(1);
}
app.listen(port, () => {
    console.log("Application listening on port " + port);
});
//# sourceMappingURL=index.js.map