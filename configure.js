import inquirer from "inquirer";
import childProcess from "child_process";
import fs from "fs/promises";
import path from "path";
import yaml from "js-yaml";
import { Spinner } from "cli-spinner";

const cliSpinner = new Spinner("")

const runCommand = (cmd, cwd, ...args) => {
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

(async () => {
    const browserImageName = "ver-id-browser"
    const apiVersionJson = await fs.readFile("server/package.json", {"encoding": "utf-8"})
    const apiVersion = JSON.parse(apiVersionJson).version
    const repo = "725614911995.dkr.ecr.us-east-1.amazonaws.com"
    const detcvImageName = "restful-servers_detcv"
    const recauthImageName = "restful-servers_recauth"
    const idScannerImageName = "id_scanner"
    const modelsVolumeName = "models"
    const modelsImageName = "restful-servers_models"
    const modelImageLines = (await runCommand("docker", process.cwd(), "images", repo+"/"+modelsImageName)).split(/[\n\r]+/)
    const tagIndex = modelImageLines.shift().split(/\s+/).indexOf("TAG")
    const modelImageTags = modelImageLines.filter(val => {
        return val.trim().length > 0
    }).map(val => {
        return val.split(/\s+/)[tagIndex]
    })

    const answers = await inquirer.prompt([
        {
            "type": "number",
            "name": "port",
            "message": "Server port",
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
            "default": true,
            "when": () => modelImageTags.length > 0
        },{
            "type": "list",
            "name": "modelsImageTag",
            "message": "Models image tag",
            "choices": modelImageTags,
            "when": (ans) => modelImageTags.length > 0 && ans.loadModelsFromVolume
        },{
            "type": "confirm",
            "name": "launchContainers",
            "message": "Launch containers in a stack?",
            "default": true
        }
    ])

    cliSpinner.text = "Generating documentation"
    cliSpinner.start()
    await runCommand("typedoc", path.resolve(process.cwd(), "client"), "--out", "../server/docs", "src/index.ts")
    cliSpinner.stop(true)

    cliSpinner.text = "Packaging client-side library"
    cliSpinner.start()
    await runCommand("npx", path.resolve(process.cwd(), "client"), "webpack")
    cliSpinner.stop(true)

    cliSpinner.text = "Copying client-side library"
    cliSpinner.start()
    await copyDirectory("client/dist", "server/ver-id-browser")
    cliSpinner.stop(true)

    cliSpinner.text = "Compiling server"
    cliSpinner.start()
    await runCommand("tsc", path.resolve(process.cwd(), "server/src/server"))
    cliSpinner.stop(true)

    cliSpinner.text = "Compiling demo script"
    cliSpinner.start()
    await runCommand("tsc", path.resolve(process.cwd(), "server/src/demo"))
    cliSpinner.stop(true)

    cliSpinner.text = "Building "+browserImageName+":"+apiVersion+" Docker image"
    cliSpinner.start()
    await runCommand("docker", process.cwd(), "build", "-t", browserImageName+":"+apiVersion, ".")
    cliSpinner.stop(true)
    
    const compose = {
        "version": "3.1",
        "networks": {
            "identity_api": {}
        },
        "services": {
            "controller": {
                "image": browserImageName+":"+apiVersion,
                "depends_on": [
                    "detcv", "recauth"
                ],
                "environment": [
                    "PORT=8080",
                    "DETCV_URL=http://detcv:8080",
                    "RECAUTH_URL=http://recauth:8080",
                    "MB_LICENCE_KEY="+answers.mbBrowserLicenceKey
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
        compose.services.controller.depends_on.push("id_scanner")
        compose.services.controller.environment.push("ID_SCANNER_URL=http://id_scanner:8080")
        if (answers.exposeIdScannerPort) {
            compose.services.id_scanner.ports = [
                answers.idScannerPort+":8080"
            ]
        }
    }
    let licenceModelPrefixes = []
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
        licenceModelPrefixes = (await runCommand("docker", process.cwd(), "run", "--rm", "--entrypoint", "ls", repo+"/"+modelsImageName+":"+answers.modelsImageTag)).split(/[\n\r]+/).filter(file => file.startsWith("license")).map(file => file.substring(0, file.indexOf("-")))
    } else {
        licenceModelPrefixes = (await runCommand("docker", process.cwd(), "run", "--rm", "--entrypoint", "ls", compose.services.detcv.image, "/models"))
    }
    if (licenceModelPrefixes.length > 0) {
        compose.services.detcv.environment.push("AUTHENTICITY_MODEL_PREFIXES="+Buffer.from(JSON.stringify(licenceModelPrefixes), "utf-8").toString("base64"))
    }
    const output = yaml.dump(compose)
    await fs.writeFile("docker-compose.yml", output)

    if (answers.launchContainers) {
        try {
            await runCommand("docker", process.cwd(), "swarm", "init")
        } catch (error) {

        }
        cliSpinner.text = "Launching containers"
        cliSpinner.start()
        await runCommand("docker", process.cwd(), "stack", "up", "-c", "docker-compose.yml", "ver-id-browser")
        cliSpinner.stop(true)
    }
})().catch(error => {
    console.error(error)
}).finally(() => {
    cliSpinner.stop(true)
})