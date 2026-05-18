import { appEnv } from '../lib/env'

export function useBoardMeta() {
  return {
    circleId: appEnv.defaultCircleId,
    timezone: 'Europe/London',
    appName: appEnv.appName,
  }
}
