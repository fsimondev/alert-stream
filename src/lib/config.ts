// One-click Twitch sign-in.
//
// Bake a registered Twitch app Client ID here and users get a pure
// "Se connecter avec Twitch" experience — no Client ID to paste. The Twitch app
// must register this exact OAuth Redirect URL (see extension-key.ts):
//   https://nlifpnmpnelmhdkppjpgnlhfnolofpgd.chromiumapp.org/
//
// Leave it as '' to let each user enter their own Client ID in Settings.
export const DEFAULT_TWITCH_CLIENT_ID = 'ybb98ezncr0whltugq83oo19h91o94'
