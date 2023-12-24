import * as ngrok from "ngrok"
import "dotenv/config"
import { writeFile } from "fs/promises";
import * as httpserver from "http-server";
import open from "open";

(async function() {
    const options = {
        "addr": parseInt(process.env.SERVICE_PORT ?? "8080")
    }
    const clientOptions = {
        "addr": parseInt(process.env.CLIENT_PORT ?? "8090")
    }
    if (process.env.NGROK_AUTH_TOKEN) {
        options.authtoken = process.env.NGROK_AUTH_TOKEN;
        clientOptions.authtoken = process.env.NGROK_AUTH_TOKEN;
    }
    if (process.env.SERVICE_REGION) {
        options.region = process.env.SERVICE_REGION;
    }
    await ngrok.disconnect();
    const serviceURL = await ngrok.connect(options);
    console.log(`Service running at ${serviceURL}`)
    const config = {
        "serviceURL": serviceURL
    }
    if (process.env.CLIENT_REGION) {
        clientOptions.region = process.env.CLIENT_REGION;
    }
    if (process.env.CLIENT_SUBDOMAIN) {
        clientOptions.subdomain = process.env.CLIENT_SUBDOMAIN;
    }
    const clientURL = await ngrok.connect(clientOptions);
    await writeFile("config.json", JSON.stringify(config, null, 4));
    httpserver.createServer().listen(clientOptions.addr, () => {
        console.log(`Client running at ${clientURL}`);
        open(clientURL);
    });
})();