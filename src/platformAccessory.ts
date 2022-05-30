// eslint-disable-next-line import/no-extraneous-dependencies
import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge'
import { SonosDevice, SonosEvents } from '@svrooij/sonos'
import { TransportState } from '@svrooij/sonos/lib/models'
import { AccessoryContext } from './interfaces'
// eslint-disable-next-line import/no-cycle
import SonosHomebridgePlatform from './platform'
import Manager from './manager'

enum TargetMediaState {
  PLAY = 0,
  PAUSE = 1,
  STOP = 2,
}
enum CurrentMediaState {
  PLAY = 0,
  PAUSE = 1,
  STOP = 2,
  LOADING = 4,
  INTERRUPTED = 5,
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export default class SonosPlatformAccessory {
  private infoService = this.accessory
    .getService(this.platform.Service.AccessoryInformation) as Service

  private speakerService = this.accessory
    .getService(this.platform.Service.SmartSpeaker) || this.accessory
    .addService(this.platform.Service.SmartSpeaker)

  private targetMediaState?: TargetMediaState

  private currentMediaState: CurrentMediaState = CurrentMediaState.LOADING

  constructor(
    private readonly platform: SonosHomebridgePlatform,
    private readonly accessory: PlatformAccessory<AccessoryContext>,
  ) {
    this.loadServices()
      .catch((err) => {
        this.platform.log.error('loading services failed:', err)
      })
    this.registerEvents()
  }

  getDevice() {
    const device = Manager.getDevice(this.accessory.context.uuid)
    if (!device) throw new Error('cannot find device')
    return device
  }

  async loadServices() {
    const device = this.getDevice()
    // set accessory information

    await device.LoadDeviceData()
    const deviceInfo = await device.GetDeviceDescription()
    this.setInfoCharacteristics(deviceInfo)

    this.speakerService.setCharacteristic(
      this.platform.Characteristic.Name,
      device.Name,
    )
    this.speakerService.setCharacteristic(
      this.platform.Characteristic.ConfiguredName,
      device.Name,
    )

    this.speakerService.getCharacteristic(this.platform.Characteristic.CurrentMediaState)
      .onGet(this.getCurrentMediaState.bind(this))
    this.speakerService.getCharacteristic(this.platform.Characteristic.TargetMediaState)
      .onGet(this.getTargetMediaState.bind(this))
      .onSet(this.setTargetMediaState.bind(this))
    this.speakerService.getCharacteristic(this.platform.Characteristic.Mute)
      .onGet(this.getMute.bind(this))
      .onSet(this.setMute.bind(this))
    this.speakerService.getCharacteristic(this.platform.Characteristic.Volume)
      .onGet(this.getVolume.bind(this))
      .onSet(this.setVolume.bind(this))
  }

  registerEvents() {
    const device = this.getDevice()
    const { Characteristic } = this.platform
    device.Events.on(SonosEvents.Mute, (muted) => {
      this.speakerService.updateCharacteristic(Characteristic.Mute, muted)
    })
    device.Events.on(SonosEvents.Volume, (volume) => {
      this.speakerService.updateCharacteristic(Characteristic.Volume, volume)
    })

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    device.Events.on(SonosEvents.PlaybackStopped, () => {
      this.currentMediaState = CurrentMediaState.STOP
      this.speakerService.updateCharacteristic(
        Characteristic.CurrentMediaState,
        CurrentMediaState.STOP,
      )
    })
    device.Events.on(SonosEvents.CurrentTrackMetadata, (data) => {
      console.log('current', data)
      this.currentMediaState = CurrentMediaState.PLAY
      this.speakerService.updateCharacteristic(
        Characteristic.CurrentMediaState,
        CurrentMediaState.PLAY,
      )
    })
  }

  setInfoCharacteristics(deviceInfo: Awaited<ReturnType<SonosDevice['GetDeviceDescription']>>) {
    this.infoService.setCharacteristic(
      this.platform.Characteristic.Manufacturer,
      deviceInfo.manufacturer,
    )
    this.infoService.setCharacteristic(
      this.platform.Characteristic.Model,
      deviceInfo.modelName,
    )
    this.infoService.setCharacteristic(
      this.platform.Characteristic.Name,
      deviceInfo.displayName,
    )
    this.infoService.setCharacteristic(
      this.platform.Characteristic.SoftwareRevision,
      deviceInfo.softwareVersion,
    )
    this.infoService.setCharacteristic(
      this.platform.Characteristic.HardwareRevision,
      deviceInfo.hardwareVersion,
    )
    this.infoService.setCharacteristic(
      this.platform.Characteristic.SerialNumber,
      deviceInfo.serialNumber,
    )
  }

  async getCurrentMediaState(): Promise<CharacteristicValue> {
    const device = this.getDevice()
    const state = await device.GetState()
    switch (state.transportState) {
      case TransportState.Playing: return CurrentMediaState.PLAY
      case TransportState.Paused: return CurrentMediaState.PAUSE
      case TransportState.Stopped: return CurrentMediaState.STOP
      case TransportState.Transitioning: return CurrentMediaState.PLAY
      default: return CurrentMediaState.LOADING
    }
  }

  async getTargetMediaState(): Promise<CharacteristicValue> {
    if (this.targetMediaState != null) return this.targetMediaState
    const currentMediaState = await this.getCurrentMediaState()
    console.log({ currentMediaState })
    if (currentMediaState <= CurrentMediaState.PLAY) return currentMediaState
    return TargetMediaState.STOP
  }

  async getMute(): Promise<CharacteristicValue> {
    const device = this.getDevice()
    const state = await device.GetState()
    console.log({ state })
    return state.muted || state.volume === 0
  }

  async getVolume(): Promise<CharacteristicValue> {
    const device = this.getDevice()
    const state = await device.GetState()
    console.log({ state })
    return state.volume
  }

  async setTargetMediaState(value: CharacteristicValue) {
    this.targetMediaState = value as TargetMediaState
    const device = this.getDevice()

    switch (value) {
      case TargetMediaState.PLAY: return device.Play().then(() => undefined)
      case TargetMediaState.PAUSE: return device.Pause().then(() => undefined)
      default: return device.Stop().then(() => undefined)
    }
  }

  async setMute(value: CharacteristicValue) {
    const device = this.getDevice()
    await device.SetVolume(value ? 0 : 100)
  }

  async setVolume(value: CharacteristicValue) {
    const device = this.getDevice()
    await device.SetVolume(value as number)
  }
}
