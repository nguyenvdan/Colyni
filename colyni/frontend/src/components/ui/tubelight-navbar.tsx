import { motion } from 'motion/react'
import { type LucideIcon, Sun, Moon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/theme'

export interface NavItem {
  name: string
  id: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  className?: string
}

export function NavBar({ items, activeTab, onTabChange, className }: NavBarProps) {
  const { theme, toggle } = useTheme()

  return (
    <div
      className={cn(
        'fixed bottom-0 left-1/2 z-[60] mb-6 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 touch-manipulation sm:top-0 sm:pt-6',
        className,
      )}
    >
      <div className="flex items-center gap-1 rounded-full border border-cy-border bg-cy-surface/80 px-1 py-1 shadow-lg backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                'relative min-h-[44px] min-w-[44px] cursor-pointer rounded-full px-4 py-2 text-sm font-semibold transition-colors md:min-h-0 md:min-w-0 md:px-5',
                'text-cy-secondary hover:text-cy-text',
                isActive && 'text-cy-text',
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 -z-10 w-full rounded-full bg-cy-green/10"
                  initial={false}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-cy-green">
                    <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-cy-green/20 blur-md" />
                    <div className="absolute -top-1 h-6 w-8 rounded-full bg-cy-green/20 blur-md" />
                    <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-cy-green/20 blur-sm" />
                  </div>
                </motion.div>
              )}
            </button>
          )
        })}

        {/* Theme toggle */}
        <div className="mx-1 h-5 w-px bg-cy-border" />
        <button
          type="button"
          onClick={toggle}
          className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full p-2 text-cy-secondary transition-colors hover:text-cy-text md:min-h-0 md:min-w-0"
          title={theme === 'light' ? 'Ride into night mode' : 'High noon (frontier theme)'}
        >
          {theme === 'light' ? (
            <Moon size={16} strokeWidth={2} />
          ) : (
            <Sun size={16} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  )
}
