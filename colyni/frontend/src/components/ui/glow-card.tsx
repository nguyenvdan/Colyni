import { cn } from '@/lib/utils'
import { GlowingEffect } from '@/components/ui/glowing-effect'

interface GlowCardProps {
  children: React.ReactNode
  className?: string
  innerClassName?: string
  spread?: number
  proximity?: number
  borderWidth?: number
}

export function GlowCard({
  children,
  className,
  innerClassName,
  spread = 40,
  proximity = 64,
  borderWidth = 2,
}: GlowCardProps) {
  return (
    <div className={cn('relative rounded-xl border border-cy-border p-px', className)}>
      <GlowingEffect
        spread={spread}
        glow
        disabled={false}
        proximity={proximity}
        inactiveZone={0.01}
        borderWidth={borderWidth}
      />
      <div
        className={cn(
          'relative h-full rounded-[inherit] bg-cy-surface',
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
