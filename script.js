// ============================================================
// WEB CCTV
// VIDEO ONLY
// NO MICROPHONE
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
    async function () {

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
    function () {

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

        // VIDEO ONLY.
        // NO MICROPHONE.

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


        cameraConnection.textContent =
            "Camera permission failed.";

        setStatus(
            "CAMERA ERROR"
        );


        alert(
            "Camera access failed.\n\n" +
            "Please allow camera access."
        );

    }

}


// ============================================================
// CAMERA PEER
// ============================================================

function createCameraPeer() {

    const cameraPeerId =
        roomId +
        "_camera";


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


    peer.on(
        "open",
        function (id) {

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
        function (connection) {

            console.log(
                "LAPTOP CONNECTED"
            );


            controlConnection =
                connection;


            connection.on(
                "open",
                function () {

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
                function (data) {

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
                function () {

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

                        cameraConnection.textContent =
                            "Waiting for laptop...";

                        setStatus(
                            "WAITING FOR LAPTOP",
                            true
                        );

                    }

                }
            );

        }
    );


    peer.on(
        "error",
        function (error) {

            console.error(
                "PHONE PEER ERROR:",
                error
            );


            cameraConnection.textContent =
                "Peer error: " +
                error.type;

            setStatus(
                "PEER ERROR"
            );

        }
    );


    peer.on(
        "disconnected",
        function () {

            if (!shuttingDown) {

                setStatus(
                    "DISCONNECTED"
                );

            }

        }
    );

}


// ============================================================
// START VIDEO CALL
// ============================================================

function startVideoCall(
    laptopId
) {

    if (
        !peer ||
        peer.destroyed
    ) {

        return;

    }


    if (!localStream) {

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
        function () {

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
        function (error) {

            console.error(
                "VIDEO ERROR:",
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


    peer.on(
        "open",
        function (id) {

            console.log(
                "MONITOR PEER READY:",
                id
            );


            setStatus(
                "SEARCHING FOR CAMERA",
                true
            );


            tryConnectToCamera();

        }
    );


    // ========================================================
    // INCOMING VIDEO
    // ========================================================

    peer.on(
        "call",
        function (call) {

            console.log(
                "INCOMING VIDEO:",
                call.peer
            );


            currentCall =
                call;


            // NO AUDIO STREAM.
            call.answer();


            call.on(
                "stream",
                function (stream) {

                    console.log(
                        "VIDEO RECEIVED"
                    );


                    remoteVideo.srcObject =
                        stream;


                    waitingMessage.classList.add(
                        "hidden"
                    );


                    monitorLive.classList.remove(
                        "hidden"
                    );


                    setStatus(
                        "LIVE",
                        true
                    );

                }
            );


            call.on(
                "close",
                function () {

                    remoteVideo.srcObject =
                        null;


                    waitingMessage.classList.remove(
                        "hidden"
                    );


                    monitorLive.classList.add(
                        "hidden"
                    );


                    currentCall =
                        null;


                    if (!shuttingDown) {

                        setStatus(
                            "CAMERA OFFLINE"
                        );

                    }

                }
            );

        }
    );


    peer.on(
        "error",
        function (error) {

            console.error(
                "MONITOR PEER ERROR:",
                error
            );


            if (!shuttingDown) {

                scheduleReconnect();

            }

        }
    );

}


// ============================================================
// CONNECT TO CAMERA
// ============================================================

function tryConnectToCamera() {

    if (
        shuttingDown ||
        currentRole !== "monitor" ||
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
        "CONNECTING TO:",
        cameraPeerId
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


    connection.on(
        "open",
        function () {

            opened =
                true;


            console.log(
                "CAMERA CONTROL CONNECTED"
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


    connection.on(
        "data",
        function (data) {

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
                    "PHONE READY - START VIDEO"
                );


                setStatus(
                    "CONNECTING VIDEO",
                    true
                );


                setTimeout(
                    function () {

                        if (
                            !shuttingDown &&
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


    connection.on(
        "close",
        function () {

            if (
                controlConnection ===
                connection
            ) {

                controlConnection =
                    null;

            }


            if (!shuttingDown) {

                scheduleReconnect();

            }

        }
    );


    connection.on(
        "error",
        function (error) {

            console.error(
                "CONTROL ERROR:",
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
// RECONNECT
// ============================================================

function scheduleReconnect() {

    if (
        shuttingDown ||
        currentRole !== "monitor"
    ) {

        return;

    }


    if (reconnectTimer) {

        return;

    }


    reconnectTimer =
        setTimeout(
            function () {

                reconnectTimer =
                    null;

                tryConnectToCamera();

            },
            1500
        );

}


// ============================================================
// ATTENTION
// ============================================================

attentionButton.addEventListener(
    "click",
    function () {

        if (
            !controlConnection ||
            !controlConnection.open
        ) {

            attentionButton.textContent =
                "❌ NOT CONNECTED";


            setTimeout(
                function () {

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
            function () {

                attentionButton.classList.remove(
                    "active"
                );


                attentionButton.textContent =
                    "⚠️ ATTENTION";

            },
            700
        );

    }
);


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


        if (!phoneAudioContext) {

            phoneAudioContext =
                new AudioContext();

        }


        if (
            phoneAudioContext.state ===
            "suspended"
        ) {

            await phoneAudioContext.resume();

        }

    }

    catch (error) {

        console.error(
            error
        );

    }

}


// ============================================================
// ATTENTION ALERT
// ============================================================

async function attentionAlert() {

    console.log(
        "ATTENTION RECEIVED"
    );


    await preparePhoneAudio();

    playAttentionSound();

    flashPhone();

}


// ============================================================
// BEEP
// ============================================================

function playAttentionSound() {

    if (!phoneAudioContext) {

        return;

    }


    beep(880, 0);

    beep(880, 180);

    beep(1100, 360);

}


function beep(
    frequency,
    delay
) {

    setTimeout(
        function () {

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
        !track.getCapabilities
    ) {

        return;

    }


    const capabilities =
        track.getCapabilities();


    if (!capabilities.torch) {

        console.log(
            "Torch not supported"
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
        function (resolve) {

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


        const newTrack =
            newStream
                .getVideoTracks()[0];


        const oldStream =
            localStream;


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
                        newTrack
                    );

                }

            }

        }


        oldStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );


        console.log(
            "CAMERA FLIPPED"
        );

    }

    catch (error) {

        console.error(
            "FLIP ERROR:",
            error
        );


        usingFrontCamera =
            !usingFrontCamera;

    }

}


// ============================================================
// FULLSCREEN
// ============================================================

document
    .getElementById("fullscreen")
    .addEventListener(
        "click",
        async function () {

            const screen =
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
                    screen.requestFullscreen
                ) {

                    await screen.requestFullscreen();

                }

            }

            catch (error) {

                console.error(
                    error
                );

            }

        }
    );


// ============================================================
// DISCONNECT
// ============================================================
//
// IMPORTANT:
// This function is intentionally attached to window.
// The HTML buttons call it directly with:
//
// onclick="disconnectEverything()"
//
// ============================================================

window.disconnectEverything =
    disconnectEverything;


function disconnectEverything() {

    console.log(
        "================================"
    );

    console.log(
        "DISCONNECTING CCTV"
    );

    console.log(
        "================================"
    );


    shuttingDown =
        true;


    currentRole =
        null;


    // --------------------------------------------------------
    // STOP RECONNECTING
    // --------------------------------------------------------

    if (reconnectTimer) {

        clearTimeout(
            reconnectTimer
        );

        reconnectTimer =
            null;

    }


    // --------------------------------------------------------
    // CLOSE VIDEO CALL
    // --------------------------------------------------------

    if (currentCall) {

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
    // CLOSE CONTROL CONNECTION
    // --------------------------------------------------------

    if (controlConnection) {

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
    // STOP CAMERA
    // --------------------------------------------------------

    if (localStream) {

        localStream
            .getTracks()
            .forEach(
                function (track) {

                    console.log(
                        "STOPPING:",
                        track.kind
                    );


                    track.stop();

                }
            );


        localStream =
            null;

    }


    // --------------------------------------------------------
    // CLEAR VIDEO
    // --------------------------------------------------------

    if (localVideo) {

        localVideo.pause();

        localVideo.srcObject =
            null;

    }


    if (remoteVideo) {

        remoteVideo.pause();

        remoteVideo.srcObject =
            null;

    }


    // --------------------------------------------------------
    // CLOSE AUDIO CONTEXT
    // --------------------------------------------------------

    if (phoneAudioContext) {

        try {

            phoneAudioContext.close();

        }

        catch (error) {}

        phoneAudioContext =
            null;

    }


    // --------------------------------------------------------
    // DESTROY PEER
    // --------------------------------------------------------

    if (peer) {

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
    // RESET CAMERA SCREEN
    // --------------------------------------------------------

    cameraConnection.textContent =
        "Disconnected";


    // --------------------------------------------------------
    // RESET MONITOR
    // --------------------------------------------------------

    waitingMessage.classList.remove(
        "hidden"
    );


    monitorLive.classList.add(
        "hidden"
    );


    // --------------------------------------------------------
    // RESET ATTENTION
    // --------------------------------------------------------

    attentionButton.classList.remove(
        "active"
    );


    attentionButton.textContent =
        "⚠️ ATTENTION";


    // --------------------------------------------------------
    // RESET STATUS
    // --------------------------------------------------------

    setStatus(
        "OFFLINE"
    );


    // --------------------------------------------------------
    // SHOW LOGIN
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


    passwordInput.value =
        "";


    errorBox.textContent =
        "";


    console.log(
        "CCTV FULLY DISCONNECTED"
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
// CLOSE PAGE
// ============================================================

window.addEventListener(
    "beforeunload",
    function () {

        shuttingDown =
            true;


        if (localStream) {

            localStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        if (currentCall) {

            try {
                currentCall.close();
            }

            catch (e) {}

        }


        if (controlConnection) {

            try {
                controlConnection.close();
            }

            catch (e) {}

        }


        if (peer) {

            try {
                peer.destroy();
            }

            catch (e) {}

        }

    }
);