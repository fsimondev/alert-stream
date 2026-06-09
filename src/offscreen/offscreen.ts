// Offscreen document: the MV3 service worker cannot play audio, so it asks this
// document to play the alert sound.
interface PlaySoundMessage {
  target?: string
  type?: string
  volume?: number
}

chrome.runtime.onMessage.addListener((message: PlaySoundMessage) => {
  if (message?.target !== 'offscreen' || message.type !== 'PLAY_SOUND') return
  const audio = new Audio(chrome.runtime.getURL('sounds/alert.wav'))
  audio.volume = Math.max(0, Math.min(1, message.volume ?? 0.7))
  void audio.play().catch(() => {
    /* autoplay restrictions shouldn't apply to extension offscreen docs */
  })
})
