import { useEffect, useRef, useState } from 'react'

type AnimatedNumberProps = {
  value: number
  duration?: number
  formatFn?: (n: number) => string
  className?: string
}

export function AnimatedNumber({
  value,
  duration = 600,
  formatFn = (n) => n.toLocaleString(),
  className,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)

  useEffect(() => {
    const from = prev.current
    const to = value
    prev.current = to
    if (from === to) return

    const start = performance.now()
    let raf: number

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <span className={className}>{formatFn(display)}</span>
}
