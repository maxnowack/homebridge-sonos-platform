// eslint-disable-next-line import/no-extraneous-dependencies
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, Service, Characteristic } from 'homebridge'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings'
// eslint-disable-next-line import/no-cycle
import SonosPlatformAccessory from './platformAccessory'
import { PluginConfiguration, AccessoryContext } from './interfaces'
import Manager from './manager'

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export default class SonosHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service

  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory<AccessoryContext>[] = []

  constructor(
    public readonly log: Logger,
    public readonly config: PluginConfiguration,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name)

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback')
      // run the method to discover / register your devices as accessories
      this.discoverDevices()
        .catch((err) => {
          this.log.error('discovering devices failed:', err)
        })
    })
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory<AccessoryContext>) {
    this.log.info('Loading accessory from cache:', accessory.displayName)

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory)
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    const manager = Manager.get()
    await (this.config.hostname
      ? manager.InitializeFromDevice(this.config.hostname)
      : manager.InitializeWithDiscovery(10))
    const devices = manager.Devices
    this.log.info(`Found ${devices.length} devices`)

    // loop over the discovered devices and register each one if it has not already been registered
    devices.forEach((device) => {
      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const uuid = this.api.hap.uuid.generate(device.Uuid)
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid)

      if (existingAccessory) {
        // the accessory already exists
        existingAccessory.context.uuid = device.Uuid
        existingAccessory.displayName = device.Name
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName)
        // eslint-disable-next-line no-new
        new SonosPlatformAccessory(this, existingAccessory)
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.Name)
        // eslint-disable-next-line new-cap
        const accessory = new this.api.platformAccessory<AccessoryContext>(device.Name, uuid)

        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context.uuid = device.Uuid
        // eslint-disable-next-line no-new
        new SonosPlatformAccessory(this, accessory)

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory])
      }
    })
  }
}
