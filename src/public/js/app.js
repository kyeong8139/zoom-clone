const socket = io();

const myFace = document.getElementById("myFace")
const muteBtn = document.getElementById("mute")
const cameraBtn = document.getElementById("camera")
const cameraSelect = document.getElementById("cameras")

const call = document.getElementById("call")

call.hidden = true

let myStream;
let muted = false
let cameraOff = false;
let roomName
let myPeerConnection;

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter(device => device.kind === "videoinput")
        const currentCamera = myStream.getVideoTracks()[0]
        cameras.forEach(camera => {
            const option = document.createElement("option")
            option.value = camera.deviceId
            option.innerText = camera.label
            if(currentCamera.label === camera.label) {
                option.selected = true
            }
            cameraSelect.appendChild(option)
        })
    } catch (e) {
        console.log(e)
    }
}

async function getMedia(deviceId) {
    const initailConstrains = {
        audio: true,
        video: {facingMode: "user"}
    }
    const cameraConstraints = {
        audio: true,
        video: {deviceId: {exact : deviceId}}
    }

    try {
        myStream = await navigator.mediaDevices.getUserMedia(deviceId ? cameraConstraints : initailConstrains)
        myFace.srcObject = myStream

        if (!deviceId) {
            await getCameras()
        }
    } catch (e) {
        console.log(e)
    }
}

function handleMuteClick () {
    myStream
        .getAudioTracks()
        .forEach(track => track.enabled = !track.enabled)
    if(!muted) {
        muteBtn.innerText = "Unmute"
    } else {
        muteBtn.innerText = "Mute"
    }
    muted = !muted
}

function handleCameraClick() {
    myStream
        .getVideoTracks()
        .forEach(track => track.enabled = !track.enabled)
    if(cameraOff) {
        cameraBtn.innerText = "Turn Camera Off"
    } else {
        cameraBtn.innerText = "Turn Camera On"
    }
    cameraOff = !cameraOff
}

async function handleCameraChange() {
    await getMedia(cameraSelect.value)
    if (myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0]
        const videoSender = myPeerConnection
            .getSenders()
            .find((sender) => sender.track.kind === "video")
        videoSender.replaceTrack(videoTrack)
    }
}

muteBtn.addEventListener("click", handleMuteClick)
cameraBtn.addEventListener("click", handleCameraClick)
cameraSelect.addEventListener("input", handleCameraChange)

// Welcom Form (join a room)
const welcome = document.getElementById("welcome")
const welcomeForm = welcome.querySelector("form")

async function initCall() {
    welcome.hidden = true;
    call.hidden = false;

    await getMedia()
    makeConnection()
}

async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input")
    roomName = input.value
    
    await initCall()
    socket.emit("join_room", roomName)
    input.value = ""
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit)

// socket code
socket.on("welcome", async () => {
    const offer = await myPeerConnection.createOffer()
    myPeerConnection.setLocalDescription(offer)
    socket.emit("offer", offer, roomName)
})

socket.on("offer", async (offer) => {
    myPeerConnection.setRemoteDescription(offer)
    const answer = await myPeerConnection.createAnswer();
    myPeerConnection.setLocalDescription(answer)
    socket.emit("answer", answer, roomName)
})

socket.on("answer", (answer) => {
    myPeerConnection.setRemoteDescription(answer)
})

socket.on("ice", (ice) => {
    myPeerConnection.addIceCandidate(ice)
})

// RTC code
function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        // issue : 화면이 전송되지 않음 (오디오 정상 전송됨)
        iceServers : [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                    "stun:stun3.l.google.com:19302",
                    "stun:stun4.l.google.com:19302",
                ]
            }
        ]
    })
    myPeerConnection.addEventListener("icecandidate", handleIce)
    myPeerConnection.addEventListener("track", handleTrack)
    myStream
        .getTracks()
        .forEach(track => myPeerConnection.addTrack(track, myStream))
}

function handleIce(data) {
    socket.emit("ice", data, roomName)
}

function handleTrack(data) {
    const peerFace = document.getElementById("peerFace")
    peerFace.srcObject = data.stream
}