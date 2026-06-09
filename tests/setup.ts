import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'
import { installChromeMock } from './helpers/chrome-mock'

// Fresh in-memory chrome (and storage) for every test.
beforeEach(() => {
  installChromeMock()
})
