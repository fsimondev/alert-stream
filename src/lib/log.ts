const PREFIX = '[LiveWatch]'

export const log = {
  info: (...a: unknown[]) => console.log(PREFIX, ...a),
  warn: (...a: unknown[]) => console.warn(PREFIX, ...a),
  error: (...a: unknown[]) => console.error(PREFIX, ...a),
}
