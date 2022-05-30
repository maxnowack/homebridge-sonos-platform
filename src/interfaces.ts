// eslint-disable-next-line import/no-extraneous-dependencies
import { PlatformConfig } from 'homebridge'

export interface PluginConfiguration extends PlatformConfig {
  name: string,
  hostname?: string,
}

export interface AccessoryContext {
  uuid: string,
}
