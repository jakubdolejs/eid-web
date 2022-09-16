import { serve, Status, STATUS_TEXT } from "https://deno.land/std@0.119.0/http/mod.ts";
import { resolve, parse, join } from "https://deno.land/std@0.119.0/path/mod.ts"
import { engineFactory } from "https://deno.land/x/view_engine@v1.5.0/mod.ts"
import { parse as parseArgs } from "https://deno.land/std@0.119.0/flags/mod.ts"

let trustmaticSettings: {
    username: string,
    password: string,
    endpoint: string
}|undefined

if (Deno.env.get("TRUSTMATIC_USERNAME") && Deno.env.get("TRUSTMATIC_PASSWORD") && Deno.env.get("TRUSTMATIC_ENDPOINT")) {
    trustmaticSettings = {
        username: Deno.env.get("TRUSTMATIC_USERNAME") as string,
        password: Deno.env.get("TRUSTMATIC_PASSWORD") as string,
        endpoint: Deno.env.get("TRUSTMATIC_ENDPOINT") as string
    }
}

async function forwardRequest(req: Request): Promise<Response> {
    try {
        const serverUrl = new URL(veridServerUrl)
        let headers: Headers = new Headers(req.headers)
        let url = new URL(req.url)
        if (url.pathname == "/check_liveness") {
            if (trustmaticSettings) {
                // If we have Trustmatic credentials use them to forward the call to the Trustmatic API
                url = new URL(trustmaticSettings.endpoint)
                headers.append("Authorization", "Basic "+btoa(trustmaticSettings.username + ":" + trustmaticSettings.password))
            } else {
                // Otherwise return success on liveness check
                let body: {sessionId: string} = await req.json()
                return new Response(JSON.stringify({"sessionId": body.sessionId, "hasError": false, "score": 1.0}), {"status": Status.OK, "statusText": STATUS_TEXT.get(Status.OK)})
            }
        } else {
            url.protocol = serverUrl.protocol
            url.host = serverUrl.host
            url.port = serverUrl.port
        }
        const response = await fetch(url.toString(), {"method": "POST", "body": req.body, "headers": headers})
        return response
    } catch (error) {
        return new Response(JSON.stringify(error), {"status": Status.InternalServerError, "statusText": STATUS_TEXT.get(Status.InternalServerError)})
    }
}

async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method.toLowerCase() == "post" && (url.pathname == "/" || url.pathname == "" || url.pathname == "/detect_face" || url.pathname == "/compare_faces" || url.pathname == "/check_liveness")) {
        return forwardRequest(req)
    } else {
        try {
            let pathname = url.pathname.replaceAll("..", "");
            if (pathname == "/" || pathname == "") {
                pathname = "/index.html"
            }
            if (pathname.endsWith(".html")) {
                const parsedPath = parse(pathname)
                pathname = join(parsedPath.dir, "views", parsedPath.base)
            }
            const match = /^\/*(.+)/i.exec(pathname)
            if (!match) {
                throw new Error("File not found")
            }
            const file = resolve(match[1])
            const cwd = resolve(".")
            if (!file.startsWith(cwd)) {
                throw new Error("Invalid file path")
            }
            let content = await Deno.readFile(file)
            const headers: {headers:{"Content-Type"?:string}} = {"headers": {}}
            if (file.endsWith(".json")) {
                headers.headers["Content-Type"] = "application/json"
            } else if (file.endsWith(".js")) {
                headers.headers["Content-Type"] = "text/javascript"
            } else if (file.endsWith(".ts")) {
                headers.headers["Content-Type"] = "text/typescript"
            } else if (file.endsWith(".css")) {
                headers.headers["Content-Type"] = "text/css"
            } else if (file.endsWith(".html") || file.endsWith(".htm")) {
                headers.headers["Content-Type"] = "text/html"
                if (Object.entries(jsVars).length > 0) {
                    let html = textDecoder.decode(content)
                    html = ejsEngine(html, {"options": jsVars})
                    content = textEncoder.encode(html)
                }
            } else if (file.endsWith(".wasm")) {
                headers.headers["Content-Type"] = "application/wasm"
            } else if (file.endsWith(".mp4")) {
                headers.headers["Content-Type"] = "video/mp4"
            }
            return new Response(content, headers)
        } catch (error) {
            return new Response(JSON.stringify(error), {"status": Status.NotFound, "statusText": STATUS_TEXT.get(Status.NotFound)})
        }
    }
}

const veridServerUrl = Deno.env.get("VERID_SERVER_URL") || ""
if (!veridServerUrl) {
    console.error("Error: Environment variable VERID_SERVER_URL is not set. See ../README.md for details.")
    Deno.exit(1)
}
const args = parseArgs(Deno.args)
const jsVars: {[k: string]: any} = {}
const options: string[] = [
    "useFrontCamera",
    "faceCaptureCount",
    "maxDuration",
    "yawThreshold",
    "pitchThreshold",
    "faceCaptureFaceCount",
    "pauseDuration",
    "recordSessionVideo",
    "controlFaceSimilarityThreshold",
    "controlFaceCaptureInterval",
    "maxControlFaceCount",
    "minFPS",
    "microblinkLicenceKey",
    "port"
]
for (const arg in args) {
    if (options.includes(arg)) {
        jsVars[arg] = args[arg]
    }
}
if (!jsVars.port) {
    jsVars.port = parseInt(Deno.env.get("PORT") || "8090")
}
if (!jsVars.microblinkLicenceKey && Deno.env.get("MICROBLINK_LICENCE_KEY")) {
    jsVars.microblinkLicenceKey = Deno.env.get("MICROBLINK_LICENCE_KEY")
}
const ejsEngine = engineFactory.getEjsEngine()
const textDecoder = new TextDecoder("utf-8")
const textEncoder = new TextEncoder()
serve(handler,{"port": jsVars.port})
console.log(`Server listening on port ${jsVars.port}`)