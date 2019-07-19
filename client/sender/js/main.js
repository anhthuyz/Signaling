'use strict';

let ws;
let peerCon;
let dataChannel;

const inputSrc = document.querySelector('textarea#dataChannelSend');
const startButton = document.getElementById('start');
const sendButton = document.querySelector('button#sendButton');
const closeButton = document.querySelector('button#closeButton');

// button event handler
startButton.onclick = start;
sendButton.onclick = () => dataChannel.send(inputSrc.value);
closeButton.onclick = closeDataChannels;

// button connect event handler
function Connect() {
  console.log('create socket connection at ws://127.0.0.1:8886/?device&id=123456');
  ws = new WebSocket('ws://127.0.0.1:8886/?device&id=123456');

  ws.addEventListener('message', (msg) => {
    console.log('\n\nReceived message.');
    const fr = new FileReader();
    fr.addEventListener('loadend', async (e) => {
      let cmd = JSON.parse(e.target.result);
      if (cmd.commandType === 'sdp') {
        console.log('Sdp detect. Set remote sdp');
        console.log(cmd.data);
        await peerCon.setRemoteDescription(cmd.data);

      } else if (cmd.commandType === 'candidate') {
        console.log('Candidate detect, add candidate:');
        console.log(cmd.data);
        await peerCon.addIceCandidate(cmd.data);

      } else if (cmd.commandType === 'ready') {
        console.log('Client ready. Starting session')
        await start();
      }

    });
    fr.readAsText(msg.data);
  });
}

async function start() {
    console.log('1. Created peer connection');
    const iceServers = [{ urls: ['stun://stun.l.google.com:19302']} ];
    peerCon = new RTCPeerConnection( {
      iceServers: iceServers,
      iceTransportPolicy: 'all',
      iceCandidatePoolSize: 0
    });

    peerCon.onicecandidate = (event) => {
      console.log('onICECandidate');
      if (event.candidate) {
        console.log('Send candidate to peer');
        console.log(event.candidate);
        ws.send(new Blob([JSON.stringify({ commandType: 'candidate', data: event.candidate })], {type: 'application/json'}));
      } else {
        console.log('End of candidate.');
      }
    };

    // create data channel
    console.log('2. Created data channel');
    dataChannel = peerCon.createDataChannel('sendDataChannel');
    dataChannel.onopen = onDataStateChanged;
    dataChannel.onclose = onDataStateChanged;

    try {
      // create offer if it's local
      console.log('3. Create offer SDP');
      let sdp = await peerCon.createOffer();
      await onSessionDescriptionCreated(sdp);

    }
    catch (e) {
      console.log('Failed to create session description: ' + e.toString());
    }

    startButton.disabled = true;
    closeButton.disabled = false;
}




async function onSessionDescriptionCreated(desc) {
  console.log('SDP has been created. Add SDP to localSDP');
  console.log(desc);
  await peerCon.setLocalDescription(desc);

  console.log('Send created Sdp to other peer');
  ws.send(new Blob([JSON.stringify({ commandType: 'sdp', data: desc })], {type:'application/json'}));
}


function closeDataChannels() {
  console.log('Closing data channels');
  dataChannel.close();
  console.log('Closed data channel with label: ' + dataChannel.label);
  peerCon.close();
  peerCon = null;
  console.log('Closed peer connections');
  startButton.disabled = false;
  sendButton.disabled = true;
  closeButton.disabled = true;
  inputSrc.value = '';
  inputSrc.disabled = true;
  sendButton.disabled = true;
  startButton.disabled = false;
}

function onDataStateChanged() {
  const readyState = dataChannel.readyState;
  console.log('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    inputSrc.disabled = false;
    inputSrc.focus();
    sendButton.disabled = false;
    closeButton.disabled = false;
  } else {
    inputSrc.disabled = true;
    sendButton.disabled = true;
    closeButton.disabled = true;
  }
}
