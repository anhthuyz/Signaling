const BJSON = require('buffer-json');

const commandType = {
  // WS command for control center
  UpdateDeviceList: 'updateDeviceList',    // nodejs -> web
  OpenConnectionResponse: 'openConnectionResponse',       // nodejs -> web
  // web rtc peer
  SetOfferSDP: 'setOfferSdp',              // device -> nodejs -> web
  SetAnswerSDP: 'setAnswerSdp',            // web -> nodejs -> device
  SetIceCandidate: 'setIceCandidate',       // (web -> nodejs -> device) & (device -> nodejs -> web)

  // web -> device
  StartStreaming: 'startStreaming'

}

const device2WebCommands = [
  commandType.SetOfferSDP,
  commandType.SetIceCandidate
]

const web2DeviceCommands = [
  commandType.StartStreaming,
  commandType.SetAnswerSDP,
  commandType.SetIceCandidate
]

class CommandStream {
  constructor() {
  }

  addDeviceStream(stream) {
    this.deviceStream = stream
    this.deviceStream.on('message', (e) => {
      console.log('Device: on-message')
      try {
        const cmd = BJSON.parse(e)
        if (device2WebCommands.indexOf(cmd.commandType) >= 0) {
          console.log('Received device command, forwarding to web client', cmd);
          this.sendToWeb(e)
        } else {
          console.log('Could not found expected cmd. Received: ', cmd);
        }
      } catch (e) {
        console.log(e)
      }
    })
  }

  addWebStream(stream) {
    // only allow 1 web connect to one device
    if (this.webStream != null) {
      stream.send(JSON.stringify({
        commandType: commandType.OpenConnectionResponse,
        data: {
          success: false,
          message: 'The device has been connected by other user.'
        }}));
      return;
    }

    this.webStream = stream;
    this.webStream.on('message', (e) => {
      console.log('Web: on-message')
      try {
        const cmd = JSON.parse(e)
        if (web2DeviceCommands.indexOf(cmd.commandType) >= 0) {
          console.log('Received web command, forwarding to device.', cmd);
          this.sendToDevice(e)
        } else {
          console.log('Could not found expected command in ', cmd);
        }
      } catch (e) {
        console.log(e)
      }
    });

    stream.on('close', () => this.removeWebStream())

    stream.send(JSON.stringify({
      commandType: commandType.OpenConnectionResponse,
      data: {
        success: true,
        message: ''
      }
    }))

    this.deviceStream.send(JSON.stringify({
      commandType: commandType.OpenConnectionResponse,
      data: {
        success: true,
        message: ''
      }
    }))

  }

  removeWebStream() {
    delete this.webStream;
  }

  sendToDevice(data) {
    if (this.deviceStream)
      this.deviceStream.send(data)
  }

  sendToWeb(data) {
    if (this.webStream)
      this.webStream.send(data)
  }
}

module.exports = { CommandStream, commandType }
