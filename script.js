// ============================================================
// WEB CCTV
//
// PHONE = CAMERA
// LAPTOP = MONITOR
//
// VIDEO ONLY
// NO MICROPHONE
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
// PASSWORD
// ============================================================

function hashPassword(text) {

    let hash =
        2166136261;


    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        hash ^=
            text.charCodeAt(i);


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

    return (
        "cctv_" +
        hashPassword(password)
    );

}


// ============================================================
// STATUS
// ============================================================

function setStatus(
    text,
    online = false
) {

    if (statusText) {

        statusText.textContent =
            text;

        statusText.classList.toggle(
            "online",
            online
        );

    }

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


        currentRole =
            "camera";


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


        currentRole =
            "monitor";


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
// CAMERA
// ============================================================

async function startCamera() {

    try {

        /*
         IMPORTANT:

         audio:false

         There is NO microphone.
        */

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

                            ideal:
                                1280

                        },

                        height: {

                            ideal:
                                720

                        }

                    },

                    audio: false

                });


        localVideo.srcObject =
            localStream;


        /*
         Prepare audio only for the
         local ATTENTION beep.

         It does NOT capture microphone.
        */

        await preparePhoneAudio();


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

    }

}


// ============================================================
// PHONE PEER
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


    // --------------------------------------------------------
    // OPEN
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // LAPTOP DATA CONNECTION
    // --------------------------------------------------------

    peer.on(
        "connection",
        connection => {

            console.log(
                "LAPTOP CONNECTED"
            );


            controlConnection =
                connection;


            connection.on(
                "open",
                () => {

                    console.log(
                        "CONTROL CONNECTION OPEN"
                    );


                    cameraConnection.textContent =
                        "Laptop connected";


                    setStatus(
                        "CONNECTING VIDEO",
                        true
                    );


                    connection.send({

                        type:
                            "PHONE_READY"

                    });


                    /*
                     PHONE initiates the video call.
                    */

                    setTimeout(
                        () => {

                            callLaptop(
                                connection.peer
                            );

                        },
                        500
                    );

                }
            );


            connection.on(
                "data",
                data => {

                    console.log(
                        "PHONE COMMAND:",
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
                        "LAPTOP DISCONNECTED"
                    );


                    controlConnection =
                        null;


                    if (currentCall) {

                        try {

                            currentCall.close();

                        }

                        catch (e) {}


                        currentCall =
                            null;

                    }


                    cameraConnection.textContent =
                        "Waiting for laptop...";


                    setStatus(
                        "WAITING FOR LAPTOP",
                        true
                    );

                }
            );

        }
    );


    // --------------------------------------------------------
    // PEER ERROR
    // --------------------------------------------------------

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
                    "Camera already connected.";

            }


            setStatus(
                "PEER ERROR"
            );

        }
    );

}


// ============================================================
// PHONE CALLS LAPTOP
// ============================================================

function callLaptop(
    laptopPeerId
) {

    if (!peer) {

        console.error(
            "PHONE PEER DOES NOT EXIST"
        );

        return;

    }


    if (!localStream) {

        console.error(
            "CAMERA STREAM DOES NOT EXIST"
        );

        return;

    }


    console.log(
        "PHONE CALLING LAPTOP:",
        laptopPeerId
    );


    currentCall =
        peer.call(
            laptopPeerId,
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
// MONITOR
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


    // --------------------------------------------------------
    // OPEN
    // --------------------------------------------------------

    peer.on(
        "open",
        id => {

            console.log(
                "MONITOR READY:",
                id
            );


            setStatus(
                "SEARCHING FOR CAMERA",
                true
            );


            connectToCamera();

        }
    );


    // --------------------------------------------------------
    // RECEIVE VIDEO
    // --------------------------------------------------------

    peer.on(
        "call",
        call => {

            console.log(
                "INCOMING CAMERA VIDEO"
            );


            currentCall =
                call;


            /*
             IMPORTANT:

             NO STREAM IS PASSED HERE.

             Laptop has no camera and no microphone.
            */

            call.answer();


            call.on(
                "stream",
                stream => {

                    console.log(
                        "VIDEO STREAM RECEIVED!"
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
                () => {

                    remoteVideo.srcObject =
                        null;


                    waitingMessage.classList.remove(
                        "hidden"
                    );


                    monitorLive.classList.add(
                        "hidden"
                    );


                    setStatus(
                        "CAMERA OFFLINE"
                    );

                }
            );


            call.on(
                "error",
                error => {

                    console.error(
                        "VIDEO ERROR:",
                        error
                    );

                }
            );

        }
    );


    // --------------------------------------------------------
    // ERROR
    // --------------------------------------------------------

    peer.on(
        "error",
        error => {

            console.error(
                "MONITOR PEER ERROR:",
                error
            );


            setStatus(
                "SEARCHING AGAIN"
            );


            scheduleReconnect();

        }
    );

}


// ============================================================
// CONNECT TO CAMERA
// ============================================================

function connectToCamera() {

    if (
        currentRole !==
        "monitor"
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

        return;

    }


    const cameraPeerId =
        roomId +
        "_camera";


    console.log(
        "CONNECTING TO:",
        cameraPeerId
    );


    setStatus(
        "SEARCHING FOR CAMERA",
        true
    );


    let connection;


    try {

        connection =
            peer.connect(
                cameraPeerId,
                {
                    reliable: true
                }
            );

    }

    catch (error) {

        console.error(
            "CONNECT ERROR:",
            error
        );


        scheduleReconnect();

        return;

    }


    controlConnection =
        connection;


    connection.on(
        "open",
        () => {

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
        data => {

            console.log(
                "CAMERA MESSAGE:",
                data
            );

        }
    );


    connection.on(
        "close",
        () => {

            console.log(
                "CAMERA CONNECTION CLOSED"
            );


            if (
                controlConnection ===
                connection
            ) {

                controlConnection =
                    null;

            }


            scheduleReconnect();

        }
    );


    connection.on(
        "error",
        error => {

            console.error(
                "CONTROL ERROR:",
                error
            );


            if (
                controlConnection ===
                connection
            ) {

                controlConnection =
                    null;

            }


            scheduleReconnect();

        }
    );

}


// ============================================================
// RECONNECT
// ============================================================

function scheduleReconnect() {

    if (
        currentRole !==
        "monitor"
    ) {

        return;

    }


    if (reconnectTimer) {

        return;

    }


    reconnectTimer =
        setTimeout(
            () => {

                reconnectTimer =
                    null;


                connectToCamera();

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
        "ATTENTION BUTTON"
    );


    if (
        !controlConnection ||
        !controlConnection.open
    ) {

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
// PHONE BEEP AUDIO
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

    }

    catch (error) {

        console.error(
            "AUDIO ERROR:",
            error
        );

    }

}


async function attentionAlert() {

    console.log(
        "ATTENTION RECEIVED"
    );


    await playAttentionSound();

    await flashPhone();

}


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
// PHONE FLASHLIGHT
// ============================================================

async function flashPhone() {

    if (!localStream) {

        return;

    }


    const tracks =
        localStream
            .getVideoTracks();


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


    if (!capabilities.torch) {

        console.log(
            "Torch unavailable."
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
    .getElementById(
        "flipCamera"
    )
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

                            ideal:
                                usingFrontCamera
                                    ? "user"
                                    : "environment"

                        },

                        width: {

                            ideal:
                                1280

                        },

                        height: {

                            ideal:
                                720

                        }

                    },

                    /*
                     NO MICROPHONE
                    */

                    audio: false

                });


        const newVideoTrack =
            newStream
                .getVideoTracks()[0];


        const oldVideoTrack =
            localStream
                .getVideoTracks()[0];


        /*
         Replace video track in WebRTC.
        */

        if (
            currentCall &&
            currentCall.peerConnection
        ) {

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
                        newVideoTrack
                    );

                }

            }

        }


        if (oldVideoTrack) {

            oldVideoTrack.stop();

        }


        localStream =
            newStream;


        localVideo.srcObject =
            newStream;


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
    .getElementById(
        "fullscreen"
    )
    .addEventListener(
        "click",
        async () => {

            const container =
                document.querySelector(
                    ".monitorContainer"
                );


            try {

                if (
                    !document.fullscreenElement
                ) {

                    await container
                        .requestFullscreen();

                }

                else {

                    await document
                        .exitFullscreen();

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
// DISCONNECT BUTTONS
// ============================================================

document
    .getElementById(
        "cameraStop"
    )
    .addEventListener(
        "click",
        disconnectEverything
    );


document
    .getElementById(
        "monitorStop"
    )
    .addEventListener(
        "click",
        disconnectEverything
    );


// ============================================================
// DISCONNECT
// ============================================================

function disconnectEverything() {

    console.log(
        "DISCONNECTING..."
    );


    currentRole =
        null;


    // Stop reconnecting

    if (reconnectTimer) {

        clearTimeout(
            reconnectTimer
        );

        reconnectTimer =
            null;

    }


    // Close video call

    if (currentCall) {

        try {

            currentCall.close();

        }

        catch (e) {}

        currentCall =
            null;

    }


    // Close control connection

    if (controlConnection) {

        try {

            controlConnection.close();

        }

        catch (e) {}

        controlConnection =
            null;

    }


    // Stop camera

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


    // Destroy PeerJS

    if (peer) {

        try {

            peer.destroy();

        }

        catch (e) {}

        peer =
            null;

    }


    // Clear videos

    localVideo.srcObject =
        null;


    remoteVideo.srcObject =
        null;


    // Reset UI

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


    cameraConnection.textContent =
        "Starting camera...";


    setStatus(
        "OFFLINE"
    );


    console.log(
        "DISCONNECTED"
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

            catch (e) {}

        }

    }
);