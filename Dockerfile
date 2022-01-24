FROM node:16.13.2-alpine3.15 AS builder
WORKDIR /build
COPY . .
RUN ./workspace/build.sh

FROM denoland/deno:1.17.3
COPY --from=builder --chown=deno:deno /build/client /app/client
COPY --from=builder --chown=deno:deno /build/demo_server /app/demo_server
USER deno
WORKDIR /app/demo_server
ENTRYPOINT [ "deno", "run", "--allow-all", "server.ts" ]