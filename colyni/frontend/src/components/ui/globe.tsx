import createGlobe, { type COBEOptions } from 'cobe'
import { useCallback, useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

export const GLOBE_CONFIG: COBEOptions = {
  width: 800,
  height: 800,
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.3,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.2,
  baseColor: [1, 1, 1],
  markerColor: [61 / 255, 140 / 255, 94 / 255],
  glowColor: [0.92, 0.95, 0.93],
  markers: [
    { location: [14.5995, 120.9842], size: 0.03 },
    { location: [19.076, 72.8777], size: 0.1 },
    { location: [23.8103, 90.4125], size: 0.05 },
    { location: [30.0444, 31.2357], size: 0.07 },
    { location: [39.9042, 116.4074], size: 0.08 },
    { location: [-23.5505, -46.6333], size: 0.1 },
    { location: [19.4326, -99.1332], size: 0.1 },
    { location: [40.7128, -74.006], size: 0.1 },
    { location: [34.6937, 135.5022], size: 0.05 },
    { location: [41.0082, 28.9784], size: 0.06 },
  ],
}

type GlobeProps = {
  className?: string
  config?: COBEOptions
}

export function Globe({ className, config = GLOBE_CONFIG }: GlobeProps) {
  const phiRef = useRef(0)
  const widthRef = useRef(0)
  const pointerInteracting = useRef<number | null>(null)
  const pointerInteractionMovement = useRef(0)
  const rRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const updatePointerInteraction = (value: number | null) => {
    pointerInteracting.current = value
    if (canvasRef.current) {
      canvasRef.current.style.cursor = value !== null ? 'grabbing' : 'grab'
    }
  }

  const updateMovement = (clientX: number) => {
    if (pointerInteracting.current !== null) {
      const delta = clientX - pointerInteracting.current
      pointerInteractionMovement.current = delta
      rRef.current = delta / 200
    }
  }

  const onRender = useCallback((state: Record<string, unknown>) => {
    if (pointerInteracting.current === null) {
      phiRef.current += 0.005
    }
    state.phi = phiRef.current + rRef.current
    const w = widthRef.current
    state.width = w * 2
    state.height = w * 2
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onResize = () => {
      widthRef.current = canvas.offsetWidth
    }
    window.addEventListener('resize', onResize)
    onResize()

    const opts = {
      ...config,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
      onRender,
    } as COBEOptions & {
      onRender: (state: Record<string, unknown>) => void
    }

    const globe = createGlobe(canvas, opts)

    const t = window.setTimeout(() => {
      canvas.style.opacity = '1'
    }, 50)

    return () => {
      window.clearTimeout(t)
      window.removeEventListener('resize', onResize)
      globe.destroy()
    }
  }, [config, onRender])

  return (
    <div
      className={cn(
        'absolute inset-0 mx-auto aspect-[1/1] w-full max-w-[600px]',
        className,
      )}
    >
      <canvas
        className="size-full opacity-0 transition-opacity duration-500 [contain:layout_paint_size]"
        ref={canvasRef}
        onPointerDown={(e) =>
          updatePointerInteraction(
            e.clientX - pointerInteractionMovement.current,
          )
        }
        onPointerUp={() => updatePointerInteraction(null)}
        onPointerOut={() => updatePointerInteraction(null)}
        onMouseMove={(e) => updateMovement(e.clientX)}
        onTouchMove={(e) => {
          const touch = e.touches[0]
          if (touch) updateMovement(touch.clientX)
        }}
      />
    </div>
  )
}
