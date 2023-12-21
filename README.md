# Ver-ID In-Browser Live Face Detection and ID Card Capture

## Requirements

- [NodeJS](https://nodejs.org) (tested with version 20)
- [NPM](https://npmjs.com)
- [BlinkID In-browser SDK licence key](https://github.com/BlinkID/blinkid-in-browser) (if you're planning to capture ID cards)
- [BlinkID Self-hosted API licence key](https://docs.microblink.com/documentation/self-hosted/current/overview.html#introduction) (if you're planning to capture ID cards)
- [Ngrok](https://ngrok.com)
- [Docker](https://docker.com)

## Running the server

1. Request AWS access key and secret key from Applied Recognition
2. Create an AWS profile with the credentials from the previous step (substitute ACME for your chosen profile name):

    ```
    aws --profile ACME configure
    ```
3. Log in to AWS ECR repository:

    ```
    aws --profile ACME ecr get-login-password | docker login -u AWS --password-stdin 725614911995.dkr.ecr.us-east-1.amazonaws.com
    ```
4. Pull Docker images:

    ```
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/identity_api:1.17.2
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/restful-servers_detcv:1.6.4
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/passport-signature-detector:1.0.2
    docker pull microblink/api:3.4
    ```
6. Create a file called .env in the project's root folder and set the content to (substitute `<your Microblink licensee name>` and `<your Microblink licence key>` for actual values):

    ```
    LICENSEE=<your Microblink licensee name>
    LICENSE_KEY=<your Microblink licence key>
    ```
5. In the project's root folder run:

    ```
    docker-compose up -d
    ```
6. You can ensure that the Docker containers started successfully with this Docker command:

    ```
    docker ps
    ```

## Building the client

1. Navigate to the [client](./client) directory.
2. Run `npm install`.
3. Run `npm run build`.

## Examples

The project contains 3 examples:

1. [Face capture](./examples/face_capture) – capture and display a face
2. [Face comparison](./examples/face_comparison) – compare faces in 2 images
3. [ID capture](./examples/id_capture) – capture an ID card

### Running the examples

Before running the examples ensure you have launched the Docker containers using `docker compose up -d` from the project's root directory.

Follow these steps for each example:

1. In each example directory create a file called **.env**.
2. The contents of the .env file should contain the following variables (substitute values in `< >`):

    ```
    NGROK_AUTH_TOKEN=<ngrok auth token>
    SERVICE_PORT=8080
    SERVICE_REGION=<ap|au|eu|in|jp|sa|us|us-cal-1>
    CLIENT_PORT=8090
    CLIENT_REGION=<ap|au|eu|in|jp|sa|us|us-cal-1>
    # Optional
    CLIENT_SUBDOMAIN=<ngrok subdomain>
    # Only required if you're running the ID capture example
    BLINKID_LICENCE_KEY=<your BlinkID browser licence key>
    ```
3. After you save the .env file run:

    ```
    npm run deploy
    ```
    This will build the client library and install it as a dependency in the example project. The command will also bundle the example code. Finally, the command will use the Ngrok API to start a tunnel to the server and to the client. When everything is done the script will open the example web page in your browser.

## Documentation
API reference documentation is available on the project's [Github page](https://appliedrecognition.github.io/Ver-ID-Browser/).

