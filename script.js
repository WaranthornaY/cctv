// ============================================================
// WEB CCTV
// VIDEO ONLY
// NO MICROPHONE / NO VOICE
// ============================================================


// ============================================================
// VARIABLES
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

let shuttingDown = false;


// ============================================================
// ELEMENTS
// ============================================================

const loginScreen =
    document.getElementById(
        "loginScreen"
    );

const cameraScreen =
    document.getElementById(
        "cameraScreen"
    );

const monitorScreen =
    document.getElementById(
        "monitorScreen"
    );


const passwordInput =
    document.getElementById(
        "password"
    );


const cameraButton =
    document.getElementById(
        "cameraButton"
    );

const monitorButton =
    document.getElementById(
        "monitorButton"
    );


const errorBox =
    document.getElementById(
        "error"
    );


const localVideo =
    document.getElementById(
        "localVideo"
    );

const remoteVideo =
    document.getElementById(
        "remoteVideo"
    );


const waitingMessage =
    document.getElementById(
        "waitingMessage"
    );

const statusText =
    document.getElementById(
        "status"
    );


const cameraConnection =
    document.getElementById(
        "cameraConnection"
    );

const monitorLive =
    document.getElementById(
        "monitorLive"
    );


const attentionButton =
    document.getElementById(
        "attentionButton"
    );


// ============================================================
// PASSWORD HASH
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
// STATUS
// ============================================================

function setStatus(
    text,
    online = false
) {

    if (!statusText) {
        return;
    }

    statusText.textContent =
        text;

    statusText.classList.toggle(
        "online",
        online
    );

}


// ============================================================
// ERROR
// ============================================================

function showError(text) {

    errorBox.textContent =
        text;

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


        currentRole =
            "camera";

        shuttingDown =
            false;

        roomId =
            getRoomId(password);


        console.log(
            "CAMERA ROOM:",
            roomId
        );


        loginScreen.classList.add(
            "hidden"
        );

        cameraScreen.classList.remove(
            "hidden"
        );


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
    () => {

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

        shuttingDown =
            false;

        roomId =
            getRoomId(password);


        console.log(
            "MONITOR ROOM:",
            roomId
        );


        loginScreen.classList.add(
            "hidden"
        );

        monitorScreen.classList.remove(
            "hidden"
        );


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

        // IMPORTANT:
        // VIDEO ONLY.
        // audio:false means NO MICROPHONE.

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

                    audio: false

                });


        localVideo.srcObject =
            localStream;


        cameraConnection.textContent =
            "Camera ready. Waiting for laptop...";


        setStatus(
            "WAITING FOR LAPTOP",
            true
        );


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
            "Please allow camera access."
        );

    }

}


// ============================================================
// CREATE CAMERA PEER
// ============================================================

function createCameraPeer() {

    const cameraPeerId =
        roomId +
        "_camera";


    console.log(
        "PHONE PEER ID:",
        cameraPeerId
    );


    peer =
        new Peer(
            cameraPeerId,
            {

                host:
                    "0.peerjs.com",

                port:
                    443,

                path:
                    "/",

                secure:
                    true,

                debug:
                    2

            }
        );


    // ========================================================
    // PEER OPEN
    // ========================================================

    peer.on(
        "open",
        id => {

            console.log(
                "PHONE PEER READY:",
                id
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
    // LAPTOP CONNECTS
    // ========================================================

    peer.on(
        "connection",
        connection => {

            console.log(
                "LAPTOP CONTROL CONNECTION"
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


                    if (
                        controlConnection ===
                        connection
                    ) {

                        controlConnection =
                            null;

                    }


                    if (currentCall) {

                        try {
                            currentCall.close();
                        }
                        catch (e) {}

                        currentCall =
                            null;

                    }


                    if (!shuttingDown) {

                        setStatus(
                            "WAITING FOR LAPTOP",
                            true
                        );


                        cameraConnection.textContent =
                            "Waiting for laptop...";

                    }

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
                "PHONE PEER ERROR:",
                error
            );


            if (
                error.type ===
                "unavailable-id"
            ) {

                cameraConnection.textContent =
                    "Camera ID already in use.";

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


            if (!shuttingDown) {

                setStatus(
                    "DISCONNECTED"
                );

            }

        }
    );

}


// ============================================================
// CAMERA SENDS VIDEO
// ============================================================

function startVideoCall(
    laptopId
) {

    if (
        !peer ||
        peer.destroyed
    ) {

        console.error(
            "Camera peer unavailable."
        );

        return;

    }


    if (!localStream) {

        console.error(
            "Camera stream unavailable."
        );

        return;

    }


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


            if (!shuttingDown) {

                setStatus(
                    "WAITING FOR LAPTOP",
                    true
                );

            }

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

                host:
                    "0.peerjs.com",

                port:
                    443,

                path:
                    "/",

                secure:
                    true,

                debug:
                    2

            }
        );


    // ========================================================
    // MONITOR PEER OPEN
    // ========================================================

    peer.on(
        "open",
        id => {

            console.log(
                "LAPTOP PEER READY:",
                id
            );


            setStatus(
                "SEARCHING FOR CAMERA",
                true
            );


            beginSearching();

        }
    );


    // ========================================================
    // RECEIVE VIDEO
    // ========================================================

    peer.on(
        "call",
        call => {

            console.log(
                "INCOMING CAMERA VIDEO:",
                call.peer
            );


            currentCall =
                call;


            // IMPORTANT:
            // No microphone stream.
            // We simply answer the call.

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


                    if (!shuttingDown) {

                        setStatus(
                            "CAMERA OFFLINE"
                        );

                    }

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


    // ========================================================
    // PEER ERROR
    // ========================================================

    peer.on(
        "error",
        error => {

            console.error(
                "LAPTOP PEER ERROR:",
                error
            );


            if (!shuttingDown) {

                setStatus(
                    "SEARCHING AGAIN"
                );


                scheduleReconnect();

            }

        }
    );


    peer.on(
        "disconnected",
        () => {

            console.log(
                "LAPTOP PEER DISCONNECTED"
            );


            if (!shuttingDown) {

                setStatus(
                    "DISCONNECTED"
                );

            }

        }
    );

}


// ============================================================
// SEARCH FOR CAMERA
// ============================================================

function beginSearching() {

    tryConnectToCamera();

}


// ============================================================
// CONNECT TO CAMERA
// ============================================================

function tryConnectToCamera() {

    if (
        currentRole !==
        "monitor"
    ) {
        return;
    }


    if (
        shuttingDown
    ) {
        return;
    }


    if (
        !peer ||
        peer.destroyed
    ) {
        return;
    }


    if (
        controlConnection &&
        controlConnection.open
    ) {

        return;

    }


    const cameraPeerId =
        roomId +
        "_camera";


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


    let opened =
        false;


    // ========================================================
    // CONNECTION OPEN
    // ========================================================

    connection.on(
        "open",
        () => {

            opened =
                true;


            console.log(
                "CAMERA CONTROL CONNECTED!"
            );


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


    // ========================================================
    // CAMERA RESPONSE
    // ========================================================

    connection.on(
        "data",
        data => {

            console.log(
                "PHONE RESPONSE:",
                data
            );


            if (
                data &&
                data.type ===
                "PHONE_READY"
            ) {

                console.log(
                    "PHONE IS READY"
                );


                setStatus(
                    "CONNECTING VIDEO",
                    true
                );


                setTimeout(
                    () => {

                        if (
                            controlConnection ===
                            connection &&
                            connection.open
                        ) {

                            startVideoCall(
                                connection.peer
                            );

                        }

                    },
                    300
                );

            }

        }
    );


    // ========================================================
    // CLOSED
    // ========================================================

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


            if (
                !shuttingDown
            ) {

                scheduleReconnect();

            }

        }
    );


    // ========================================================
    // ERROR
    // ========================================================

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
// RETRY
// ============================================================

function scheduleReconnect() {

    if (
        currentRole !==
        "monitor"
    ) {
        return;
    }


    if (
        shuttingDown
    ) {
        return;
    }


    if (
        reconnectTimer
    ) {
        return;
    }


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
            "AUDIO ERROR:",
            error
        );

    }

}


// ============================================================
// ATTENTION
// ============================================================

async function attentionAlert() {

    console.log(
        "⚠️ ATTENTION RECEIVED"
    );


    await preparePhoneAudio();

    await playAttentionSound();

    await flashPhone();

}


// ============================================================
// BEEP
// ============================================================

async function playAttentionSound() {

    if (
        !phoneAudioContext
    ) {
        return;
    }


    try {

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

    }

    catch (error) {

        console.error(
            "BEEP ERROR:",
            error
        );

    }

}


function beep(
    frequency,
    delay
) {

    setTimeout(
        () => {

            if (
                !phoneAudioContext
            ) {
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
// PHONE FLASHLIGHT
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


    if (
        !capabilities.torch
    ) {

        console.log(
            "Torch is not supported."
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


        await sleep(
            250
        );


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
// FLIP CAMERA
// ============================================================

document
    .getElementById("flipCamera")
    .addEventListener(
        "click",
        flipCamera
    );


async function flipCamera() {

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

                    audio: false

                });


        const newVideoTrack =
            newStream
                .getVideoTracks()[0];


        localStream =
            newStream;


        localVideo.srcObject =
            newStream;


        // Replace video track
        // inside the existing call.

        if (
            currentCall &&
            currentCall.peerConnection
        ) {

            const senders =
                currentCall
                    .peerConnection
                    .getSenders();


            for (
                const sender
                of senders
            ) {

                if (
                    sender.track &&
                    sender.track.kind ===
                    "video"
                ) {

                    await sender.replaceTrack(
                        newVideoTrack
                    );

                }

            }

        }


        console.log(
            "CAMERA FLIPPED"
        );

    }

    catch (error) {

        console.error(
            "FLIP CAMERA ERROR:",
            error
        );


        usingFrontCamera =
            !usingFrontCamera;


        // Try restoring the old camera.

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

                            }

                        },

                        audio: false

                    });


            localVideo.srcObject =
                localStream;

        }

        catch (e) {

            console.error(
                "CAMERA RESTORE ERROR:",
                e
            );

        }

    }

}


// ============================================================
// FULLSCREEN
// ============================================================

document
    .getElementById("fullscreen")
    .addEventListener(
        "click",
        async () => {

            const container =
                document.getElementById(
                    "monitorScreen"
                );


            try {

                if (
                    document.fullscreenElement
                ) {

                    await document.exitFullscreen();

                }

                else if (
                    container.requestFullscreen
                ) {

                    await container.requestFullscreen();

                }

            }

            catch (error) {

                console.error(
                    "FULLSCREEN ERROR:",
                    error
                );

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
        disconnectEverything
    );


// ============================================================
// MONITOR DISCONNECT
// ============================================================

document
    .getElementById("monitorStop")
    .addEventListener(
        "click",
        disconnectEverything
    );


// ============================================================
// DISCONNECT EVERYTHING
// ============================================================

function disconnectEverything() {

    console.log(
        "================================"
    );

    console.log(
        "DISCONNECTING EVERYTHING"
    );

    console.log(
        "================================"
    );


    shuttingDown =
        true;

    currentRole =
        null;


    // --------------------------------------------------------
    // Stop reconnect timer
    // --------------------------------------------------------

    if (
        reconnectTimer
    ) {

        clearTimeout(
            reconnectTimer
        );

        reconnectTimer =
            null;

    }


    // --------------------------------------------------------
    // Close video call
    // --------------------------------------------------------

    if (
        currentCall
    ) {

        try {

            currentCall.close();

        }

        catch (error) {

            console.error(
                error
            );

        }

        currentCall =
            null;

    }


    // --------------------------------------------------------
    // Close control connection
    // --------------------------------------------------------

    if (
        controlConnection
    ) {

        try {

            controlConnection.close();

        }

        catch (error) {

            console.error(
                error
            );

        }

        controlConnection =
            null;

    }


    // --------------------------------------------------------
    // STOP ALL CAMERA TRACKS
    // --------------------------------------------------------

    if (
        localStream
    ) {

        localStream
            .getTracks()
            .forEach(
                track => {

                    console.log(
                        "Stopping track:",
                        track.kind
                    );

                    track.stop();

                }
            );


        localStream =
            null;

    }


    // --------------------------------------------------------
    // Clear videos
    // --------------------------------------------------------

    localVideo.srcObject =
        null;

    remoteVideo.srcObject =
        null;


    // --------------------------------------------------------
    // Close AudioContext
    // --------------------------------------------------------

    if (
        phoneAudioContext
    ) {

        try {

            phoneAudioContext.close();

        }

        catch (error) {}

        phoneAudioContext =
            null;

    }


    // --------------------------------------------------------
    // Destroy PeerJS
    // --------------------------------------------------------

    if (
        peer
    ) {

        try {

            peer.destroy();

        }

        catch (error) {

            console.error(
                error
            );

        }

        peer =
            null;

    }


    // --------------------------------------------------------
    // Reset UI
    // --------------------------------------------------------

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


    cameraConnection.textContent =
        "Disconnected";


    attentionButton.classList.remove(
        "active"
    );


    attentionButton.textContent =
        "⚠️ ATTENTION";


    setStatus(
        "OFFLINE"
    );


    passwordInput.value =
        "";


    showError(
        ""
    );


    console.log(
        "DISCONNECTED COMPLETELY"
    );

}


// ============================================================
// CLOCK
// ============================================================

function updateClock() {

    const time =
        new Date()
            .toLocaleTimeString(
                [],
                {
                    hour12: false
                }
            );


    const cameraClock =
        document.getElementById(
            "cameraClock"
        );


    const monitorClock =
        document.getElementById(
            "monitorClock"
        );


    if (cameraClock) {

        cameraClock.textContent =
            time;

    }


    if (monitorClock) {

        monitorClock.textContent =
            time;

    }

}


setInterval(
    updateClock,
    1000
);


updateClock();


// ============================================================
// PAGE CLOSE CLEANUP
// ============================================================

window.addEventListener(
    "beforeunload",
    () => {

        shuttingDown =
            true;


        if (
            localStream
        ) {

            localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        if (
            currentCall
        ) {

            try {
                currentCall.close();
            }
            catch (e) {}

        }


        if (
            controlConnection
        ) {

            try {
                controlConnection.close();
            }
            catch (e) {}

        }


        if (
            peer
        ) {

            try {
                peer.destroy();
            }
            catch (e) {}

        }

    }
);