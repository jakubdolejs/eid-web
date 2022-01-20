import { serve, Status, STATUS_TEXT } from "https://deno.land/std@0.119.0/http/mod.ts";
import { resolve, parse, join } from "https://deno.land/std@0.119.0/path/mod.ts"
import { engineFactory } from "https://deno.land/x/view_engine@v1.5.0/mod.ts"

async function forwardRequest(req: Request): Promise<Response> {
    try {
        const serverUrl = new URL(veridServerUrl)
        const url = new URL(req.url)
        url.protocol = serverUrl.protocol
        url.host = serverUrl.host
        url.port = serverUrl.port
        const response = await fetch(url.toString(), {"method": "POST", "body": req.body, "headers": req.headers})
        return response
    } catch (error) {
        return new Response(JSON.stringify(error), {"status": Status.InternalServerError, "statusText": STATUS_TEXT.get(Status.InternalServerError)})
    }
}

async function handler(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method.toLowerCase() == "post" && (url.pathname == "/" || url.pathname == "" || url.pathname == "/detect_face" || url.pathname == "/compare_faces")) {
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
                if (file.endsWith("index.html") && microblinkLicenceKey) {
                    let html = textDecoder.decode(content)
                    html = ejsEngine(html, {
                        "microblinkLicenceKey": microblinkLicenceKey
                    })
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
const microblinkLicenceKey = Deno.env.get("MICROBLINK_LICENCE_KEY")
const ejsEngine = engineFactory.getEjsEngine()
const textDecoder = new TextDecoder("utf-8")
const textEncoder = new TextEncoder()
const port = parseInt(Deno.env.get("PORT") || "8090")
serve(handler,{"port": port})
console.log(`Server listening on port ${port}`)