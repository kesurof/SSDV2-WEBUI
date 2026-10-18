import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useAutoHideHeader } from '@/hooks/use-auto-hide-header'

let y = 0
Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y })
function move(next: number) {
  act(() => { y = next; fireEvent.scroll(window) })
}
afterEach(() => { y = 0; fireEvent.scroll(window) })

describe('useAutoHideHeader', () => {
  it('hides on scrolling down and reappears on scrolling up', () => {
    const { result } = renderHook(useAutoHideHeader)
    move(40)
    expect(result.current.visible).toBe(true)
    move(95)
    expect(result.current.visible).toBe(false)
    move(90)
    expect(result.current.visible).toBe(false)
    move(70)
    expect(result.current.visible).toBe(true)
    move(150)
    expect(result.current.visible).toBe(false)
    move(115)
    expect(result.current.visible).toBe(true)
  })
  it('accumulates small movements, but stays visible near the top', () => {
    const { result } = renderHook(useAutoHideHeader)
    move(90)
    for (let i = 1; i <= 7; i++) move(90 + i * 3)
    expect(result.current.visible).toBe(false)
    move(0)
    expect(result.current.visible).toBe(true)
  })
})
