import { afterEach, beforeEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, 'ResizeObserver', {
  value: TestResizeObserver,
})
window.scrollTo = () => {}
beforeEach(() => {
  // jsdom has no layout engine. Provide a measured chart viewport.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => DOMRect.fromRect({ width: 600, height: 250 }),
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
