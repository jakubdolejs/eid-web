FROM node:15.12-alpine3.13
WORKDIR /app
COPY static ./static
COPY docs ./docs
COPY views ./views
COPY index.js .
COPY package-lock.json .
COPY package.json .
COPY README.md .
RUN apk update
RUN apk upgrade
RUN adduser -D app
RUN npm install --production
RUN chown -R app:app .
USER app
ENTRYPOINT [ "node", "index.js" ]