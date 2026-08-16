// ============================================
// WEB CCTV v1
// Phone = Camera
// Computer = Monitor
// ============================================

let peer = null;
let localStream = null;
let currentCall = null;

let roomId = null;
let currentRole = null;

let usingFrontCamera = false;


// ============================================
// ELEMENTS
// ============================================

const loginScreen = document.getElementById("loginScreen");

const cameraScreen = document.getElementById("cameraScreen");
const monitorScreen = document.getElementById("monitorScreen");

const passwordInput = document.getElementById("password");

const cameraButton = document.getElementById("cameraButton");
const monitorButton = document.getElementById("monitorButton");

const errorBox = document.getElementById("error");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const waitingMessage = document.getElementById("waitingMessage");

const statusText = document.getElementById("status");

const cameraConnection =
    document.getElementById("cameraConnection");

const monitorLive =
    document.getElementById("monitorLive");


// ============================================
// PASSWORD -> ROOM ID
// ============================================

function hashPassword(text) {

    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {

        hash ^= text.charCodeAt(i);

        hash +=
            (hash << 1) +
            (hash << 4) +
            (hash << 7) +
            (hash << 8) +
            (hash << 24);
    }

    return Math.abs(hash >>> 0).toString(36);
}


function getRoomId(password) {

    return "cctv_" + hashPassword(password);

}


// ============================================
// ERROR
// ============================================

function showError(message) {

    errorBox.textContent = message;

}


// ============================================
// STATUS
// ============================================

function setStatus(text, online = false) {

    statusText.textContent = text;

    if (online) {
        statusText.classList.add("online");
    } else {
        statusText.classList.remove("online");
    }

}


// ============================================
// CAMERA BUTTON
// ============================================

cameraButton.addEventListener("click", async () => {

    const password =
        passwordInput.value.trim();

    if (!password) {

        showError("Enter a password first.");

        return;
    }

    if (password.length < 3) {

        showError(
            "Password must be at least 3 characters."
        );

        return;
    }

    currentRole = "camera";

    roomId = getRoomId(password);

    showError("");

    loginScreen.classList.add("hidden");

    cameraScreen.classList.remove("hidden");

    setStatus("STARTING CAMERA");

    await startCamera();

});


// ============================================
// MONITOR BUTTON
// ============================================

monitorButton.addEventListener("click", async () => {

    const password =
        passwordInput.value.trim();

    if (!password) {

        showError("Enter a password first.");

        return;
    }

    if (password.length < 3) {

        showError(
            "Password must be at least 3 characters."
        );

        return;
    }

    currentRole = "monitor";

    roomId = getRoomId(password);

    showError("");

    loginScreen.classList.add("hidden");

    monitorScreen.classList.remove("hidden");

    setStatus("CONNECTING");

    startMonitor();

});


// ============================================
// START CAMERA
// ============================================

async function startCamera() {

    try {

        localStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: {
                        ideal:
                            usingFrontCamera
                                ? "user"
                                : "environment"
                    },

                    width: {
                        ideal: 1280
                    },

                    height: {
                        ideal: 720
                    }
                },

                audio: true

            });

        localVideo.srcObject =
            localStream;

        setStatus(
            "WAITING",
            true
        );

        cameraConnection.textContent =
            "Waiting for monitor...";

        createCameraPeer();

    } catch (error) {

        console.error(
            "Camera error:",
            error
        );

        setStatus("CAMERA ERROR");

        cameraConnection.textContent =
            "Camera permission was denied or unavailable.";

        alert(
            "Could not access the camera.\n\n" +
            "Make sure you allowed camera and microphone access."
        );

    }

}


// ============================================
// CREATE CAMERA PEER
// ============================================

function createCameraPeer() {

    const cameraPeerId =
        roomId + "_camera";

    peer =
        new Peer(
            cameraPeerId,
            {
                debug: 1
            }
        );


    peer.on("open", id => {

        console.log(
            "Camera Peer ID:",
            id
        );

        setStatus(
            "WAITING",
            true
        );

    });


    peer.on("call", call => {

        console.log(
            "Monitor connected!"
        );

        currentCall = call;

        call.answer(
            localStream
        );

        cameraConnection.textContent =
            "Monitor connected";

        setStatus(
            "LIVE",
            true
        );

    });


    peer.on("error", error => {

        console.error(
            "Peer error:",
            error
        );

        if (
            error.type ===
            "unavailable-id"
        ) {

            cameraConnection.textContent =
                "Camera already connected.";

            setStatus("BUSY");

        } else {

            cameraConnection.textContent =
                "Connection error.";

            setStatus("ERROR");

        }

    });


    peer.on("disconnected", () => {

        setStatus(
            "DISCONNECTED"
        );

    });

}


// ============================================
// START MONITOR
// ============================================

function startMonitor() {

    const monitorPeerId =
        roomId +
        "_monitor_" +
        Math.random()
            .toString(36)
            .substring(2, 8);


    peer =
        new Peer(
            monitorPeerId,
            {
                debug: 1
            }
        );


    peer.on("open", () => {

        console.log(
            "Monitor ready"
        );

        setStatus(
            "SEARCHING",
            true
        );

        connectToCamera();

    });


    peer.on("error", error => {

        console.error(
            "Monitor error:",
            error
        );

        setStatus(
            "ERROR"
        );

    });


    peer.on("disconnected", () => {

        setStatus(
            "DISCONNECTED"
        );

    });

}


// ============================================
// CONNECT TO CAMERA
// ============================================

function connectToCamera() {

    const cameraPeerId =
        roomId + "_camera";


    console.log(
        "Calling camera:",
        cameraPeerId
    );


    const emptyStream =
        createEmptyStream();


    const call =
        peer.call(
            cameraPeerId,
            emptyStream
        );


    if (!call) {

        setTimeout(
            connectToCamera,
            2000
        );

        return;
    }


    currentCall = call;


    call.on("stream", stream => {

        console.log(
            "Received CCTV stream!"
        );

        remoteVideo.srcObject =
            stream;

        waitingMessage
            .classList
            .add("hidden");

        monitorLive
            .classList
            .remove("hidden");

        setStatus(
            "LIVE",
            true
        );

    });


    call.on("close", () => {

        remoteVideo.srcObject =
            null;

        waitingMessage
            .classList
            .remove("hidden");

        monitorLive
            .classList
            .add("hidden");

        setStatus(
            "CAMERA OFFLINE"
        );

    });


    call.on("error", error => {

        console.error(
            "Call error:",
            error
        );

        setStatus(
            "CONNECTION ERROR"
        );

    });

}


// ============================================
// EMPTY STREAM FOR MONITOR
// ============================================

function createEmptyStream() {

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width = 1;
    canvas.height = 1;


    const videoStream =
        canvas.captureStream(1);


    const stream =
        new MediaStream();


    videoStream
        .getVideoTracks()
        .forEach(track => {

            stream.addTrack(track);

        });


    return stream;

}


// ============================================
// SWITCH CAMERA
// ============================================

document
    .getElementById("flipCamera")
    .addEventListener(
        "click",
        async () => {

            if (!localStream) {

                return;
            }


            // Switch the desired camera
            usingFrontCamera =
                !usingFrontCamera;


            // Save the old stream
            const oldStream =
                localStream;


            // IMPORTANT:
            // Stop the old camera BEFORE
            // opening the new one.

            oldStream
                .getVideoTracks()
                .forEach(track => {

                    track.stop();

                });


            try {

                const newStream =
                    await navigator.mediaDevices
                        .getUserMedia({

                            video: {

                                facingMode: {
                                    exact:
                                        usingFrontCamera
                                            ? "user"
                                            : "environment"
                                },

                                width: {
                                    ideal: 1280
                                },

                                height: {
                                    ideal: 720
                                }

                            },

                            audio: true

                        });


                localStream =
                    newStream;


                localVideo.srcObject =
                    newStream;


                // Update WebRTC connection
                if (
                    currentCall &&
                    currentCall.peerConnection
                ) {

                    const senders =
                        currentCall
                            .peerConnection
                            .getSenders();


                    const newVideoTrack =
                        newStream
                            .getVideoTracks()[0];


                    const newAudioTrack =
                        newStream
                            .getAudioTracks()[0];


                    for (
                        const sender
                        of senders
                    ) {

                        if (
                            sender.track &&
                            sender.track.kind ===
                                "video"
                        ) {

                            await sender
                                .replaceTrack(
                                    newVideoTrack
                                );

                        }


                        if (
                            sender.track &&
                            sender.track.kind ===
                                "audio"
                        ) {

                            await sender
                                .replaceTrack(
                                    newAudioTrack
                                );

                        }

                    }

                }


                console.log(
                    "Camera switched successfully."
                );


            } catch (error) {

                console.error(
                    "Camera switch failed:",
                    error
                );


                // Restore previous direction
                usingFrontCamera =
                    !usingFrontCamera;


                try {

                    const restoredStream =
                        await navigator.mediaDevices
                            .getUserMedia({

                                video: {

                                    facingMode: {
                                        ideal:
                                            usingFrontCamera
                                                ? "user"
                                                : "environment"
                                    },

                                    width: {
                                        ideal: 1280
                                    },

                                    height: {
                                        ideal: 720
                                    }

                                },

                                audio: true

                            });


                    localStream =
                        restoredStream;


                    localVideo.srcObject =
                        restoredStream;


                    console.log(
                        "Previous camera restored."
                    );


                } catch (
                    restoreError
                ) {

                    console.error(
                        "Could not restore camera:",
                        restoreError
                    );


                    alert(
                        "Could not switch camera."
                    );

                }

            }

        }
    );


// ============================================
// FULLSCREEN
// ============================================

document
    .getElementById("fullscreen")
    .addEventListener(
        "click",
        () => {

            const container =
                document.querySelector(
                    ".monitorContainer"
                );


            if (
                container.requestFullscreen
            ) {

                container.requestFullscreen();

            } else if (
                container.webkitRequestFullscreen
            ) {

                container.webkitRequestFullscreen();

            }

        }
    );


// ============================================
// DISCONNECT CAMERA
// ============================================

document
    .getElementById("cameraStop")
    .addEventListener(
        "click",
        () => {

            disconnectEverything();

        }
    );


// ============================================
// DISCONNECT MONITOR
// ============================================

document
    .getElementById("monitorStop")
    .addEventListener(
        "click",
        () => {

            disconnectEverything();

        }
    );


// ============================================
// DISCONNECT EVERYTHING
// ============================================

function disconnectEverything() {

    if (currentCall) {

        try {

            currentCall.close();

        } catch (error) {}

        currentCall = null;

    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(track => {

                track.stop();

            });

        localStream = null;

    }


    if (peer) {

        try {

            peer.destroy();

        } catch (error) {}

        peer = null;

    }


    localVideo.srcObject =
        null;

    remoteVideo.srcObject =
        null;


    cameraScreen
        .classList
        .add("hidden");

    monitorScreen
        .classList
        .add("hidden");

    loginScreen
        .classList
        .remove("hidden");


    passwordInput.value =
        "";

    cameraConnection.textContent =
        "Waiting for monitor...";


    waitingMessage
        .classList
        .remove("hidden");


    monitorLive
        .classList
        .add("hidden");


    setStatus(
        "OFFLINE"
    );

}


// ============================================
// CLOCK
// ============================================

function updateClock() {

    const now =
        new Date();


    const time =
        now.toLocaleTimeString(
            [],
            {
                hour12: false
            }
        );


    document.getElementById(
        "cameraClock"
    ).textContent =
        time;


    document.getElementById(
        "monitorClock"
    ).textContent =
        time;

}


setInterval(
    updateClock,
    1000
);


updateClock();


// ============================================
// CLEANUP WHEN PAGE CLOSES
// ============================================

window.addEventListener(
    "beforeunload",
    () => {

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track =>
                    track.stop()
                );

        }

        if (peer) {

            try {
                peer.destroy();
            } catch (error) {}

        }

    }
);