// ============================================================
// WEB CCTV - ROBUST CONNECTION VERSION
// ============================================================

let peer = null;
let localStream = null;
let currentCall = null;
let controlConnection = null;

let roomId = null;
let currentRole = null;
let usingFrontCamera = false;

let phoneAudioContext = null;

let reconnectTimer = null;
let connectionStarted = false;


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
// PASSWORD HASH
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
// STATUS
// ============================================================

function setStatus(text, online = false) {

    statusText.textContent = text;

    statusText.classList.toggle(
        "online",
        online
    );

}


// ============================================================
// ERROR
// ============================================================

function showError(text) {

    errorBox.textContent = text;

}


// ============================================================
// CAMERA LOGIN
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


        currentRole = "camera";

        roomId = getRoomId(password);


        console.log(
            "CAMERA ROOM:",
            roomId
        );


        loginScreen.classList.add("hidden");
        cameraScreen.classList.remove("hidden");


        setStatus(
            "STARTING CAMERA"
        );


        await startCamera();

    }
);


// ============================================================
// MONITOR LOGIN
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


        currentRole = "monitor";

        roomId = getRoomId(password);


        console.log(
            "MONITOR ROOM:",
            roomId
        );


        loginScreen.classList.add("hidden");
        monitorScreen.classList.remove("hidden");


        setStatus(
            "STARTING"
        );


        startMonitor();

    }
);


// ============================================================
// START CAMERA
// ============================================================

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


        await preparePhoneAudio();


        createCameraPeer();

    }

    catch (error) {

        console.error(
            "CAMERA ERROR:",
            error
        );


        setStatus(
            "CAMERA ERROR"
        );


        cameraConnection.textContent =
            "Camera permission failed.";


        alert(
            "Camera access failed.\n\n" +
            "Please allow camera and microphone."
        );

    }

}


// ============================================================
// CREATE CAMERA PEER
// ============================================================

function createCameraPeer() {

    const cameraPeerId =
        roomId + "_camera";


    console.log(
        "PHONE PEER ID:",
        cameraPeerId
    );


    peer =
        new Peer(
            cameraPeerId,
            {
                host: "0.peerjs.com",
                port: 443,
                path: "/",
                secure: true,
                debug: 2
            }
        );


    peer.on(
        "open",
        id => {

            console.log(
                "================================"
            );

            console.log(
                "PHONE PEER READY"
            );

            console.log(
                "ID:",
                id
            );

            console.log(
                "================================"
            );


            setStatus(
                "WAITING FOR LAPTOP",
                true
            );


            cameraConnection.textContent =
                "Waiting for laptop...";

        }
    );


    // ========================================================
    // LAPTOP CONTROL CONNECTION
    // ========================================================

    peer.on(
        "connection",
        connection => {

            console.log(
                "LAPTOP FOUND!"
            );


            controlConnection =
                connection;


            connection.on(
                "open",
                () => {

                    console.log(
                        "CONTROL CONNECTION OPEN"
                    );


                    connection.send({
                        type:
                            "PHONE_READY"
                    });


                    cameraConnection.textContent =
                        "Laptop connected";


                    setStatus(
                        "CONNECTING VIDEO",
                        true
                    );


                    // Wait a tiny moment before
                    // starting the video call.

                    setTimeout(
                        () => {

                            startVideoCall(
                                connection
                            );

                        },
                        300
                    );

                }
            );


            connection.on(
                "data",
                data => {

                    console.log(
                        "COMMAND:",
                        data
                    );


                    handleCommand(
                        data
                    );

                }
            );


            connection.on(
                "close",
                () => {

                    console.log(
                        "CONTROL CONNECTION CLOSED"
                    );


                    controlConnection =
                        null;


                    if (currentCall) {

                        try {
                            currentCall.close();
                        }
                        catch (e) {}

                        currentCall = null;

                    }


                    setStatus(
                        "WAITING FOR LAPTOP",
                        true
                    );


                    cameraConnection.textContent =
                        "Waiting for laptop...";

                }
            );


            connection.on(
                "error",
                error => {

                    console.error(
                        "CONTROL ERROR:",
                        error
                    );

                }
            );

        }
    );


    // ========================================================
    // PEER ERROR
    // ========================================================

    peer.on(
        "error",
        error => {

            console.error(
                "================================"
            );

            console.error(
                "PHONE PEER ERROR:",
                error
            );

            console.error(
                "================================"
            );


            if (
                error.type ===
                "unavailable-id"
            ) {

                cameraConnection.textContent =
                    "Camera ID is already in use.";

            }


            setStatus(
                "PEER ERROR"
            );

        }
    );


    peer.on(
        "disconnected",
        () => {

            console.log(
                "PHONE PEER DISCONNECTED"
            );


            setStatus(
                "DISCONNECTED"
            );

        }
    );

}


// ============================================================
// PHONE SENDS VIDEO
// ============================================================

function startVideoCall(connection) {

    if (!peer) {

        console.error(
            "No peer."
        );

        return;
    }


    if (!localStream) {

        console.error(
            "No camera stream."
        );

        return;
    }


    const laptopId =
        connection.peer;


    console.log(
        "CALLING LAPTOP:",
        laptopId
    );


    currentCall =
        peer.call(
            laptopId,
            localStream
        );


    if (!currentCall) {

        console.error(
            "VIDEO CALL FAILED"
        );

        return;
    }


    currentCall.on(
        "close",
        () => {

            console.log(
                "VIDEO CALL CLOSED"
            );


            currentCall =
                null;


            setStatus(
                "WAITING FOR LAPTOP",
                true
            );

        }
    );


    currentCall.on(
        "error",
        error => {

            console.error(
                "VIDEO CALL ERROR:",
                error
            );

        }
    );

}


// ============================================================
// START MONITOR
// ============================================================

function startMonitor() {

    const monitorPeerId =
        roomId +
        "_monitor_" +
        Math.random()
            .toString(36)
            .substring(2, 10);


    console.log(
        "LAPTOP PEER ID:",
        monitorPeerId
    );


    peer =
        new Peer(
            monitorPeerId,
            {
                host: "0.peerjs.com",
                port: 443,
                path: "/",
                secure: true,
                debug: 2
            }
        );


    peer.on(
        "open",
        id => {

            console.log(
                "================================"
            );

            console.log(
                "LAPTOP PEER READY"
            );

            console.log(
                "ID:",
                id
            );

            console.log(
                "================================"
            );


            setStatus(
                "SEARCHING FOR CAMERA",
                true
            );


            beginSearching();

        }
    );


    // ========================================================
    // RECEIVE VIDEO CALL
    // ========================================================

    peer.on(
        "call",
        call => {

            console.log(
                "================================"
            );

            console.log(
                "INCOMING CAMERA VIDEO"
            );

            console.log(
                "FROM:",
                call.peer
            );

            console.log(
                "================================"
            );


            currentCall =
                call;


            // Laptop has no media stream.

            call.answer();


            call.on(
                "stream",
                stream => {

                    console.log(
                        "VIDEO STREAM RECEIVED!"
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


            call.on(
                "close",
                () => {

                    console.log(
                        "VIDEO CALL CLOSED"
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

                }
            );


            call.on(
                "error",
                error => {

                    console.error(
                        "INCOMING CALL ERROR:",
                        error
                    );

                }
            );

        }
    );


    peer.on(
        "error",
        error => {

            console.error(
                "================================"
            );

            console.error(
                "LAPTOP PEER ERROR:",
                error
            );

            console.error(
                "================================"
            );


            setStatus(
                "SEARCHING AGAIN"
            );


            // Keep searching.

            scheduleReconnect();

        }
    );


    peer.on(
        "disconnected",
        () => {

            console.log(
                "LAPTOP PEER DISCONNECTED"
            );


            setStatus(
                "DISCONNECTED"
            );

        }
    );

}


// ============================================================
// SEARCH FOR PHONE
// ============================================================

function beginSearching() {

    connectionStarted = false;


    tryConnectToCamera();

}


// ============================================================
// CONNECT TO CAMERA
// ============================================================

function tryConnectToCamera() {

    if (
        currentRole !== "monitor"
    ) {
        return;
    }


    if (!peer) {
        return;
    }


    if (peer.destroyed) {
        return;
    }


    if (
        controlConnection &&
        controlConnection.open
    ) {

        console.log(
            "Already connected."
        );

        return;

    }


    const cameraPeerId =
        roomId + "_camera";


    console.log(
        "Trying camera:",
        cameraPeerId
    );


    setStatus(
        "SEARCHING FOR CAMERA",
        true
    );


    const connection =
        peer.connect(
            cameraPeerId,
            {
                reliable: true
            }
        );


    controlConnection =
        connection;


    let opened = false;


    connection.on(
        "open",
        () => {

            opened = true;


            console.log(
                "================================"
            );

            console.log(
                "CAMERA CONTROL CONNECTED!"
            );

            console.log(
                "================================"
            );


            connectionStarted = true;


            setStatus(
                "CAMERA FOUND",
                true
            );


            connection.send({
                type:
                    "LAPTOP_READY"
            });

        }
    );


    connection.on(
        "data",
        data => {

            console.log(
                "PHONE RESPONSE:",
                data
            );

        }
    );


    connection.on(
        "close",
        () => {

            console.log(
                "CONTROL CONNECTION CLOSED"
            );


            if (
                controlConnection ===
                connection
            ) {

                controlConnection =
                    null;

            }


            if (currentRole === "monitor") {

                scheduleReconnect();

            }

        }
    );


    connection.on(
        "error",
        error => {

            console.error(
                "CONTROL CONNECTION ERROR:",
                error
            );


            if (!opened) {

                if (
                    controlConnection ===
                    connection
                ) {

                    controlConnection =
                        null;

                }


                scheduleReconnect();

            }

        }
    );

}


// ============================================================
// RETRY CONNECTION
// ============================================================

function scheduleReconnect() {

    if (
        currentRole !== "monitor"
    ) {
        return;
    }


    if (reconnectTimer) {
        return;
    }


    console.log(
        "Retrying in 1.5 seconds..."
    );


    reconnectTimer =
        setTimeout(
            () => {

                reconnectTimer =
                    null;


                tryConnectToCamera();

            },
            1500
        );

}


// ============================================================
// ATTENTION BUTTON
// ============================================================

attentionButton.addEventListener(
    "click",
    sendAttention
);


function sendAttention() {

    console.log(
        "ATTENTION BUTTON PRESSED"
    );


    if (
        !controlConnection ||
        !controlConnection.open
    ) {

        console.log(
            "PHONE NOT CONNECTED"
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
        "SENDING ATTENTION TO PHONE"
    );


    controlConnection.send({

        type:
            "ATTENTION",

        timestamp:
            Date.now()

    });


    attentionButton.classList.add(
        "active"
    );


    attentionButton.textContent =
        "⚠️ SENT";


    setTimeout(
        () => {

            attentionButton.classList.remove(
                "active"
            );


            attentionButton.textContent =
                "⚠️ ATTENTION";

        },
        700
    );

}


// ============================================================
// PHONE COMMANDS
// ============================================================

function handleCommand(data) {

    if (!data) {
        return;
    }


    if (
        data.type ===
        "ATTENTION"
    ) {

        attentionAlert();

    }

}


// ============================================================
// AUDIO
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
            "AUDIO ERROR:",
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
// SOUND
// ============================================================

async function playAttentionSound() {

    if (!phoneAudioContext) {

        await preparePhoneAudio();

    }


    if (!phoneAudioContext) {
        return;
    }


    try {

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
            "BEEP ERROR:",
            error
        );

    }

}


// ============================================================
// BEEP
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
                phoneAudioContext.currentTime +
                0.01
            );


            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                phoneAudioContext.currentTime +
                0.18
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

        },
        delay
    );

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
        "TORCH SUPPORT:",
        capabilities.torch
    );


    if (!capabilities.torch) {

        console.log(
            "Phone does not expose torch control."
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


        console.log(
            "FLASH COMPLETE"
        );

    }

    catch (error) {

        console.error(
            "FLASH ERROR:",
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


            const oldTrack =
                localStream
                    .getVideoTracks()[0];


            if (oldTrack) {
                oldTrack.stop();
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
                    "SWITCH CAMERA ERROR:",
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
// DISCONNECT
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


function disconnectEverything() {

    currentRole = null;


    if (reconnectTimer) {

        clearTimeout(
            reconnectTimer
        );

        reconnectTimer = null;

    }


    if (controlConnection) {

        try {
            controlConnection.close();
        }
        catch (e) {}

        controlConnection = null;

    }


    if (currentCall) {

        try {
            currentCall.close();
        }
        catch (e) {}

        currentCall = null;

    }


    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        localStream = null;

    }


    if (peer) {

        try {
            peer.destroy();
        }
        catch (e) {}

        peer = null;

    }


    localVideo.srcObject = null;
    remoteVideo.srcObject = null;


    cameraScreen.classList.add(
        "hidden"
    );

    monitorScreen.classList.add(
        "hidden"
    );

    loginScreen.classList.remove(
        "hidden"
    );


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


    setStatus(
        "OFFLINE"
    );

}


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

    const time =
        new Date().toLocaleTimeString(
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
                .forEach(
                    track => track.stop()
                );

        }


        if (peer) {

            try {
                peer.destroy();
            }
            catch (e) {}

        }

    }
);