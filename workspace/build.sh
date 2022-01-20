#!/bin/sh

# Exit on error
set -e

# ---------
# Variables
# ---------
SCRIPT_PATH=`realpath $0`
MY_DIR=`dirname "${SCRIPT_PATH}"`
LIBRARY_DIR=`realpath "${MY_DIR}/../client"`
DEMO_CLIENT_DIR=`realpath "${MY_DIR}/../demo_client"`
DEMO_SERVER_DIR=`realpath "${MY_DIR}/../demo_server"`

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

echo "Done"