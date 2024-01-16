import * as ngrok from "ngrok"
import "dotenv/config"
import { writeFile } from "fs/promises";
import * as httpserver from "http-server";
import open from "open";

(async function() {
    const clientOptions = {
        "addr": parseInt(process.env.CLIENT_PORT ?? "8090")
    }
    const blinkIDLicenceKey = process.env.BLINKID_LICENCE_KEY;
    if (!blinkIDLicenceKey) {
        console.error("BLINKID_LICENCE_KEY environment variable is not set");
        process.exit(1);
    }
    if (process.env.NGROK_AUTH_TOKEN) {
        clientOptions.authtoken = process.env.NGROK_AUTH_TOKEN;
    }
    await ngrok.disconnect();
    const config = {
        "blinkIDLicenceKey": blinkIDLicenceKey
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