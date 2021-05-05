# Ver-ID In-Browser Live Face Detection and ID Card Capture

## Requirements
- [NodeJS](https://nodejs.org) 14.6 or newer
- [Docker](https://docker.com)
- [NPM](https://npmjs.com)
- [AWS CLI](https://aws.amazon.com/cli)
- [BlinkID In-browser SDK licence key](https://microblink.com/products/blinkid/in-browser-sdk) (if you're planning to capture ID cards)

## Installation

1. Request AWS access key and secret key from Applied Recognition
2. Create an AWS profile with the credentials from the previous step (substitute ACME for your chosen profile name):

    ```
    aws --profile ACME configure
    ```
1. Log in to AWS ECR repository:

    ```
    aws --profile ACME ecr get-login-password | docker login -u AWS --password-stdin 725614911995.dkr.ecr.us-east-1.amazonaws.com
    ```
1. Pull Docker images:

    ```
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/restful-servers_recauth:1.3.6
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/restful-servers_detcv:1.3.6
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/id_scanner:1.34.0
    ```
2. In the project's root folder run:
    
    ```
    npm install
    ```
3. Run the configuration script and follow the prompts:

    ```
    node configure.js
    ```

## Usage

### Running a liveness detection session:

```javascript
// Import the face detection module
import { FaceDetection } from "/@appliedrecognition/ver-id-browser/index.js"
    
// Create an instance of the FaceDetection class
const faceDetection = new FaceDetection()

// Check that the browser supports liveness detection
if (!faceDetection.isLivenessDetectionSupported()) {
    alert("Liveness detection is not supported by your browser")
    return
}

// Create a session Observable and subscribe to it to start a liveness detection session
const subscription = faceDetection.livenessDetectionSession().subscribe({
    next: (result) => {
        // Session succeeded
        // Detected faces and images are available in the result's faceCaptures array
        // Obtain a face template that can be used for face recognition
        const template = result.faceCaptures[0].face.template
        // Get the captured image cropped to the face bounding box
        result.faceCaptures[0].faceImage.then((image) => {
            document.body.appendChild(image)
        })
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
// Import the ID capture module
import { IdCapture, IdCaptureSettings } from "/@appliedrecognition/ver-id-browser/index.js"

// Settings
const resourcesURL = "/@appliedrecognition/ver-id-browser/resources/"
const settings = new IdCaptureSettings(yourLicenceKey, resourcesURL)

// Create an instance of the IdCapture class
const idCapture = new IdCapture(settings)

// Capture ID card
idCapture.captureIdCard().subscribe({
    next: (result) => {
        if (result.face) {
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
// Import the face recognition module
import { FaceRecognition } from "/@appliedrecognition/ver-id-browser/index.js"

// Create an instance of FaceRecognition
const faceRecognition = new FaceRecognition()
    
// With two face templates obtained from createRecognizableFace:
faceRecognition.compareFaceTemplates(template1, template2).then((score) => {
    // Face comparison finished
    alert("The two faces scored "+score+" on similarity")
}).catch((error) => {
    // Face comparison failed
})
```

## Demo

Live demo is available at [/demo](./demo).

## Documentation

Documentation is available in the [docs folder](./docs/index.html).
