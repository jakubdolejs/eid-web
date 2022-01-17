#!/bin/sh

# Exit on error
set -e

# ---------
# Variables
# ---------
SCRIPT_PATH=`realpath $0`
MB_LICENCE_KEY=$1
MY_DIR=`dirname "${SCRIPT_PATH}"`
LIBRARY_DIR=`realpath "${MY_DIR}/../client"`
DEMO_CLIENT_DIR=`realpath "${MY_DIR}/../demo_client"`
DEMO_SERVER_DIR=`realpath "${MY_DIR}/../demo_server"`
CONFIG_FILE="${DEMO_SERVER_DIR}/config.json"

# -----
# Clean
# -----
echo "Cleaning"
rm -rf "${LIBRARY_DIR}/dist" \
"${DEMO_SERVER_DIR}/js" "${DEMO_SERVER_DIR}/demo_client" \
"${DEMO_SERVER_DIR}/demo_client" "${DEMO_SERVER_DIR}/node_modules" "${DEMO_SERVER_DIR}/js" >/dev/null

# -------
# Library
# -------
# Install dependencies
echo "Installing library dependencies"
cd "${LIBRARY_DIR}"
npm install >/dev/null
# Build
echo "Building library"
npx webpack >/dev/null

# -----------
# Demo client
# -----------
# Install dependencies
cd "${DEMO_CLIENT_DIR}"
echo "Installing demo client dependencies"
npm install > /dev/null
# Build
echo "Building demo client"
npx tsc >/dev/null

# -----------
# Demo server
# -----------
# Create folders for demo client source
echo "Creating demo client source folder on demo server"
mkdir -p "${DEMO_SERVER_DIR}/demo_client" >/dev/null
# Copy demo client source
echo "Copying demo client source to demo server"
cp -r "${DEMO_CLIENT_DIR}/src" "${DEMO_SERVER_DIR}/demo_client" >/dev/null
# Copy client node modules
echo "Copying demo client Node modules to demo server"
cp -r "${DEMO_CLIENT_DIR}/node_modules" "${DEMO_SERVER_DIR}" >/dev/null
# Config file
if [ "${MB_LICENCE_KEY}" ]; then
    # If Microblink licence key is set save it in config file
    echo "${MB_LICENCE_KEY}" > "${CONFIG_FILE}"
    echo "Wrote configuration to ${CONFIG_FILE}"
elif [ ! -f "${CONFIG_FILE}" ]; then
    # Otherwise, if config file doesn't exist, create a placeholder config file
    echo "{\n    \"licenceKey\": \"\"\n}" > "${CONFIG_FILE}"
    echo "Wrote placeholder configuration to ${CONFIG_FILE}"
fi

echo "Done"