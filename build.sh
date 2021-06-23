#!/bin/sh
cd client
npx webpack
#npx typedoc
cd ../demo
npx tsc