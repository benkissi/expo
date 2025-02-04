import { ExpoConfig, getConfig } from '@expo/config';

import { APISettings } from '../../api/settings';
import {
  closeDevelopmentSessionAsync,
  updateDevelopmentSessionAsync,
} from '../../api/updateDevelopmentSession';
import { getUserAsync } from '../../api/user/user';
import { Log } from '../../log';
import * as ProjectDevices from '../project/devices';

const debug = require('debug')('expo:start:server:developmentSession') as typeof console.log;

const UPDATE_FREQUENCY = 20 * 1000; // 20 seconds

async function isAuthenticatedAsync(): Promise<boolean> {
  return !!(await getUserAsync().catch(() => null));
}

export class DevelopmentSession {
  private timeout: NodeJS.Timeout | null = null;

  constructor(
    /** Project root directory. */
    private projectRoot: string,
    /** Development Server URL. */
    public url: string | null
  ) {}

  /**
   * Notify the Expo servers that a project is running, this enables the Expo Go app
   * and Dev Clients to offer a "recently in development" section for quick access.
   *
   * This method starts an interval that will continue to ping the servers until we stop it.
   *
   * @param projectRoot Project root folder, used for retrieving device installation IDs.
   * @param props.exp Partial Expo config with values that will be used in the Expo Go app.
   * @param props.runtime which runtime the app should be opened in. `native` for dev clients, `web` for web browsers.
   * @returns
   */
  public async startAsync({
    exp = getConfig(this.projectRoot).exp,
    runtime,
  }: {
    exp?: Pick<ExpoConfig, 'name' | 'description' | 'slug' | 'primaryColor'>;
    runtime: 'native' | 'web';
  }): Promise<void> {
    if (APISettings.isOffline) {
      debug('Development session will not ping because the server is offline.');
      this.stopNotifying();
      return;
    }

    const deviceIds = await this.getDeviceInstallationIdsAsync();

    if (!(await isAuthenticatedAsync()) && !deviceIds?.length) {
      debug(
        'Development session will not ping because the user is not authenticated and there are no devices.'
      );
      this.stopNotifying();
      return;
    }

    if (this.url) {
      debug(`Development session ping (runtime: ${runtime}, url: ${this.url})`);
      try {
        await updateDevelopmentSessionAsync({
          url: this.url,
          runtime,
          exp,
          deviceIds,
        });
      } catch (error) {
        Log.warn(`Non-fatal error updating development session API: ${error}`);
      }
    }

    this.stopNotifying();

    this.timeout = setTimeout(() => this.startAsync({ exp, runtime }), UPDATE_FREQUENCY);
  }

  /** Get all recent devices for the project. */
  private async getDeviceInstallationIdsAsync(): Promise<string[]> {
    const { devices } = await ProjectDevices.getDevicesInfoAsync(this.projectRoot);
    return devices.map(({ installationId }) => installationId);
  }

  /** Stop notifying the Expo servers that the development session is running. */
  public stopNotifying() {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.timeout = null;
  }

  public async closeAsync(): Promise<void> {
    this.stopNotifying();

    const deviceIds = await this.getDeviceInstallationIdsAsync();

    if (!(await isAuthenticatedAsync()) && !deviceIds?.length) {
      return;
    }

    if (this.url) {
      await closeDevelopmentSessionAsync({
        url: this.url,
        deviceIds,
      });
    }
  }
}
