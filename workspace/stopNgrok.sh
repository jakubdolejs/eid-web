NGROKPID=$(ps -o pid,command -cx | grep ngrok | awk '{ print $1 }')
if [[ $NGROKPID -gt 0 ]]; then
    kill -9 ${NGROKPID}
    echo Ngrok stopped
else
    echo Ngrok not running
fi