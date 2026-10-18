import { useEffect, useState } from 'react'

/** Show on upwards scrolling, hide on sustained downwards scrolling. */
export function useAutoHideHeader() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    let previous = Math.max(0, window.scrollY)
    let direction = 0
    let distance = 0
    function onScroll() {
      const current = Math.max(0, window.scrollY)
      const delta = current - previous
      previous = current
      if (current < 72) {
        direction = 0
        distance = 0
        setVisible(true)
        return
      }
      const nextDirection = Math.sign(delta)
      if (!nextDirection) return
      if (direction !== nextDirection) {
        direction = nextDirection
        distance = 0
      }
      distance += Math.abs(delta)
      if (distance >= 20) {
        setVisible(nextDirection < 0)
        distance = 0
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return { visible, setVisible }
}
