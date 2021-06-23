import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer, SimpleHTTPRequestHandler
import sys, getopt

port = 8080
subdomain: str = ""
opts, args = getopt.getopt(sys.argv[1:], "p:s:", ["port=","subdomain="])
for opt, arg in opts:
    if opt in ("-p", "--port"):
        port = arg
    elif opt in ("-s", "--subdomain"):
        subdomain = arg


print("Compiling library")
subprocess.call(["npx", "webpack"], cwd="client")

print("Compiling demo")
subprocess.call(["npx", "tsc"], cwd="demo")

print("Starting ngrok")
ngrok_args = ["ngrok", "http"]
if subdomain:
    ngrok_args.append(f"-subdomain={subdomain}")
ngrok_args.append(f"{port}")
subprocess.run(ngrok_args, capture_output=True, text=True)

print(f"Starting server on port {port}")
class RequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory="demo", **kwargs)

httpd = HTTPServer(("localhost", port), RequestHandler)
httpd.serve_forever()