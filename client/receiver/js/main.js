'use strict';

let peerConnection;
let dataChannel;
let ws;
const txtResult = document.querySelector('textarea#dataChannelReceive');

function Connect() {
  console.log('create socket connection at ws://127.0.0.1:8886/?web&id=123456');
  ws = new WebSocket('ws://127.0.0.1:8886/?web&id=123456');

  ws.addEventListener('open', () => {
    ws.send(new Blob([JSON.stringify({ commandType:'ready' })], { type: 'application/json' }));
  });

  ws.addEventListener('message', async (msg) => {
    console.log('Received message');
    if (typeof msg.data === 'string') {
      await handleResponseCommand(msg.data)
    } else {
      const fr = new FileReader();
      fr.addEventListener('loadend', async (e) => {
        await handleResponseCommand(e.target.result);
      });
      fr.readAsText(msg.data);
    }
  });
}

async function handleResponseCommand(responseCommand) {
  let cmd = JSON.parse(responseCommand);
  if (cmd.commandType === 'sdp') {
    try {
      let desc = cmd.data;
      console.log('SDP detected. Set remote sdp');
      console.log(desc);
      // Android device send type in upper-case format so we need to convert it to lower case
      desc.type = desc.type.toLowerCase();
      // Browser have sdp information is sdp
      // And Android devices contain sdp information in description field
      desc.sdp = desc.description || desc.sdp;
      await peerConnection.setRemoteDescription(desc);

      console.log('Creating answer SDP');
      const answer = await peerConnection.createAnswer();

      console.log('Answer Sdp has been created');
      console.log(answer);
      console.log('Set created answer SDP local');
      await peerConnection.setLocalDescription(answer);

      console.log('Send Answer Sdp to other peer');
      ws.send(new Blob([JSON.stringify({ commandType: 'sdp', data: answer })], {type:'application/json'}));
    }
    catch (e) {
      console.log("Sdp exception", e);
    }

  } else if (cmd.commandType === 'candidate') {
    try {
      console.log('IceCandidate detected. Add IceCandidate.');
      let candidate = cmd.data;
      // Android contain candidate information in sdp prop
      // Meanwhile browser contain candidate information in candidate prop
      candidate.candidate = candidate.sdp || candidate.candidate;
      await peerConnection.addIceCandidate(candidate);

    } catch (e) {
      console.log("Candidate detected", e);
    }
  } else if (cmd.commandType === 'ready') {
    console.log('Connection has been established. Init peer connection and waiting sender peer response.');

    peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: [ 'stun:numb.viagenie.ca' ],
            username: 'vutrongthinhk7@gmail.com',
            credential: '123asd45zx',
            credentialType: 'password'
          }, {
            urls: [ 'turn:numb.viagenie.ca' ],
              username: 'vutrongthinhk7@gmail.com',
            credential: '123asd45zx',
            credentialType: 'password'
          }]
        }
    );
    peerConnection.onicecandidate = onICECancidate;
    peerConnection.ondatachannel = onDataChannel;
  }
}


function onICECancidate(event) {
  console.log('OnICECandidate');
  if (event.candidate) {
    console.log('Send candidate to peer!');
    console.log(event.candidate);
    ws.send(new Blob([JSON.stringify({ commandType: 'candidate', data: event.candidate })], {type: 'application/json'}));
  } else {
    console.log('End of candidates.');
  }
}

function onDataChannel(event) {
  console.log('Receive Channel Callback');
  dataChannel = event.channel;
  dataChannel.onmessage = (e) => {
    console.log(e);
    txtResult.value = e.data
  }
  dataChannel.onopen = () => console.log('Receive channel state is: ' + dataChannel.readyState);
  dataChannel.onclose = () => console.log('On DataChannel Closed.');
}
