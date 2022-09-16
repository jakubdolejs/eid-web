# Ver-ID In-Browser Live Face Detection and ID Card Capture

## Requirements
### General
- [NodeJS](https://nodejs.org) version 16
- [NPM](https://npmjs.com)
- [BlinkID In-browser SDK licence key](https://microblink.com/products/blinkid/in-browser-sdk) (if you're planning to capture ID cards)

### Demo server
- [Deno](https://deno.land)
- [Ngrok](https://ngrok.com)
- [Docker](https://docker.com)*
- [AWS CLI](https://aws.amazon.com/cli)*

*Only needed when running Ver-ID identity API locally


## Building library and demo server
1. Open the [workspace](./workspace) folder.
2. Run (substitute `<your Microblink licence key>` for actual value or leave out if not using ID capture):

    ```
    ./build.sh <your Microblink licence key>
    ```
The above script will install the library and demo server dependencies, build the library and demo server browser client libraries and copy the executable code to the appropriate folders.

## Running Ver-ID identity API server
The demo server will need to reach an instance of Ver-ID identity API server. You can either run this locally using Docker or use a remote server provided by Applied Recognition. The latter must NOT be used in production or in commercial deployments.

### Option 1: Run a local Ver-ID identity API server
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
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/restful-servers_detcv:1.5.0
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/id_scanner:2.0.0
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/identity_api:1.15.0
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/restful-servers_models:ca87ef3
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
7. Set environment variables:

    ```
    export VERID_SERVER_URL=http://localhost:8080
    export PORT=8090
    ```

### Option 2: Use Applied Recognition's Ver-ID identity API server

1. Set environment variables:

    ```
    export VERID_SERVER_URL=https://front-back.id-check.ver-id.com
    export PORT=8090
    ```

## Run demo server

1. The client-side scripts can only run on a secure connection (https). This is a feature of the [media devices API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices). To run the server locally we use an [Ngrok](https://ngrok.com) tunnel. 

3. Navigate to the [workspace](./workspace) folder and run substituting `mysubdomain` for your ngrok subdomain:

    ```
    ./startNgrok.sh 8090 mysubdomain
    ```
3. Start the demo server:

    ```
    deno run --allow-all server.ts
    ```
4. You should now be able to access the demo server in a browser on the Ngrok URL, e.g., https://mysubdomain.ngrok.io.

## Debugging in Visual Studio Code

1. Open [./workspace/Ver-ID Browser.code-workspace](./workspace/Ver-ID Browser.code-workspace) in Visual Studio Code.

2. Press Cmd+Shift+D to open the Run and Debug side bar.

3. Select **Launch demo server (workspace)** from the debug toolbar at the top of the side bar and press the "play" button. This will build and launch the demo server.

4. You will be prompted to select Ver-ID identity API server URL, Microblink licence key and later, as Ngrok starts, you will be prompted to enter your Ngrok subdomain.

5. The debugger may pause automatically. If it happens press the play arrow button to continue the debugging.

6. You should now be able to access the demo server in a browser on the Ngrok URL, e.g., https://mysubdomain.ngrok.io.

## Usage

### Running a liveness detection session:

```javascript
// URL of the server running the identity_api container
const serverURL = "https://somedomain.com"

// Import the face detection module
import { FaceDetection, LivenessDetectionSession } from "/@appliedrecognition/ver-id-browser/index.js"
    
// Create an instance of the FaceDetection class
const faceDetection = new FaceDetection(serverURL)

// Check that the browser supports liveness detection
if (!faceDetection.isLivenessDetectionSupported()) {
    alert("Liveness detection is not supported by your browser")
    return
}

// Create a liveness detection session
const livenessDetectionSession = new LivenessDetectionSession()

// Create a session Observable and subscribe to it to start a liveness detection session
const subscription = faceDetection.captureFaces(livenessDetectionSession).subscribe({
    next: (result) => {
        // Session succeeded
        // Detected faces and images are available in the result's faceCaptures array
        // Obtain a face template that can be used for face recognition
        const template = result.faceCaptures[0].face.template
        // Get the captured image cropped to the face bounding box
        const faceImageBlob = result.faceCaptures[0].faceImage
        // Load the blob into an image element
        const faceImageUrl = URL.createObjectURL(faceImageBlob)
        const img = document.createElement("img")
        img.onload = () => {
            URL.revokeObjectURL(faceImageUrl)
            document.body.appendChild(img)
        }
        img.onerror = () => {
            URL.revokeObjectURL(faceImageUrl)
            alert("Failed to load face image")
        }
        img.src = faceImageUrl
    },
    error: (error) => {
        // Session failed
    },
    complete: () => {
        // Session finished
        // If not result has been emitted it indicates that the session was cancelled
    }
})
// The session GUI displays a cancel button but if you need to otherwise 
// cancel the session unsubscribe from the session:
// subscription.unsubscribe()
```

### Detecting ID cards

You'll need a licence key tied to your domain name for [BlinkID In-browser SDK](https://microblink.com/products/blinkid/in-browser-sdk) to use this feature.

```javascript
// URL of the server running the identity_api container
const serverURL = "https://somedomain.com"

// Import the ID capture module
import { IdCapture, IdCaptureSettings, IdCaptureSessionSettings, DocumentPages } from "/@appliedrecognition/ver-id-browser/index.js"

// Settings
const resourcesURL = "/@appliedrecognition/ver-id-browser/resources/"
const settings = new IdCaptureSettings(yourLicenceKey, resourcesURL, serverURL)
const pages = DocumentPages.FRONT_AND_BACK // Scan the front and back of an ID
const sessionTimeout = 60000 // Session will time out after 1 minute
const saveCapturedImages = true // Save original images before they were cropped and deskewed
const sessionSettings = new IdCaptureSessionSettings(pages, sessionTimeout, saveCapturedImages)

// Create an instance of the IdCapture class
const idCapture = new IdCapture(settings)

// Capture ID card
idCapture.captureIdCard().subscribe({
    next: (result) => {
        if (result.pages != DocumentPages.BACK && result.face) {
            // You can use the detected face for face recognition
        }
    },
    error: (error) => {
        // ID capture failed
    },
    complete: () => {
        // ID capture finished
        // If not result has been emitted it indicates that the session was cancelled
    }
})

```

### Comparing faces

```javascript
// URL of the server running the identity_api container
const serverURL = "https://somedomain.com"

// Import the face recognition module
import { FaceRecognition } from "/@appliedrecognition/ver-id-browser/index.js"

// Create an instance of FaceRecognition
const faceRecognition = new FaceRecognition(serverURL)
    
// With two face templates obtained from createRecognizableFace:
faceRecognition.compareFaceTemplates(template1, template2).then((score) => {
    // Face comparison finished
    alert("The two faces scored "+score+" on similarity")
}).catch((error) => {
    // Face comparison failed
})
```

### Implementing your own user interface
To create your own UI for the ID capture pass an implementation of the [IdCaptureUI](https://appliedrecognition.github.io/Ver-ID-Browser/interfaces/idcaptureui.html) interface to the session's settings.

```javascript
import { IdCaptureUI, IdCaptureSessionSettings } from "/@appliedrecognition/ver-id-browser/index.js"

// Create your class that implements the IdCaptureUI interface
class MyIdCaptureUI implements IdCaptureUI {
    // ...
}

// Create session settings
const sessionSettings = new IdCaptureSessionSettings()
// Set the createUI function to return your instance of IdCaptureUI
sessionSettings.createUI = () => new MyIdCaptureUI()
```

## Documentation
API reference documentation is available on the project's [Github page](https://appliedrecognition.github.io/Ver-ID-Browser/).

