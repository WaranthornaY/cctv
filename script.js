// ============================================================
// WEB CCTV
//
// PHONE
//   Camera + microphone -> Laptop
//   Receives ATTENTION command
//
// LAPTOP
//   Watches camera
//   ATTENTION -> Phone
//
// NO PUSH TO TALK
// NO INTERCOM
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

const loginScreen =
    document.getElementById("loginScreen");

const cameraScreen =
    document.getElementById("cameraScreen");

const monitorScreen =
    document.getElementById("monitorScreen");

const passwordInput =
    document.getElementById("password");

const cameraButton =
    document.getElementById("cameraButton");

const monitorButton =
    document.getElementById("monitorButton");

const errorBox =
    document.getElementById("error");

const localVideo =
    document.getElementById("localVideo");

const remoteVideo =
    document.getElementById("remoteVideo");

const waitingMessage =
    document.getElementById("waitingMessage");

const statusText =
    document.getElementById("status");

const cameraConnection =
    document.getElementById("cameraConnection");

const monitorLive =
    document.getElementById("monitorLive");

const attentionButton =
    document.getElementById("attentionButton");


// ============================================================
// PASSWORD
// ============================================================

function hashPassword(text) {

    let hash = 2166136261;

    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        hash ^= text.charCodeAt(i);

        hash +=
            (hash << 1) +
            (hash << 4) +
            (hash << 7) +
            (hash << 8) +
            (hash << 24);

    }

    return Math.abs(
        hash >>> 0
    ).toString(36);

}


function getRoomId(password) {

    return "cctv_" +
        hashPassword(password);

}


// ============================================================
// ERROR
// ============================================================

function showError(message) {

    errorBox.textContent =
        message;

}


// ============================================================
// STATUS
// ============================================================

function setStatus(
    text,
    online = false
) {

    statusText.textContent =
        text;

    if (online) {

        statusText.classList.add(
            "online"
        );

    }

    else {

        statusText.classList.remove(
            "online"
        );

    }

}


// ============================================================
// CAMERA BUTTON
// ============================================================

cameraButton.addEventListener(
    "click",
    async () => {

        const password =
            passwordInput.value.trim();


        if (!password) {

            showError(
                "Enter a password first."
            );

            return;

        }


        if (password.length < 3) {

            showError(
                "Password must be at least 3 characters."
            );

            return;

        }


        currentRole =
            "camera";


        roomId =
            getRoomId(password);


        showError("");


        loginScreen
            .classList
            .add("hidden");


        cameraScreen
            .classList
            .remove("hidden");


        setStatus(
            "STARTING CAMERA"
        );


        await startCamera();

    }
);


// ============================================================
// MONITOR BUTTON
// ============================================================

monitorButton.addEventListener(
    "click",
    async () => {

        const password =
            passwordInput.value.trim();


        if (!password) {

            showError(
                "Enter a password first."
            );

            return;

        }


        if (password.length < 3) {

            showError(
                "Password must be at least 3 characters."
            );

            return;

        }


        currentRole =
            "monitor";


        roomId =
            getRoomId(password);


        showError("");


        loginScreen
            .classList
            .add("hidden");


        monitorScreen
            .classList
            .remove("hidden");


        setStatus(
            "CONNECTING"
        );


        await startMonitor();

    }
);


// ============================================================
// START PHONE CAMERA
// ============================================================

async function startCamera() {

    try {

        localStream =
            await navigator
                .mediaDevices
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


        localVideo.srcObject =
            localStream;


        // Prepare audio after the user
        // clicked the Camera button.

        await preparePhoneAudio();


        setStatus(
            "WAITING",
            true
        );


        cameraConnection.textContent =
            "Waiting for monitor...";


        createCameraPeer();

    }

    catch (error) {

        console.error(
            "Camera error:",
            error
        );


        setStatus(
            "CAMERA ERROR"
        );


        cameraConnection.textContent =
            "Could not access camera.";


        alert(
            "Could not access the camera.\n\n" +
            "Please allow camera and microphone access."
        );

    }

}


// ============================================================
// PREPARE PHONE AUDIO
// ============================================================

async function preparePhoneAudio() {

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContext) {

            console.log(
                "Web Audio is not supported."
            );

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


        console.log(
            "Phone audio ready."
        );

    }

    catch (error) {

        console.error(
            "Audio initialization error:",
            error
        );

    }

}


// ============================================================
// PHONE PEER
// ============================================================

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


    peer.on(
        "open",
        id => {

            console.log(
                "Camera ready:",
                id
            );


            setStatus(
                "WAITING",
                true
            );

        }
    );


    // ========================================================
    // MEDIA CALL
    // ========================================================

    peer.on(
        "call",
        call => {

            console.log(
                "Laptop connected."
            );


            currentCall =
                call;


            // Send camera + microphone

            call.answer(
                localStream
            );


            cameraConnection.textContent =
                "Laptop connected";


            setStatus(
                "LIVE",
                true
            );


            call.on(
                "close",
                () => {

                    currentCall =
                        null;


                    setStatus(
                        "WAITING",
                        true
                    );


                    cameraConnection.textContent =
                        "Laptop disconnected.";

                }
            );


            call.on(
                "error",
                error => {

                    console.error(
                        "Call error:",
                        error
                    );

                }
            );

        }
    );


    // ========================================================
    // DATA CONNECTION
    // ========================================================

    peer.on(
        "connection",
        connection => {

            console.log(
                "Laptop control connection."
            );


            controlConnection =
                connection;


            connection.on(
                "open",
                () => {

                    console.log(
                        "Control channel ready."
                    );


                    connection.send({

                        type:
                            "PHONE_READY"

                    });

                }
            );


            connection.on(
                "data",
                data => {

                    handleCommand(
                        data
                    );

                }
            );


            connection.on(
                "close",
                () => {

                    controlConnection =
                        null;

                }
            );

        }
    );


    peer.on(
        "error",
        error => {

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

                setStatus(
                    "BUSY"
                );

            }

            else {

                setStatus(
                    "ERROR"
                );

            }

        }
    );


    peer.on(
        "disconnected",
        () => {

            setStatus(
                "DISCONNECTED"
            );

        }
    );

}


// ============================================================
// PHONE COMMAND HANDLER
// ============================================================

function handleCommand(data) {

    if (!data) {
        return;
    }


    console.log(
        "Command received:",
        data
    );


    if (
        data.type ===
        "ATTENTION"
    ) {

        attentionAlert();

    }

}


// ============================================================
// ATTENTION
// ============================================================

async function attentionAlert() {

    console.log(
        "⚠️ ATTENTION RECEIVED"
    );


    // Make both happen.

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


        beep(
            880,
            0
        );


        beep(
            880,
            180
        );


        beep(
            1100,
            360
        );


        console.log(
            "Attention sound played."
        );

    }

    catch (error) {

        console.error(
            "Beep failed:",
            error
        );

    }

}


// ============================================================
// CREATE BEEP
// ============================================================

function beep(
    frequency,
    delay
) {

    setTimeout(
        () => {

            if (!phoneAudioContext) {
                return;
            }


            const oscillator =
                phoneAudioContext
                    .createOscillator();


            const gain =
                phoneAudioContext
                    .createGain();


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


            oscillator.connect(
                gain
            );


            gain.connect(
                phoneAudioContext.destination
            );


            oscillator.start();


            oscillator.stop(
                phoneAudioContext.currentTime +
                0.19
            );

        },
        delay
    );

}


// ============================================================
// FLASH PHONE
// ============================================================

async function flashPhone() {

    if (!localStream) {

        console.log(
            "No camera stream."
        );

        return;

    }


    const tracks =
        localStream
            .getVideoTracks();


    if (!tracks.length) {

        console.log(
            "No video track."
        );

        return;

    }


    const track =
        tracks[0];


    // Get camera capabilities.

    let capabilities = {};


    if (
        typeof track.getCapabilities ===
        "function"
    ) {

        capabilities =
            track.getCapabilities();

    }


    console.log(
        "Camera capabilities:",
        capabilities
    );


    if (
        !capabilities.torch
    ) {

        console.log(
            "This phone/browser does not expose torch control."
        );

        return;

    }


    try {

        // FLASH ON

        await track.applyConstraints({

            advanced: [
                {
                    torch: true
                }
            ]

        });


        await sleep(250);


        // FLASH OFF

        await track.applyConstraints({

            advanced: [
                {
                    torch: false
                }
            ]

        });


        console.log(
            "🔦 Flash complete."
        );

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

    return new Promise(
        resolve => {

            setTimeout(
                resolve,
                ms
            );

        }
    );

}


// ============================================================
// START LAPTOP MONITOR
// ============================================================

async function startMonitor() {

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


    peer.on(
        "open",
        () => {

            console.log(
                "Monitor ready."
            );


            setStatus(
                "SEARCHING",
                true
            );


            connectToCamera();

        }
    );


    peer.on(
        "error",
        error => {

            console.error(
                "Monitor error:",
                error
            );


            setStatus(
                "ERROR"
            );

        }
    );


    peer.on(
        "disconnected",
        () => {

            setStatus(
                "DISCONNECTED"
            );

        }
    );

}


// ============================================================
// CONNECT LAPTOP TO CAMERA
// ============================================================

function connectToCamera() {

    const cameraPeerId =
        roomId + "_camera";


    console.log(
        "Connecting to:",
        cameraPeerId
    );


    // ========================================================
    // MEDIA
    // ========================================================

    currentCall =
        peer.call(
            cameraPeerId,

            // No laptop microphone!
            // We don't need it anymore.
            undefined
        );


    if (!currentCall) {

        setTimeout(
            connectToCamera,
            2000
        );

        return;

    }


    currentCall.on(
        "stream",
        stream => {

            console.log(
                "CCTV stream received."
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

        }
    );


    currentCall.on(
        "close",
        () => {

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

        }
    );


    currentCall.on(
        "error",
        error => {

            console.error(
                "Media error:",
                error
            );

        }
    );


    // ========================================================
    // CONTROL CHANNEL
    // ========================================================

    controlConnection =
        peer.connect(
            cameraPeerId,
            {
                reliable: true
            }
        );


    controlConnection.on(
        "open",
        () => {

            console.log(
                "Attention control ready."
            );

        }
    );


    controlConnection.on(
        "data",
        data => {

            console.log(
                "Control response:",
                data
            );

        }
    );


    controlConnection.on(
        "close",
        () => {

            console.log(
                "Control connection closed."
            );

        }
    );

}


// ============================================================
// ATTENTION BUTTON
// ============================================================

attentionButton.addEventListener(
    "click",
    () => {

        sendAttention();

    }
);


// ============================================================
// SEND ATTENTION
// ============================================================

function sendAttention() {

    if (
        !controlConnection ||
        !controlConnection.open
    ) {

        console.log(
            "Phone is not connected."
        );


        attentionButton.textContent =
            "❌ NOT CONNECTED";


        setTimeout(
            () => {

                attentionButton.textContent =
                    "⚠️ ATTENTION";

            },
            1000
        );


        return;

    }


    console.log(
        "Sending ATTENTION."
    );


    controlConnection.send({

        type:
            "ATTENTION",

        timestamp:
            Date.now()

    });


    attentionButton
        .classList
        .add("active");


    attentionButton.textContent =
        "⚠️ SENT";


    setTimeout(
        () => {

            attentionButton
                .classList
                .remove("active");


            attentionButton.textContent =
                "⚠️ ATTENTION";

        },
        700
    );

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


            const oldStream =
                localStream;


            oldStream
                .getVideoTracks()
                .forEach(
                    track => {

                        track.stop();

                    }
                );


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

                    const senders =
                        currentCall
                            .peerConnection
                            .getSenders();


                    const videoTrack =
                        newStream
                            .getVideoTracks()[0];


                    const audioTrack =
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
                                    videoTrack
                                );

                        }


                        if (
                            sender.track &&
                            sender.track.kind ===
                            "audio"
                        ) {

                            await sender
                                .replaceTrack(
                                    audioTrack
                                );

                        }

                    }

                }


                console.log(
                    "Camera switched."
                );

            }

            catch (error) {

                console.error(
                    "Camera switch failed:",
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
// CAMERA DISCONNECT
// ============================================================

document
    .getElementById("cameraStop")
    .addEventListener(
        "click",
        () => {

            disconnectEverything();

        }
    );


// ============================================================
// MONITOR DISCONNECT
// ============================================================

document
    .getElementById("monitorStop")
    .addEventListener(
        "click",
        () => {

            disconnectEverything();

        }
    );


// ============================================================
// DISCONNECT
// ============================================================

function disconnectEverything() {

    if (controlConnection) {

        try {

            controlConnection.close();

        }

        catch (error) {}

        controlConnection =
            null;

    }


    if (currentCall) {

        try {

            currentCall.close();

        }

        catch (error) {}

        currentCall =
            null;

    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    track.stop();

                }
            );

        localStream =
            null;

    }


    if (peer) {

        try {

            peer.destroy();

        }

        catch (error) {}

        peer =
            null;

    }


    if (phoneAudioContext) {

        try {

            phoneAudioContext.close();

        }

        catch (error) {}

        phoneAudioContext =
            null;

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


    attentionButton
        .classList
        .remove("active");


    attentionButton.textContent =
        "⚠️ ATTENTION";


    setStatus(
        "OFFLINE"
    );

}


// ============================================================
// CLOCK
// ============================================================

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


// ============================================================
// CLEANUP
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (localStream) {

            localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        if (peer) {

            try {

                peer.destroy();

            }

            catch (error) {}

        }

    }
);