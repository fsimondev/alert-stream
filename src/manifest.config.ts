import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'
import { EXTENSION_KEY } from './lib/extension-key'

export default defineManifest({
  manifest_version: 3,
  name: 'LiveWatch — Twitch & Kick',
  version: pkg.version,
  // Pins the extension id -> stable chrome.identity redirect URI (so a Twitch
  // app + baked Client ID keep working across reloads/machines).
  key: EXTENSION_KEY,
  description:
    'Notifications temps reel quand un stream Twitch ou Kick demarre. Push pur (WebSocket), zero polling.',
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  action: {
    default_popup: 'popup.html',
    default_title: 'LiveWatch',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  options_page: 'options.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['storage', 'notifications', 'alarms', 'identity', 'offscreen'],
  host_permissions: [
    'https://api.twitch.tv/*',
    'https://id.twitch.tv/*',
    'https://kick.com/*',
  ],
  // The alert sound must be emitted into dist; icons are already emitted via the
  // icon declarations, and the offscreen page via the explicit Vite input.
  web_accessible_resources: [
    {
      resources: ['sounds/*'],
      matches: ['<all_urls>'],
    },
  ],
})
