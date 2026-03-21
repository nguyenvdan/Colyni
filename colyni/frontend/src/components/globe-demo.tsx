import { Globe } from '@/components/ui/globe'

export function GlobeDemo() {
  return (
    <div className="relative flex aspect-square w-full max-w-[420px] flex-col items-center justify-center overflow-hidden rounded-[16px] border border-cy-border bg-cy-surface shadow-[0_0_80px_rgba(61,140,94,0.06)]">
      <span
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 select-none bg-gradient-to-b from-cy-text/80 to-cy-muted/40 bg-clip-text text-center text-7xl font-semibold leading-none tracking-[-0.03em] text-transparent sm:text-8xl"
        aria-hidden
      >
        C
      </span>
      <Globe className="top-0" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(61,140,94,0.06),transparent_60%)]" />
    </div>
  )
}
