FROM node:15.12-alpine3.13
WORKDIR /app
COPY server/static ./static
COPY server/views ./views
COPY server/docs ./docs
COPY server/dist ./dist
COPY server/ver-id-browser ./ver-id-browser
COPY server/package-lock.json .
COPY server/package.json .
COPY README.md .
RUN apk update
RUN apk upgrade
RUN adduser -D app
RUN npm install --production
RUN chown -R app:app .
USER app
ENTRYPOINT [ "npm", "run", "server" ]