#!/bin/sh
cd client
npx webpack
#npx typedoc
cd ../demo
npx tsc
SERVER_SESSION_NAME=ver-id-browser-server
NGROK_SESSION_NAME=ver-id-browser-ngrok
screen -X -S ${SERVER_SESSION_NAME} kill
screen -S ${SERVER_SESSION_NAME}
python3 -m http.server 8080
screen -d ${SERVER_SESSION_NAME}
screen -X -S ${NGROK_SESSION_NAME} kill
screen -S ${NGROK_SESSION_NAME}
ngrok start jakub
screen -d ${NGROK_SESSION_NAME}