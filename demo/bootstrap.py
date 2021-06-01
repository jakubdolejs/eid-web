
import http.server
import socketserver
import os
import requests
import os.path
import shutil
import base64
import json

configFile = "config.json"

if os.getenv("DEMO_CONFIG_URL"):
    print("Downloading configuration from "+os.getenv("DEMO_CONFIG_URL"))
    req = requests.get(os.getenv("DEMO_CONFIG_URL"), allow_redirects=True)
    open(configFile, "wb").write(req.content)
elif os.getenv("DEMO_CONFIG_SECRET_NAME") and os.path.exists(os.path.join("/run/secrets", os.getenv("DEMO_CONFIG_SECRET_NAME"))):
    configFilePath = os.path.join("/run/secrets", os.getenv("DEMO_CONFIG_SECRET_NAME"))
    print("Copying configuration from "+configFilePath)
    shutil.copyfile(configFilePath, configFile)
elif os.getenv("DEMO_CONFIG"):
    print("Copying configuration from environment variable")
    b64bytes = base64.b64decode(os.getenv("DEMO_CONFIG"))
    open(configFile, "wb").write(b64bytes)

configuration = json.loads(open(configFile).read())
if "port" not in configuration:
    configuration["port"] = 80

Handler = http.server.SimpleHTTPRequestHandler
 
with socketserver.TCPServer(("", configuration["port"]), Handler) as httpd:
    print("Server listening on port", configuration["port"])
    httpd.serve_forever()