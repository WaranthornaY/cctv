// ============================================================
// WEB CCTV
//
// PHONE:
//   - Camera
//   - Microphone
//   - Receives laptop microphone while laptop talks
//   - Receives ATTENTION commands
//
// LAPTOP:
//   - Monitor
//   - Microphone
//   - Hold to speak
//   - ATTENTION button
//
// ============================================================


let peer = null;

let localStream = null;

let currentCall = null;

let controlConnection = null;

let roomId = null;

let currentRole = null;

let usingFrontCamera = false;

let monitorMicStream = null;

let phoneAudioElement = null;

let phoneIntercomAudio = null;


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

const talkButton =
    document.getElementById("talkButton");

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

function setStatus(
    text,
    online = false
) {

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


        localVideo.srcObject =
            localStream;


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
            "Camera permission was denied or unavailable.";


        alert(
            "Could not access the camera.\n\n" +
            "Please allow camera and microphone access."
        );

    }

}


// ============================================================
// CREATE PHONE PEER
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
                "Phone peer ready:",
                id
            );


            setStatus(
                "WAITING",
                true
            );

        }
    );


    // ========================================================
    // RECEIVE MEDIA CALL FROM LAPTOP
    // ========================================================

    peer.on(
        "call",
        call => {

            console.log(
                "Laptop media connection!"
            );


            currentCall =
                call;


            // Send phone camera + microphone
            call.answer(
                localStream
            );


            cameraConnection.textContent =
                "Laptop connected";


            setStatus(
                "LIVE",
                true
            );


            // Laptop microphone arrives here
            call.on(
                "stream",
                stream => {

                    console.log(
                        "Laptop audio received."
                    );


                    playPhoneAudio(
                        stream
                    );

                }
            );


            call.on(
                "close",
                () => {

                    console.log(
                        "Media call closed."
                    );


                    currentCall =
                        null;


                    if (
                        phoneIntercomAudio
                    ) {

                        phoneIntercomAudio
                            .srcObject =
                            null;

                    }


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
                        "Media call error:",
                        error
                    );

                }
            );

        }
    );


    // ========================================================
    // RECEIVE CONTROL CONNECTION
    // ========================================================

    peer.on(
        "connection",
        connection => {

            console.log(
                "Laptop control connection!"
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
                        type: "PHONE_READY"
                    });

                }
            );


            connection.on(
                "data",
                data => {

                    handlePhoneCommand(
                        data
                    );

                }
            );


            connection.on(
                "close",
                () => {

                    controlConnection =
                        null;


                    // If laptop disconnects,
                    // immediately disable phone mic.

                    setPhoneMicrophone(
                        false
                    );

                }
            );

        }
    );


    peer.on(
        "error",
        error => {

            console.error(
                "Phone peer error:",
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

            } else {

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
// PHONE: HANDLE LAPTOP COMMANDS
// ============================================================

function handlePhoneCommand(data) {

    if (!data) {
        return;
    }


    console.log(
        "Phone command:",
        data
    );


    // ========================================================
    // LAPTOP STARTED TALKING
    // ========================================================

    if (
        data.type === "TALK_ON"
    ) {

        // Phone is allowed to speak
        setPhoneMicrophone(
            true
        );

        return;
    }


    // ========================================================
    // LAPTOP STOPPED TALKING
    // ========================================================

    if (
        data.type === "TALK_OFF"
    ) {

        // Phone microphone immediately disabled
        setPhoneMicrophone(
            false
        );

        return;
    }


    // ========================================================
    // ATTENTION
    // ========================================================

    if (
        data.type === "ATTENTION"
    ) {

        attentionAlert();

        return;
    }

}


// ============================================================
// PHONE MICROPHONE ENABLE / DISABLE
// ============================================================

function setPhoneMicrophone(enabled) {

    if (!localStream) {
        return;
    }


    const tracks =
        localStream.getAudioTracks();


    tracks.forEach(
        track => {

            track.enabled =
                enabled;

        }
    );


    console.log(
        "Phone microphone:",
        enabled ? "ON" : "OFF"
    );

}


// ============================================================
// PHONE AUDIO FROM LAPTOP
// ============================================================

function playPhoneAudio(stream) {

    if (
        !phoneIntercomAudio
    ) {

        phoneIntercomAudio =
            document.createElement(
                "audio"
            );


        phoneIntercomAudio.id =
            "phoneIntercomAudio";


        phoneIntercomAudio.autoplay =
            true;


        phoneIntercomAudio.playsInline =
            true;


        document.body.appendChild(
            phoneIntercomAudio
        );

    }


    phoneIntercomAudio.srcObject =
        stream;


    phoneIntercomAudio.play()
        .catch(
            error => {

                console.log(
                    "Audio playback waiting:",
                    error
                );

            }
        );

}


// ============================================================
// START LAPTOP MONITOR
// ============================================================

async function startMonitor() {

    try {

        // Laptop microphone
        monitorMicStream =
            await navigator.mediaDevices
                .getUserMedia({

                    audio: true,

                    video: false

                });


        // Start MUTED
        monitorMicStream
            .getAudioTracks()
            .forEach(
                track => {

                    track.enabled =
                        false;

                }
            );

    }

    catch (error) {

        console.error(
            "Microphone error:",
            error
        );


        alert(
            "Microphone permission is required for push-to-talk."
        );


        return;

    }


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
                "Laptop peer ready."
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
                "Laptop peer error:",
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
// CONNECT LAPTOP TO PHONE
// ============================================================

function connectToCamera() {

    const cameraPeerId =
        roomId + "_camera";


    console.log(
        "Connecting to camera:",
        cameraPeerId
    );


    // ========================================================
    // MEDIA CONNECTION
    // ========================================================

    currentCall =
        peer.call(
            cameraPeerId,
            monitorMicStream
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
                "CCTV stream received!"
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
                "Media call error:",
                error
            );


            setStatus(
                "CONNECTION ERROR"
            );

        }
    );


    // ========================================================
    // CONTROL DATA CONNECTION
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
                "Control connection ready."
            );

        }
    );


    controlConnection.on(
        "data",
        data => {

            if (
                data &&
                data.type ===
                    "PHONE_READY"
            ) {

                console.log(
                    "Phone control ready."
                );

            }

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


    controlConnection.on(
        "error",
        error => {

            console.error(
                "Control connection error:",
                error
            );

        }
    );

}


// ============================================================
// LAPTOP TALKING
// ============================================================

function setTalking(enabled) {

    if (!monitorMicStream) {
        return;
    }


    const tracks =
        monitorMicStream
            .getAudioTracks();


    tracks.forEach(
        track => {

            track.enabled =
                enabled;

        }
    );


    // Tell phone whether it is allowed
    // to use its microphone.

    if (
        controlConnection &&
        controlConnection.open
    ) {

        controlConnection.send({

            type:
                enabled
                    ? "TALK_ON"
                    : "TALK_OFF"

        });

    }


    if (enabled) {

        talkButton
            .classList
            .add("talking");


        talkButton.textContent =
            "🎤 SPEAKING";


        console.log(
            "Laptop microphone ON"
        );

    }

    else {

        talkButton
            .classList
            .remove("talking");


        talkButton.textContent =
            "🎤 Hold to Speak";


        console.log(
            "Laptop microphone OFF"
        );

    }

}


// ============================================================
// PUSH TO TALK - MOUSE
// ============================================================

if (talkButton) {

    talkButton.addEventListener(
        "mousedown",
        event => {

            event.preventDefault();

            setTalking(true);

        }
    );


    talkButton.addEventListener(
        "mouseup",
        event => {

            event.preventDefault();

            setTalking(false);

        }
    );


    talkButton.addEventListener(
        "mouseleave",
        () => {

            setTalking(false);

        }
    );


    // ========================================================
    // TOUCH
    // ========================================================

    talkButton.addEventListener(
        "touchstart",
        event => {

            event.preventDefault();

            setTalking(true);

        },
        {
            passive: false
        }
    );


    talkButton.addEventListener(
        "touchend",
        event => {

            event.preventDefault();

            setTalking(false);

        },
        {
            passive: false
        }
    );


    talkButton.addEventListener(
        "touchcancel",
        event => {

            event.preventDefault();

            setTalking(false);

        },
        {
            passive: false
        }
    );

}


// ============================================================
// ATTENTION BUTTON
// ============================================================

if (attentionButton) {

    attentionButton.addEventListener(
        "click",
        () => {

            sendAttention();

        }
    );

}


// ============================================================
// SEND ATTENTION TO PHONE
// ============================================================

function sendAttention() {

    if (
        !controlConnection ||
        !controlConnection.open
    ) {

        console.log(
            "Phone is not connected."
        );

        return;

    }


    console.log(
        "Sending ATTENTION."
    );


    controlConnection.send({

        type: "ATTENTION",

        time: Date.now()

    });


    // Visual feedback
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
// PHONE ATTENTION
// ============================================================

async function attentionAlert() {

    console.log(
        "ATTENTION RECEIVED!"
    );


    // --------------------------------------------------------
    // BEEP
    // --------------------------------------------------------

    try {

        const AudioContext =
            window.AudioContext ||
            window.webkitAudioContext;


        const audioContext =
            new AudioContext();


        if (
            audioContext.state ===
            "suspended"
        ) {

            await audioContext.resume();

        }


        // Two quick beeps

        beep(
            audioContext,
            880,
            0
        );


        beep(
            audioContext,
            880,
            180
        );


        setTimeout(
            () => {

                audioContext.close();

            },
            600
        );

    }

    catch (error) {

        console.error(
            "Beep error:",
            error
        );

    }


    // --------------------------------------------------------
    // FLASH
    // --------------------------------------------------------

    await flashPhoneLight();

}


// ============================================================
// BEEP
// ============================================================

function beep(
    audioContext,
    frequency,
    delay
) {

    setTimeout(
        () => {

            const oscillator =
                audioContext
                    .createOscillator();


            const gain =
                audioContext
                    .createGain();


            oscillator.type =
                "sine";


            oscillator.frequency.value =
                frequency;


            gain.gain.setValueAtTime(
                0.0001,
                audioContext.currentTime
            );


            gain.gain.exponentialRampToValueAtTime(
                0.4,
                audioContext.currentTime + 0.01
            );


            gain.gain.exponentialRampToValueAtTime(
                0.0001,
                audioContext.currentTime + 0.12
            );


            oscillator.connect(
                gain
            );


            gain.connect(
                audioContext.destination
            );


            oscillator.start();


            oscillator.stop(
                audioContext.currentTime + 0.13
            );

        },
        delay
    );

}


// ============================================================
// PHONE FLASHLIGHT
// ============================================================

async function flashPhoneLight() {

    if (!localStream) {

        console.log(
            "No camera stream."
        );

        return;

    }


    const videoTracks =
        localStream.getVideoTracks();


    if (
        videoTracks.length === 0
    ) {

        console.log(
            "No video track."
        );

        return;

    }


    const track =
        videoTracks[0];


    // Check whether torch exists
    const capabilities =
        track.getCapabilities
            ? track.getCapabilities()
            : {};


    if (
        !capabilities.torch
    ) {

        console.log(
            "Torch control is not supported by this browser/device."
        );

        return;

    }


    try {

        // ON

        await track.applyConstraints({

            advanced: [
                {
                    torch: true
                }
            ]

        });


        // Keep it on briefly

        await sleep(250);


        // OFF

        await track.applyConstraints({

            advanced: [
                {
                    torch: false
                }
            ]

        });


        console.log(
            "Phone flashlight flashed."
        );

    }

    catch (error) {

        console.error(
            "Torch error:",
            error
        );

    }

}


// ============================================================
// SLEEP
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


// ============================================================
// SWITCH PHONE CAMERA
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


            // Stop old video camera first

            oldStream
                .getVideoTracks()
                .forEach(
                    track => {

                        track.stop();

                    }
                );


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


                // Replace tracks in active call

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
                    "Camera switched."
                );

            }

            catch (error) {

                console.error(
                    "Camera switch failed:",
                    error
                );


                // Restore previous camera

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

                                    }

                                },

                                audio: true

                            });


                    localStream =
                        restoredStream;


                    localVideo.srcObject =
                        restoredStream;

                }

                catch (restoreError) {

                    console.error(
                        restoreError
                    );


                    alert(
                        "Could not switch camera."
                    );

                }

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
// DISCONNECT EVERYTHING
// ============================================================

function disconnectEverything() {

    // Stop talking first

    setTalking(false);


    // Close control connection

    if (controlConnection) {

        try {

            controlConnection.close();

        }

        catch (error) {}

        controlConnection =
            null;

    }


    // Close media call

    if (currentCall) {

        try {

            currentCall.close();

        }

        catch (error) {}

        currentCall =
            null;

    }


    // Stop phone camera

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


    // Stop laptop microphone

    if (monitorMicStream) {

        monitorMicStream
            .getTracks()
            .forEach(
                track => {

                    track.stop();

                }
            );

        monitorMicStream =
            null;

    }


    // Destroy PeerJS

    if (peer) {

        try {

            peer.destroy();

        }

        catch (error) {}

        peer =
            null;

    }


    // Clear video

    localVideo.srcObject =
        null;

    remoteVideo.srcObject =
        null;


    if (phoneIntercomAudio) {

        phoneIntercomAudio.srcObject =
            null;

    }


    // Return to login

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


    if (talkButton) {

        talkButton
            .classList
            .remove("talking");


        talkButton.textContent =
            "🎤 Hold to Speak";

    }


    if (attentionButton) {

        attentionButton
            .classList
            .remove("active");


        attentionButton.textContent =
            "⚠️ ATTENTION";

    }


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


        if (monitorMicStream) {

            monitorMicStream
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