import { ArrowRight, Globe as GlobeIcon, Zap, Shield, Lock } from 'lucide-react'

import { InteractiveGlobe } from '@/components/ui/interactive-globe'
import { GlowCard } from '@/components/ui/glow-card'
import { useTheme } from '@/lib/theme'

type HomePageProps = {
  onGoChat: () => void
  onGoContribute: () => void
  onGoSettings: () => void
}

const FEATURES = [
  {
    icon: GlobeIcon,
    title: 'A worldwide mesh',
    body: 'Link up with people anywhere and pool GPUs and laptops into one cluster. Big models split across the group so more people can actually run them.',
  },
  {
    icon: Zap,
    title: 'Credit economy',
    body: 'Chip in compute when others need it, earn credits, and spend them when you want time on the shared models.',
  },
  {
    icon: Shield,
    title: 'Sustainability first',
    body: 'Use machines that already exist instead of feeding more giant datacenters — the ones that pull huge amounts of water, electricity, and CO₂ to train and serve models at scale.',
  },
  {
    icon: Lock,
    title: 'Not another megacloud',
    body: 'Collective inference without defaulting to a single vendor’s supercomputer farm. You share capacity peer-to-peer, not through a centralized choke point.',
  },
]

const GLOBE_LIGHT = {
  dotColor: 'rgba(180, 83, 9, ALPHA)',
  arcColor: 'rgba(124, 45, 18, 0.38)',
  markerColor: 'rgba(107, 68, 35, 1)',
}

const GLOBE_DARK = {
  dotColor: 'rgba(76, 175, 114, ALPHA)',
  arcColor: 'rgba(76, 175, 114, 0.45)',
  markerColor: 'rgba(106, 175, 135, 1)',
}

export function HomePage({ onGoChat, onGoContribute, onGoSettings }: HomePageProps) {
  const { theme } = useTheme()
  const globeColors = theme === 'dark' ? GLOBE_DARK : GLOBE_LIGHT

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-cy-border bg-cy-surface">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />
        <div className="relative mx-auto flex max-w-[1100px] flex-col items-center gap-0 px-6 md:flex-row md:px-12">
          {/* Left copy */}
          <div className="western-wanted-frame relative z-10 mx-auto flex max-w-lg flex-1 flex-col items-start px-5 py-20 animate-fade-up md:mx-0 md:py-28">
            <div className="western-star-rule mb-5 hidden w-16 md:block" aria-hidden />
            <h1 className="text-[clamp(32px,5vw,48px)] font-semibold leading-[1.1] tracking-[-0.02em] text-cy-text">
              Run frontier AI
              <br />
              <span className="text-cy-green">together.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-[1.85] text-cy-secondary">
              Colyni is for connecting people around the world so everyone can contribute compute
              together and run large language models as a group. Instead of renting time on massive
              datacenter supercomputers — infrastructure that consumes enormous water, electricity,
              and carbon — we orchestrate the GPUs and computers that already sit on desks and in
              homes. Workloads spread across the mesh automatically; you earn credits when you help
              the network and spend them when you chat. Open <strong className="font-semibold text-cy-text">Chat</strong>, choose a model, wait for <strong className="font-semibold text-cy-text">Ready</strong>, and go.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onGoChat}
                className="group flex items-center gap-2 rounded-md bg-cy-green px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:bg-cy-green-dark hover:shadow-[0_0_24px_rgba(61,140,94,0.35)]"
              >
                Start chatting
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={onGoContribute}
                className="rounded-md border border-cy-border-strong px-5 py-2.5 text-[14px] font-medium text-cy-text transition-colors hover:border-cy-secondary hover:bg-cy-inset"
              >
                Contribute compute
              </button>
              <button
                type="button"
                onClick={onGoSettings}
                className="rounded-md border border-cy-border px-5 py-2.5 text-[14px] font-medium text-cy-secondary transition-colors hover:border-cy-green/30 hover:bg-cy-inset hover:text-cy-text"
              >
                Settings
              </button>
            </div>
          </div>

          {/* Right — Interactive Globe */}
          <div className="relative flex flex-1 items-center justify-center animate-fade-up delay-200 md:min-h-[520px]">
            <InteractiveGlobe
              size={440}
              dotColor={globeColors.dotColor}
              arcColor={globeColors.arcColor}
              markerColor={globeColors.markerColor}
            />
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="border-b border-cy-border bg-cy-bg">
        <div className="mx-auto grid max-w-[1100px] gap-4 px-6 py-16 sm:grid-cols-2 md:px-12 md:py-20">
          {FEATURES.map((f) => (
            <GlowCard key={f.title} innerClassName="p-7 flex flex-col gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cy-border bg-cy-inset">
                <f.icon size={18} strokeWidth={1.5} className="text-cy-green" />
              </div>
              <h3 className="text-[15px] font-medium text-cy-text">{f.title}</h3>
              <p className="text-[13px] leading-[1.6] text-cy-secondary">{f.body}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-cy-bg">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-4 px-6 py-20 text-center md:px-12 md:py-28">
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-cy-muted">
            Built at HooHacks 2026
          </p>
          <h2 className="max-w-lg text-[24px] font-semibold tracking-[-0.01em] text-cy-text">
            One planet, millions of GPUs already plugged in — let&apos;s run LLMs on those instead of
            building another thirsty datacenter.
          </h2>
          <button
            type="button"
            onClick={onGoChat}
            className="mt-4 rounded-md bg-cy-green px-6 py-3 text-[14px] font-medium text-white transition-colors hover:bg-cy-green-dark"
          >
            Try it now
          </button>
        </div>
      </section>
    </div>
  )
}
