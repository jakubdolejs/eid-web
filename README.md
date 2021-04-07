# Ver-ID In-Browser Live Face Detection

## Installation

1. Pull Docker images:

    ```
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/restful-servers_recauth:1.3.3
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/restful-servers_detcv:1.3.3
    docker pull 725614911995.dkr.ecr.us-east-1.amazonaws.com/id_scanner:1.34.0
    ```
2. In the project's root folder run:
    
    ```
    docker build -t ver-id-browser-demo:latest .
    ```
3. Launch the Docker containers:

    - Using [Docker swarm](https://docs.docker.com/engine/swarm/):
    
        ```
        docker stack up -c docker-compose.yml demo
        ```
    - Using [Docker compose](https://docs.docker.com/compose/):

        ```
        docker-compose up -d
        ```

## Usage

- Run a liveness detection session:

    ```javascript
    // Import the face detection module
    import { FaceDetection } from "/js/faceDetection.js"
    
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
- Compare faces

    ```javascript
    // Import the face recognition module
    import { FaceRecognition } from "/js/faceRecognition.js"

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
