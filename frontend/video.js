const socket = io('/'); // Connect to server
const myVideo = document.getElementById('myVideo');
const userVideo = document.getElementById('userVideo');

// 1. Get Room ID
const urlParams = new URLSearchParams(window.location.search);
const ROOM_ID = urlParams.get('room') || 'waiting-room';

// 2. Setup PeerJS
const myPeer = new Peer(undefined, {
    host: window.location.hostname, 
    port: 3001,
    path: '/'
});

let myStream;
let peers = {};

// 3. START CAMERA FIRST
navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
}).then(stream => {
    myStream = stream;
    addVideoStream(myVideo, stream); // Show my face immediately

    // A. Handle Incoming Calls (From Customer)
    myPeer.on('call', call => {
        console.log("Receiving call...");
        call.answer(stream); // Answer and send my stream
        const video = document.getElementById('userVideo');
        
        call.on('stream', userVideoStream => {
            console.log("Showing customer video");
            addVideoStream(video, userVideoStream);
        });
    });

    // B. Handle New User Joining (If I am already in the room)
    socket.on('user-connected', userId => {
        console.log("User connected: " + userId);
        // Wait 1s for their PeerJS to stabilize
        setTimeout(() => {
            connectToNewUser(userId, stream);
        }, 1000);
    });

    // C. Join the Room (Only after camera is ready)
    if (myPeer.id) {
        socket.emit('join-room', ROOM_ID, myPeer.id);
    } else {
        myPeer.on('open', id => {
            socket.emit('join-room', ROOM_ID, id);
        });
    }

}).catch(err => {
    alert("❌ Error: Could not access camera/microphone.");
    console.error(err);
});

// Helper: Call a new user
function connectToNewUser(userId, stream) {
    const call = myPeer.call(userId, stream);
    const video = document.getElementById('userVideo');
    
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    });
    call.on('close', () => {
        video.srcObject = null;
    });
    peers[userId] = call;
}

// Helper: Add video to screen
function addVideoStream(video, stream) {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
}

// Handle User Disconnect
socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close();
});

// --- BUTTON CONTROLS ---

function toggleAudio() {
    const audioTrack = myStream.getAudioTracks()[0];
    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('audioIcon').className = 'fa-solid fa-microphone-slash';
    } else {
        audioTrack.enabled = true;
        document.getElementById('audioIcon').className = 'fa-solid fa-microphone';
    }
}

function toggleVideo() {
    const videoTrack = myStream.getVideoTracks()[0];
    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('videoIcon').className = 'fa-solid fa-video-slash';
    } else {
        videoTrack.enabled = true;
        document.getElementById('videoIcon').className = 'fa-solid fa-video';
    }
}

function endCall() {
    // Stop all tracks (turns off camera light)
    myStream.getTracks().forEach(track => track.stop());
    window.close(); // Close the tab
}