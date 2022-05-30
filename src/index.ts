// eslint-disable-next-line import/no-extraneous-dependencies
import { API } from 'homebridge'
import { PLATFORM_NAME } from './settings'
import SonosHomebridgePlatform from './platform'

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  api.registerPlatform(PLATFORM_NAME, SonosHomebridgePlatform)
}
