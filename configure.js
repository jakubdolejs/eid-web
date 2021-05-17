import inquirer from "inquirer";
import childProcess from "child_process";
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { Spinner } from "cli-spinner";
import aws from "aws-sdk"

const cliSpinner = new Spinner("")
const repo = "725614911995.dkr.ecr.us-east-1.amazonaws.com"
const identityApiImageName = "identity_api"
const detcvImageName = "restful-servers_detcv"
const recauthImageName = "restful-servers_recauth"
const idScannerImageName = "id_scanner"
const modelsVolumeName = "models"
const modelsImageName = "restful-servers_models"
let licenceModelFiles = null;

(async () => {
    const modelImageTags = await getModelImageTags()
    const awsProfiles = await getAWSProfiles()
    const answers = await inquirer.prompt(getQuestions(modelImageTags, awsProfiles))

    cliSpinner.start()
    cliSpinner.text = "Installing client dependencies"
    await runCommand("npm", path.resolve(process.cwd(), "client"), "install")

    cliSpinner.text = "Generating documentation"
    await runCommand("npx", path.resolve(process.cwd(), "client"), "typedoc", "--out", "../docs", "src/index.ts")

    cliSpinner.text = "Packaging client-side library"
    await runCommand("npx", path.resolve(process.cwd(), "client"), "webpack")

    cliSpinner.text = "Installing demo dependencies"
    await runCommand("npm", path.resolve(process.cwd(), "demo"), "install")

    cliSpinner.text = "Writing demo configuration file"
    await writeDemoConfigFile(answers)

    cliSpinner.text = "Compiling demo"
    await runCommand("npx", path.resolve(process.cwd(), "demo"), "tsc")

    const identityApiConfig = {
        "port": 8080,
        "enableHTMLOutput": true,
        "imagePreprocessing": {
            "enabled": false,
            "maxImageWidth": 3000
        },
        "faceDetection": {
            "serverURL": "http://detcv:8080",
            "faceQualityThreshold": 9,
            "authenticityScoreThreshold": 0.6,
            "modelsDir": "/models"
        },
        "faceRecognition": {
            "serverURL": "http://recauth:8080"
        }
    }
    
    const identityApiConfigFile = "./id_api_config.json"
    const compose = {
        "version": "3.3",
        "configs": {
            "id_api": {
                "file": identityApiConfigFile
            }
        },
        "services": {
            "identity_api": {
                "image": repo+"/"+identityApiImageName+":"+answers.identityApiVersion,
                "depends_on": [
                    "detcv", "recauth"
                ],
                "configs": [
                    {
                        "source": "id_api",
                        "target": "/config/identity_api.json"
                    }
                ],
                "ports": [
                    answers.port+":8080"
                ]
            },
            "detcv": {
                "image": repo+"/"+detcvImageName+":"+answers.restfulServersVersion,
                "environment": [
                    "PORT=8080"
                ]
            },
            "recauth": {
                "image": repo+"/"+recauthImageName+":"+answers.restfulServersVersion,
                "entrypoint": [
                    "./fb-recauth", "--foreground", "-p", "8080"
                ]
            }
        }
    }
    if (answers.exposeDetcvPort) {
        compose.services.detcv.ports = [
            answers.detcvPort+":8080"
        ]
    }
    if (answers.exposeRecauthPort) {
        compose.services.recauth.ports = [
            answers.recauthPort+":8080"
        ]
    }
    if (answers.enableIdCardDetection) {
        compose.services.id_scanner = {
            "image": repo+"/"+idScannerImageName+":"+answers.idScannerVersion,
            "environment": [
                "USER=microblink",
                "LICENSEE="+answers.mbLicensee,
                "LICENSE_KEY="+answers.mbLicenceKey,
                "PORT=8083",
                "PROXY_PORT=8080"
            ]
        }
        compose.services.identity_api.depends_on.push("id_scanner")
        identityApiConfig.idCapture = {"serverURL": "http://id_scanner:8080", "cropImage": false}
        if (answers.exposeIdScannerPort) {
            compose.services.id_scanner.ports = [
                answers.idScannerPort+":8080"
            ]
        }
    }
    const awsCredentials = getAWSCredentials(awsProfiles, answers)
    if (answers.loadModelsFromS3 && awsCredentials) {
        compose.services.detcv.environment.push(
            "S3_BUCKET="+answers.s3Bucket,
            "S3_FOLDER="+answers.s3Folder,
            "S3_REGION="+answers.s3Region,
            "AWS_ACCESS_KEY="+awsCredentials.accessKey,
            "AWS_SECRET_KEY="+awsCredentials.secretKey
        )
    }
    const licenceModelPrefixes = prefixesFromModelFileNames(licenceModelFiles)
    if (answers.loadModelsFromVolume) {
        compose.volumes = {            
        }
        compose.volumes[modelsVolumeName] = {}
        compose.services.models = {
            "image": repo+"/"+modelsImageName+":"+answers.modelsImageTag,
            "entrypoint": [
                "sleep", "infinity"
            ],
            "volumes": [
                modelsVolumeName+":/models"
            ]
        }
        compose.services.detcv.depends_on = ["models"]
        compose.services.detcv.volumes = [
            modelsVolumeName+":/models:ro"
        ]
    }
    if (licenceModelPrefixes.length > 0) {
        compose.services.detcv.environment.push("AUTHENTICITY_MODEL_PREFIXES="+Buffer.from(JSON.stringify(licenceModelPrefixes), "utf-8").toString("base64"))
        identityApiConfig.faceDetection.authenticityModelPrefixes = licenceModelPrefixes
        identityApiConfig.faceDetection.defaultAuthenticityModelPrefix = answers.defaultLicenceModel.substring(0, answers.defaultLicenceModel.indexOf("-"))
    }
    fs.writeFile(identityApiConfigFile, JSON.stringify(identityApiConfig), {"encoding": "utf-8"})
    const output = yaml.dump(compose)
    await fs.writeFile("docker-compose.yml", output)

    if (answers.launchContainers) {
        cliSpinner.text = "Launching containers"
        try {
            await runCommand("docker", process.cwd(), "swarm", "init")
        } catch (error) {

        }
        await runCommand("docker", process.cwd(), "stack", "up", "-c", "docker-compose.yml", "ver-id-browser")
    }
})().catch(error => {
    console.error(error)
}).finally(() => {
    cliSpinner.stop(true)
})

function getQuestions(modelImageTags, awsProfiles) {
    return [
        {
            "type": "input",
            "name": "identityApiVersion",
            "message": "Identity API version",
            "default": "1.9.0"
        },{
            "type": "number",
            "name": "port",
            "message": "Identity API container port",
            "default": 8080
        },{
            "type": "input",
            "name": "restfulServersVersion",
            "message": "RESTful servers version",
            "default": "1.3.6"
        },{
            "type": "confirm",
            "name": "exposeDetcvPort",
            "message": "Expose Detcv container port?",
            "default": false
        },{
            "type": "number",
            "name": "detcvPort",
            "message": "Detcv container port",
            "default": 8084,
            "when": (ans) => ans.exposeDetcvPort,
            "validate": (input, ans) => {
                if (ans.exposeDetcvPort && input == ans.port) {
                    return "Detcv container port must differ from Server port"
                }
                return true
            }
        },{
            "type": "confirm",
            "name": "exposeRecauthPort",
            "message": "Expose Recauth container port?",
            "default": false
        },{
            "type": "number",
            "name": "recauthPort",
            "message": "Recauth container port",
            "default": 8083,
            "when": (ans) => ans.exposeRecauthPort,
            "validate": (input, ans) => {
                if ((ans.exposeDetcvPort && ans.detcvPort == input) || input == ans.port) {
                    return "Recauth container port must differ from Detcv and Server ports"
                }
                return true
            }
        },{
            "type": "input",
            "name": "mbBrowserLicenceKey",
            "message": "Microblink licence key (in-browser SDK)",
            "default": process.env.MB_BROWSER_LICENCE_KEY
        },{
            "type": "confirm",
            "name": "enableIdCardDetection",
            "message": "Enable server-side ID card detection?",
            "default": false
        },{
            "type": "input",
            "name": "idScannerVersion",
            "message": "ID scanner image version",
            "default": "1.34.0",
            "when": (ans) => ans.enableIdCardDetection
        },{
            "type": "input",
            "name": "mbLicensee",
            "message": "Microblink licensee (self-hosted SDK)",
            "default": process.env.MB_DOCKER_LICENSEE,
            "when": (ans) => ans.enableIdCardDetection
        },{
            "type": "input",
            "name": "mbLicenceKey",
            "message": "Microblink licence key (self-hosted SDK)",
            "default": process.env.MB_DOCKER_LICENCE_KEY,
            "when": (ans) => ans.enableIdCardDetection
        },{
            "type": "confirm",
            "name": "exposeIdScannerPort",
            "message": "Expose ID scanner container port?",
            "default": false,
            "when": (ans) => ans.enableIdCardDetection
        },{
            "type": "number",
            "name": "idScannerPort",
            "message": "ID scanner container port",
            "default": 8085,
            "when": (ans) => ans.enableIdCardDetection && ans.exposeIdScannerPort,
            "validate": (input, ans) => {
                if ((ans.exposeDetcvPort && ans.detcvPort == input) || (ans.exposeRecauthPort && ans.recauthPort == input) || input == ans.port) {
                    return "ID scanner container port must differ from other exposed ports"
                }
                return true
            }
        },{
            "type": "confirm",
            "name": "loadModelsFromVolume",
            "message": "Load model files from a models container?",
            "default": false,
            "when": () => modelImageTags.length > 0
        },{
            "type": "list",
            "name": "modelsImageTag",
            "message": "Models image tag",
            "choices": modelImageTags,
            "when": (ans) => modelImageTags.length > 0 && ans.loadModelsFromVolume
        },{
            "type": "confirm",
            "name": "loadModelsFromS3",
            "message": "Load model files from an AWS S3 bucket?",
            "default": true,
            "when": (ans) => modelImageTags.length == 0 || !ans.loadModelsFromVolume
        },{
            "type": "input",
            "name": "s3Bucket",
            "message": "S3 bucket name",
            "default": "ver-id-models",
            "when": (ans) => ans.loadModelsFromS3
        },{
            "type": "input",
            "name": "s3Folder",
            "message": "S3 folder",
            "default": "0001",
            "when": (ans) => ans.loadModelsFromS3
        },{
            "type": "input",
            "name": "s3Region",
            "message": "S3 region",
            "default": "us-east-1",
            "when": (ans) => ans.loadModelsFromS3
        },{
            "type": "list",
            "name": "awsProfile",
            "message": "AWS profile to use to connect to S3",
            "choices": () => {
                return Object.keys(awsProfiles)
            },
            "when": (ans) => {
                return Object.keys(awsProfiles).length > 1 && ans.loadModelsFromS3
            }
        },{
            "type": "list",
            "name": "defaultLicenceModel",
            "message": "Default licence model",
            "when": async (ans) => {
                return (await getLicenceModelFiles(ans, awsProfiles)).length > 0
            },
            "choices": async (ans) => {
                return await getLicenceModelFiles(ans, awsProfiles)
            }
        },{
            "type": "input",
            "name": "serverHost",
            "message": "Server host name",
            "transformer": (input, ans) => {
                return input.replace(/^https*\:\/\//, "")
            },
            "default": ""
        },{
            "type": "confirm",
            "name": "launchContainers",
            "message": "Launch containers in a stack?",
            "default": true
        }
    ]
}

function runCommand(cmd, cwd, ...args) {
    return new Promise((resolve, reject) => {
        const proc = childProcess.spawn(cmd, args, {"cwd":cwd})
        let out = ""
        let err = ""
        proc.stdout.on("data", (data) => {
            const msg = data.toString("utf-8")
            out += msg
        })
        proc.stderr.on("data", (data) => {
            err += data.toString("utf-8")
        })
        proc.on("close", (code) => {
            if (code > 0) {
                if (err.length > 0) {
                    console.error(err)
                }
                reject("Process exited with code "+code)
            } else {
                process.stdout.write("\n")
                resolve(out)
            }
        })
    })
}

async function getModelImageTags() {
    const modelImageLines = (await runCommand("docker", process.cwd(), "images", repo+"/"+modelsImageName)).split(/[\n\r]+/)
    const tagIndex = modelImageLines.shift().split(/\s+/).indexOf("TAG")
    return modelImageLines.filter(val => {
        return val.trim().length > 0
    }).map(val => {
        return val.split(/\s+/)[tagIndex]
    })
}

async function getLicenceModelFiles(ans, awsProfiles) {
    if (licenceModelFiles != null) {
        return licenceModelFiles
    }
    if (ans.loadModelsFromVolume) {
        licenceModelFiles = (await runCommand("docker", process.cwd(), "run", "--rm", "--entrypoint", "ls", repo+"/"+modelsImageName+":"+ans.modelsImageTag)).split(/[\n\r]+/).filter(file => file.startsWith("license"))
    } else if (ans.loadModelsFromS3) {
        let accessKey, secretKey
        if (Object.keys(awsProfiles).length > 1) {
            accessKey = awsProfiles[ans.awsProfile].accessKey
            secretKey = awsProfiles[ans.awsProfile].secretKey
        } else if (Object.keys(awsProfiles).length > 0) {
            accessKey = Object.values(awsProfiles)[0].accessKey
            secretKey = Object.values(awsProfiles)[0].secretKey
        } else {
            accessKey = null
            secretKey = null
        }
        licenceModelFiles = await getLicenceModelFilesFromS3(ans.s3Bucket, ans.s3Folder, ans.s3Region, accessKey, secretKey)
    } else {
        licenceModelFiles = (await runCommand("docker", process.cwd(), "run", "--rm", "--entrypoint", "ls", repo+"/"+detcvImageName+":"+ans.restfulServersVersion, "/models")).split(/[\n\r]+/).filter(file => file.startsWith("license"))
    }
    return licenceModelFiles
}

const copyDirectory = async (src, dest) => {
    await fs.mkdir(dest, {"recursive": true})
    const files = await fs.readdir(src, {"withFileTypes": true})
    for (let file of files) {
        if (file.isDirectory()) {
            await copyDirectory(path.join(src, file.name), path.join(dest, file.name))
        } else {
            await fs.copyFile(path.join(src, file.name), path.join(dest, file.name))
        }
    }
}

const listObjects = (s3, params) => {
    return new Promise((resolve, reject) => {
        s3.listObjects(params, (error, data) => {
            if (error) {
                return reject(error)
            }
            return resolve(data)
        })
    })
}

async function writeDemoConfigFile(answers) {
    const config = {
        "serverURL": "https://"+answers.serverHost,
        "licenceKey": answers.mbBrowserLicenceKey
    }
    await fs.writeFile("demo/config.json", JSON.stringify(config), {"encoding":"utf-8"})
}

function getAWSCredentials(awsProfiles, answers) {
    if (answers.loadModelsFromS3 && answers.awsProfile && awsProfiles && awsProfiles[answers.awsProfile]) {
        return awsProfiles[answers.awsProfile]
    } else if (answers.loadModelsFromS3 && Object.keys(awsProfiles).length > 0) {
        return Object.values(awsProfiles)[0]
    } else {
        return null
    }
}

async function getLicenceModelFilesFromS3(bucket, folder, region, accessKey, secretKey) {
    const awsConfigFile = "./awsConfig.json"
    try {
        const s3Credentials = {
            "accessKeyId": accessKey, 
            "secretAccessKey": secretKey, 
            "region": region || "us-east-1"
        }
        await fs.writeFile(awsConfigFile, JSON.stringify(s3Credentials))
        aws.config.loadFromPath(awsConfigFile)
        const s3 = new aws.S3()
        const listObjectsParams = {
            "Bucket": bucket
        }
        if (folder) {
            listObjectsParams.Prefix = folder.trim().replace(/^\/+/, "").replace(/\/+$/, "")+"/"
        }
        const response = await listObjects(s3, listObjectsParams)
        const files = []
        for (let blob of response.Contents) {
            const key = blob.Key
            if (key == listObjectsParams.Prefix) {
                continue
            }
            let fileName = key
            if (listObjectsParams.Prefix) {
                fileName = key.substring(listObjectsParams.Prefix.length)
            }
            if (fileName.startsWith("license") || fileName.startsWith("licence")) {
                files.push(fileName)
            }
        }
        return files
    } finally {
        try {
            fs.rm(awsConfigFile, {"force": true})
        } catch (error) {
        }
    }
}

async function getAWSProfiles() {
    try {
        let awsCredentials = await fs.readFile(process.env.HOME+"/.aws/credentials", "utf-8")
        const lines = awsCredentials.split(/[\n\r]+/)
        const profiles = {}
        for (let i=0; i<lines.length; i++) {
            if (lines[i].startsWith("[")) {
                const profileName = lines[i].substring(1,lines[i].length-1)
                if (lines.length > i+2) {
                    profiles[profileName] = {
                        "accessKey": lines[i+1].split(/\s+=\s+/)[1],
                        "secretKey": lines[i+2].split(/\s+=\s+/)[1]
                    }
                }
            }
        }
        return profiles
    } catch (error) {
    }
}

function prefixesFromModelFileNames(names) {
    return names.map(name => name.substring(0, name.indexOf("-")))
}