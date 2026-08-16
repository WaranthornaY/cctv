// ============================================================
// WEB CCTV
// ============================================================

let peer = null;
let localStream = null;
let currentCall = null;
let controlConnection = null;

let roomId = null;
let currentRole = null;
let usingFrontCamera = false;

let phoneAudioContext = null;


// ============================================================
// ELEMENTS
// ============================================================

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

const cameraConnection = document.getElementById("cameraConnection");
const monitorLive = document.getElementById("monitorLive");

const attentionButton =
    document.getElementById("attentionButton");


// ============================================================
// PASSWORD -> ROOM ID
// ============================================================

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


// ============================================================
// ERROR
// ============================================================

function showError(message) {

    errorBox.textContent = message;

}


// ============================================================
// STATUS
// ============================================================

function setStatus(text, online = false) {

    statusText.textContent = text;

    if (online) {
        statusText.classList.add("online");
    } else {
        statusText.classList.remove("online");
    }

}


// ============================================================
// CAMERA LOGIN
// ============================================================

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


// ============================================================
// MONITOR LOGIN
// ============================================================

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

    setStatus("STARTING");

    await startMonitor();

});


// ============================================================
// START PHONE CAMERA
// ============================================================

async function startCamera() {

    try {

        localStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: {
                        ideal: usingFrontCamera
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


        await preparePhoneAudio();


        createCameraPeer();


        setStatus(
            "WAITING FOR LAPTOP",
            true
        );


        cameraConnection.textContent =
            "Waiting for laptop...";

    }

    catch (error) {

        console.error(error);

        setStatus("CAMERA ERROR");

        cameraConnection.textContent =
            "Camera permission failed.";

        alert(
            "Could not access the camera.\n\n" +
            "Please allow camera and microphone access."
        );

    }

}


// ============================================================
// PHONE PEER
// ============================================================

function createCameraPeer() {

    const cameraPeerId =
        roomId + "_camera";


    console.log(
        "Creating camera Peer:",
        cameraPeerId
    );


    peer = new Peer(cameraPeerId, {
        debug: 1
    });


    peer.on("open", id => {

        console.log(
            "PHONE PEER READY:",
            id
        );

        setStatus(
            "WAITING FOR LAPTOP",
            true
        );

    });


    // ========================================================
    // LAPTOP CONNECTS
    // ========================================================

    peer.on("connection", connection => {

        console.log(
            "LAPTOP CONTROL CONNECTED"
        );


        controlConnection =
            connection;


        cameraConnection.textContent =
            "Laptop connected";


        setStatus(
            "CONNECTING VIDEO",
            true
        );


        connection.on("open", () => {

            console.log(
                "Control channel open."
            );


            // Tell laptop that the phone is ready.

            connection.send({
                type: "PHONE_READY"
            });


            // IMPORTANT:
            // Phone starts the video call.
            // Laptop does NOT need a camera/microphone.

            startVideoCall(connection);

        });


        connection.on("data", data => {

            console.log(
                "COMMAND FROM LAPTOP:",
                data
            );


            handleCommand(data);

        });


        connection.on("close", () => {

            console.log(
                "Laptop disconnected."
            );


            controlConnection = null;

            if (currentCall) {

                try {
                    currentCall.close();
                } catch (e) {}

                currentCall = null;
            }


            setStatus(
                "WAITING FOR LAPTOP",
                true
            );


            cameraConnection.textContent =
                "Waiting for laptop...";

        });

    });


    peer.on("error", error => {

        console.error(
            "PHONE PEER ERROR:",
            error
        );


        setStatus("PEER ERROR");

    });


    peer.on("disconnected", () => {

        console.log(
            "Phone Peer disconnected."
        );

        setStatus("DISCONNECTED");

    });

}


// ============================================================
// PHONE STARTS VIDEO CALL
// ============================================================

function startVideoCall(connection) {

    if (!localStream) {

        console.error(
            "No camera stream."
        );

        return;
    }


    const laptopPeerId =
        connection.peer;


    console.log(
        "Calling laptop:",
        laptopPeerId
    );


    currentCall =
        peer.call(
            laptopPeerId,
            localStream
        );


    if (!currentCall) {

        console.error(
            "Could not create video call."
        );

        return;
    }


    currentCall.on("close", () => {

        console.log(
            "Video call closed."
        );

        currentCall = null;

        setStatus(
            "LAPTOP DISCONNECTED",
            true
        );

        cameraConnection.textContent =
            "Waiting for laptop...";

    });


    currentCall.on("error", error => {

        console.error(
            "Video call error:",
            error
        );

    });

}


// ============================================================
// START LAPTOP
// ============================================================

async function startMonitor() {

    const monitorPeerId =
        roomId +
        "_monitor_" +
        Math.random()
            .toString(36)
            .substring(2, 10);


    console.log(
        "Creating monitor Peer:",
        monitorPeerId
    );


    peer = new Peer(monitorPeerId, {
        debug: 1
    });


    peer.on("open", () => {

        console.log(
            "LAPTOP PEER READY:",
            monitorPeerId
        );


        setStatus(
            "SEARCHING FOR CAMERA",
            true
        );


        connectToCamera();

    });


    // ========================================================
    // LAPTOP RECEIVES VIDEO
    // ========================================================

    peer.on("call", call => {

        console.log(
            "INCOMING VIDEO CALL FROM PHONE:",
            call.peer
        );


        currentCall = call;


        // We don't send anything back.

        call.answer();


        call.on("stream", stream => {

            console.log(
                "CCTV VIDEO RECEIVED"
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

            console.log(
                "Video call closed."
            );


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
                "Incoming call error:",
                error
            );

        });

    });


    peer.on("error", error => {

        console.error(
            "LAPTOP PEER ERROR:",
            error
        );


        setStatus(
            "ERROR"
        );

    });

}


// ============================================================
// CONNECT LAPTOP -> PHONE
// ============================================================

function connectToCamera() {

    const cameraPeerId =
        roomId + "_camera";


    console.log(
        "Connecting control channel to:",
        cameraPeerId
    );


    controlConnection =
        peer.connect(
            cameraPeerId,
            {
                reliable: true
            }
        );


    controlConnection.on("open", () => {

        console.log(
            "CONTROL CHANNEL CONNECTED"
        );


        setStatus(
            "CONNECTED",
            true
        );


        controlConnection.send({
            type: "LAPTOP_READY"
        });

    });


    controlConnection.on("data", data => {

        console.log(
            "PHONE RESPONSE:",
            data
        );


        if (
            data &&
            data.type === "PHONE_READY"
        ) {

            console.log(
                "PHONE IS READY."
            );

        }

    });


    controlConnection.on("close", () => {

        console.log(
            "Control channel closed."
        );


        controlConnection = null;


        setStatus(
            "CAMERA OFFLINE"
        );


        // Try again.

        setTimeout(() => {

            if (
                currentRole === "monitor" &&
                peer &&
                !peer.destroyed
            ) {

                connectToCamera();

            }

        }, 2000);

    });


    controlConnection.on("error", error => {

        console.error(
            "Control connection error:",
            error
        );

    });

}


// ============================================================
// ATTENTION
// ============================================================

attentionButton.addEventListener(
    "click",
    sendAttention
);


function sendAttention() {

    if (
        !controlConnection ||
        !controlConnection.open
    ) {

        console.log(
            "PHONE IS NOT CONNECTED."
        );


        attentionButton.textContent =
            "❌ NOT CONNECTED";


        setTimeout(() => {

            attentionButton.textContent =
                "⚠️ ATTENTION";

        }, 1000);


        return;
    }


    console.log(
        "SENDING ATTENTION"
    );


    controlConnection.send({

        type: "ATTENTION",

        timestamp: Date.now()

    });


    attentionButton.classList.add(
        "active"
    );


    attentionButton.textContent =
        "⚠️ SENT";


    setTimeout(() => {

        attentionButton.classList.remove(
            "active"
        );


        attentionButton.textContent =
            "⚠️ ATTENTION";

    }, 700);

}


// ============================================================
// PHONE COMMAND HANDLER
// ============================================================

function handleCommand(data) {

    if (!data) {
        return;
    }


    if (
        data.type === "ATTENTION"
    ) {

        attentionAlert();

    }

}


// ============================================================
// PHONE AUDIO
// ============================================================

async function preparePhoneAudio() {

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContext) {
            return;
        }


        phoneAudioContext =
            new AudioContext();


        if (
            phoneAudioContext.state ===
            "suspended"
        ) {

            await phoneAudioContext.resume();

        }

    }

    catch (error) {

        console.error(
            "Audio error:",
            error
        );

    }

}


// ============================================================
// ATTENTION ALERT
// ============================================================

async function attentionAlert() {

    console.log(
        "⚠️ ATTENTION RECEIVED"
    );


    await playAttentionSound();

    await flashPhone();

}


// ============================================================
// BEEP
// ============================================================

async function playAttentionSound() {

    try {

        if (!phoneAudioContext) {

            await preparePhoneAudio();

        }


        if (!phoneAudioContext) {
            return;
        }


        if (
            phoneAudioContext.state ===
            "suspended"
        ) {

            await phoneAudioContext.resume();

        }


        beep(880, 0);
        beep(880, 180);
        beep(1100, 360);

    }

    catch (error) {

        console.error(
            "Beep error:",
            error
        );

    }

}


// ============================================================
// BEEP FUNCTION
// ============================================================

function beep(
    frequency,
    delay
) {

    setTimeout(() => {

        if (!phoneAudioContext) {
            return;
        }


        const oscillator =
            phoneAudioContext.createOscillator();


        const gain =
            phoneAudioContext.createGain();


        oscillator.type =
            "sine";


        oscillator.frequency.value =
            frequency;


        gain.gain.setValueAtTime(
            0.0001,
            phoneAudioContext.currentTime
        );


        gain.gain.exponentialRampToValueAtTime(
            0.5,
            phoneAudioContext.currentTime + 0.01
        );


        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            phoneAudioContext.currentTime + 0.18
        );


        oscillator.connect(gain);

        gain.connect(
            phoneAudioContext.destination
        );


        oscillator.start();


        oscillator.stop(
            phoneAudioContext.currentTime +
            0.19
        );

    }, delay);

}


// ============================================================
// FLASHLIGHT
// ============================================================

async function flashPhone() {

    if (!localStream) {
        return;
    }


    const tracks =
        localStream.getVideoTracks();


    if (!tracks.length) {
        return;
    }


    const track =
        tracks[0];


    if (
        typeof track.getCapabilities !==
        "function"
    ) {

        console.log(
            "Torch API unavailable."
        );

        return;
    }


    const capabilities =
        track.getCapabilities();


    console.log(
        "Torch:",
        capabilities.torch
    );


    if (!capabilities.torch) {

        console.log(
            "This browser does not support flashlight control."
        );

        return;
    }


    try {

        await track.applyConstraints({

            advanced: [
                {
                    torch: true
                }
            ]

        });


        await sleep(250);


        await track.applyConstraints({

            advanced: [
                {
                    torch: false
                }
            ]

        });

    }

    catch (error) {

        console.error(
            "Flashlight error:",
            error
        );

    }

}


// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {

    return new Promise(resolve => {

        setTimeout(
            resolve,
            ms
        );

    });

}


// ============================================================
// SWITCH CAMERA
// ============================================================

document
    .getElementById("flipCamera")
    .addEventListener(
        "click",
        async () => {

            if (!localStream) {
                return;
            }


            usingFrontCamera =
                !usingFrontCamera;


            const oldVideoTrack =
                localStream
                    .getVideoTracks()[0];


            if (oldVideoTrack) {
                oldVideoTrack.stop();
            }


            try {

                const newStream =
                    await navigator
                        .mediaDevices
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


                if (
                    currentCall &&
                    currentCall.peerConnection
                ) {

                    const videoTrack =
                        newStream
                            .getVideoTracks()[0];


                    const audioTrack =
                        newStream
                            .getAudioTracks()[0];


                    const senders =
                        currentCall
                            .peerConnection
                            .getSenders();


                    for (
                        const sender of senders
                    ) {

                        if (
                            sender.track &&
                            sender.track.kind ===
                            "video"
                        ) {

                            await sender.replaceTrack(
                                videoTrack
                            );

                        }


                        if (
                            sender.track &&
                            sender.track.kind ===
                            "audio"
                        ) {

                            await sender.replaceTrack(
                                audioTrack
                            );

                        }

                    }

                }

            }

            catch (error) {

                console.error(
                    "Camera switch error:",
                    error
                );


                usingFrontCamera =
                    !usingFrontCamera;


                alert(
                    "Could not switch camera."
                );

            }

        }
    );


// ============================================================
// FULLSCREEN
// ============================================================

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

            }

            else if (
                container.webkitRequestFullscreen
            ) {

                container.webkitRequestFullscreen();

            }

        }
    );


// ============================================================
// DISCONNECT BUTTONS
// ============================================================

document
    .getElementById("cameraStop")
    .addEventListener(
        "click",
        disconnectEverything
    );


document
    .getElementById("monitorStop")
    .addEventListener(
        "click",
        disconnectEverything
    );


// ============================================================
// DISCONNECT
// ============================================================

function disconnectEverything() {

    if (controlConnection) {

        try {
            controlConnection.close();
        } catch (e) {}

        controlConnection = null;
    }


    if (currentCall) {

        try {
            currentCall.close();
        } catch (e) {}

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
        } catch (e) {}

        peer = null;
    }


    localVideo.srcObject = null;
    remoteVideo.srcObject = null;


    cameraScreen.classList.add("hidden");
    monitorScreen.classList.add("hidden");

    loginScreen.classList.remove("hidden");


    passwordInput.value = "";


    waitingMessage.classList.remove(
        "hidden"
    );


    monitorLive.classList.add(
        "hidden"
    );


    attentionButton.classList.remove(
        "active"
    );


    attentionButton.textContent =
        "⚠️ ATTENTION";


    setStatus("OFFLINE");

}


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

    const now = new Date();


    const time =
        now.toLocaleTimeString(
            [],
            {
                hour12: false
            }
        );


    document.getElementById(
        "cameraClock"
    ).textContent = time;


    document.getElementById(
        "monitorClock"
    ).textContent = time;

}


setInterval(
    updateClock,
    1000
);


updateClock();


// ============================================================
// CLEANUP
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (localStream) {

            localStream
                .getTracks()
                .forEach(track => {
                    track.stop();
                });

        }


        if (peer) {

            try {
                peer.destroy();
            } catch (e) {}

        }

    }
);