const ws = require('ws')
const _ = require('lodash')
const { CommandStream, commandType } = require('./src/CommandStream');
const { isDevice, isWeb, isControlCenter, getDeviceId } = require('./src/StreamTypeDetector')

const port = 8886;

let fs = require('fs');
let util = require('util');
let logFile = fs.createWriteStream('log.txt', { flags: 'a' });
// Or 'w' to truncate the file every time the process starts.
let logStdout = process.stdout;

console.log = function () {
  logFile.write(util.format.apply(null, arguments) + '\n');
  logStdout.write(util.format.apply(null, arguments) + '\n');
}
console.error = console.log;

/**
 * An object contain a lot of CommandStream
 * CommandStream is a pair of WebSocket stream of device & web client
 * Both device & web client stream are Duplex stream
 * @type { Record<String, CommandStream> }
 */
let commandStreamMap = {}

/**
 * An object contain a lot of control center websocket stream
 * @type WebSocket[]
 */
let controlCenterStreams = []


/**
 * Notify devices changed to all control centers
 * @param action 'add' or 'remove'
 * @param deviceIds An array which contains device id is a key
 * @param controlCenters An array which contains ControlCenter WebSocket instances
 */
function notifyDevicesChanged(action, deviceIds, controlCenters) {
  _.each(deviceIds, deviceId => {
    let updateDeviceListCommand = JSON.stringify({
      commandType: commandType.UpdateDeviceList,
      data: {
        action: action,
        id: deviceId
      }
    })
    _.each(controlCenters, controlCenter => controlCenter.send(updateDeviceListCommand))
  })
}

/**
 * Add devices to all control centers
 * @param deviceIds An array which contains device id is a key
 * @param controlCenters An array which contains ControlCenter WebSocket instances
 */
function addDevices(deviceIds, controlCenters) {
  notifyDevicesChanged('add', deviceIds, controlCenters)
}

/**
 * Remove devices from all control centers
 * @param deviceIds An array which contains device id is a key
 * @param controlCenters An array which contains ControlCenter WebSocket instances
 */
function removeDevices(deviceIds, controlCenters) {
  notifyDevicesChanged('remove', deviceIds, controlCenters)
}


//
const server = new ws.Server({ port }, () => {
  console.log(`listening on port ${port}`)
})

server.on('error', error => console.log('server: error', error))
server.on('close', () => console.log('server: close'))
server.on('connection', (stream, req) => {
  console.log('Connection has been establish!' + req.url)

  if (isControlCenter(req.url)) {
    // add to control center stream list
    controlCenterStreams.push(stream)
    console.log('Control center stream has been added.')

    // register close event to remove itself from controlCenterStreams
    stream.on('close', () => _.remove(controlCenterStreams, ccs => ccs === stream))

    // add all devices to new control center
    console.log('add device list into added control center')
    addDevices(_.keys(commandStreamMap), [ stream ])

  } else if (isDevice(req.url)) {
    let deviceId = getDeviceId(req.url);
    if (!deviceId) return

    if (!_.has(commandStreamMap, deviceId)) {
      // init command stream
      // web stream client which will be added later
      commandStreamMap[deviceId] = new CommandStream()

      // notify new device to all control centers
      addDevices([ deviceId ], controlCenterStreams);
    }

    commandStreamMap[deviceId].addDeviceStream(stream)
    console.log(`Device cmd stream ${deviceId} has been added.`)

    // immediately remove device in control center when connection lost
    // TODO: improve
    stream.on('close', () => removeDevices([deviceId], controlCenterStreams))

  } else if (isWeb(req.url)) {
    let deviceId = getDeviceId(req.url);
    if (!deviceId) return

    if (_.has(commandStreamMap, deviceId)) {
      commandStreamMap[deviceId].addWebStream(stream)
      console.log(`Web stream has been added ${deviceId}`)

    } else {
      console.log(`Device ${deviceId} is not connected yet`)
    }


  } else {
    console.log(`Bad url ${req.url}`)
  }
})
