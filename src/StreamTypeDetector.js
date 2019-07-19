const deviceArg = '/?device&id='
const webArg = '/?web&id='
const controlCenterArg = '/?cc'

// detect stream type
const isDevice = url => url.startsWith(deviceArg)
const isWeb = url => url.startsWith(webArg);
const isControlCenter = url => url.startsWith(controlCenterArg);

// get device information
let getDeviceId = url => (url.replace(deviceArg, '').replace(webArg, ''))

module.exports = {
  isDevice,
  isWeb,
  isControlCenter,
  getDeviceId
}
