FROM node:15.14-alpine3.13 AS builder
WORKDIR /build
COPY . .
WORKDIR /build/client
RUN npm install
RUN npx webpack
WORKDIR /build/demo
RUN npm install
RUN npx tsc

FROM python:3
RUN adduser --disabled-password app
COPY --from=builder --chown=app:app /build/client /app/client
COPY --from=builder --chown=app:app /build/demo /app/demo
WORKDIR /app/demo
RUN python -m pip install requests
USER app
ENTRYPOINT [ "python", "bootstrap.py" ]