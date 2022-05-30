import { SonosManager } from '@svrooij/sonos'

export default class Manager {
  private static instance = new SonosManager()

  static get() {
    return this.instance
  }

  static getDevice(uuid: string) {
    return this.instance.Devices.find(i => i.Uuid === uuid)
  }
}
