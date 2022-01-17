./stopNgrok.sh
PORT=$1
SUBDOMAIN=$2
if [ -z "${SUBDOMAIN}" ]; then
    echo "Starting ngrok on port ${PORT}"
    nohup ngrok http ${PORT} -log=stdout > ngrok.log &
else
    echo "Starting ngrok on port ${PORT} with subdomain ${SUBDOMAIN}"
    nohup ngrok http ${PORT} -subdomain=${SUBDOMAIN} -log=stdout > ngrok.log &
fi
NGROKPID=$(ps -o pid,command -cx | grep ngrok | awk '{ print $1 }')
if [[ $NGROKPID -gt 0 ]]; then
    echo "Ngrok started"
else
    echo "Failed to start Ngrok"
    exit 1
fi