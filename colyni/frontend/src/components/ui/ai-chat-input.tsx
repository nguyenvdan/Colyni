import { AnimatePresence, motion } from 'motion/react'
import { Globe as GlobeIcon, Lightbulb, Paperclip, ArrowUp, Cpu, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

const PLACEHOLDERS = [
  'Ask something…',
  'Summarize in plain language',
  'Draft a short update',
  'Explain how this cluster works',
]

export type AIChatInputProps = {
  onSend: (text: string) => void
  disabled?: boolean
  modelId: string
  onModelIdChange: (id: string) => void
  modelOptions: { id: string; label?: string }[]
  /** Shown when `modelOptions` is empty (e.g. no favorites yet). */
  modelOptionsEmptyHint?: string
  thinkEnabled?: boolean
  onThinkToggle?: (enabled: boolean) => void
}

export function AIChatInput({
  onSend,
  disabled = false,
  modelId,
  onModelIdChange,
  modelOptions,
  modelOptionsEmptyHint,
  thinkEnabled = false,
  onThinkToggle,
}: AIChatInputProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const [isActive, setIsActive] = useState(false)
  const [deepSearchActive, setDeepSearchActive] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isActive || inputValue) return

    const interval = window.setInterval(() => {
      setShowPlaceholder(false)
      window.setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
        setShowPlaceholder(true)
      }, 400)
    }, 3000)

    return () => window.clearInterval(interval)
  }, [isActive, inputValue])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if (!inputValue) setIsActive(false)
      }
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setModelDropdownOpen(false)
      }
    }

    // Use "click" so button/target handlers run before we treat it as an outside press.
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [inputValue])

  const handleActivate = () => setIsActive(true)

  const containerVariants = {
    collapsed: {
      height: 64,
      transition: { type: 'spring' as const, stiffness: 120, damping: 18 },
    },
    expanded: {
      height: 116,
      transition: { type: 'spring' as const, stiffness: 120, damping: 18 },
    },
  }

  const placeholderContainerVariants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  }

  const letterVariants = {
    initial: { opacity: 0, filter: 'blur(12px)', y: 10 },
    animate: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        opacity: { duration: 0.25 },
        filter: { duration: 0.4 },
        y: { type: 'spring' as const, stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0,
      filter: 'blur(12px)',
      y: -10,
      transition: {
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
        y: { type: 'spring' as const, stiffness: 80, damping: 20 },
      },
    },
  }

  function submit() {
    const t = inputValue.trim()
    if (!t || disabled) return
    onSend(t)
    setInputValue('')
  }

  const hasInput = inputValue.trim().length > 0

  const resolvedModelLabel = (() => {
    if (!modelId.trim()) return 'Choose a model'
    if (modelOptions.length === 0) return 'No models'
    const match = modelOptions.find((m) => m.id === modelId)
    const display = match?.label ?? match?.id ?? modelId
    if (display.length > 24) return display.slice(0, 22) + '…'
    return display
  })()

  return (
    <div className="w-full text-cy-text">
      <motion.div
        ref={wrapperRef}
        className="w-full max-w-3xl"
        variants={containerVariants}
        animate={isActive || inputValue ? 'expanded' : 'collapsed'}
        initial="collapsed"
        style={{
          // Dropdown is `bottom-full`; hidden would clip it so clicks miss the menu.
          overflow: modelDropdownOpen ? 'visible' : 'hidden',
          borderRadius: 14,
        }}
      >
        <div className="flex h-full w-full flex-col items-stretch rounded-[14px] border border-cy-border bg-cy-surface shadow-sm transition-shadow focus-within:shadow-md">
          <div
            className="flex w-full items-center gap-1.5 px-3 py-2.5"
            onClick={(e) => {
              const t = e.target as HTMLElement
              if (t.closest('button')) return
              handleActivate()
            }}
          >
            {/* Attach */}
            <button
              className="rounded-lg p-2 text-cy-muted transition hover:bg-cy-inset hover:text-cy-secondary"
              title="Attach"
              type="button"
              tabIndex={-1}
            >
              <Paperclip size={17} strokeWidth={1.5} />
            </button>

            {/* Model dropdown */}
            <div ref={modelRef} className="relative">
              <button
                type="button"
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-cy-muted transition hover:bg-cy-inset hover:text-cy-secondary"
                title="Select model"
                onClick={(e) => {
                  e.stopPropagation()
                  setModelDropdownOpen((v) => !v)
                }}
              >
                <Cpu size={16} strokeWidth={1.5} />
                <ChevronDown size={12} strokeWidth={2} />
              </button>
              {modelDropdownOpen && (
                <div className="absolute bottom-full left-0 z-[200] mb-2 min-w-[220px] rounded-lg border border-cy-border bg-cy-surface py-1 shadow-lg">
                  <p className="px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider text-cy-muted">
                    Model
                  </p>
                  {modelId && modelOptions.length > 0 && (
                    <button
                      type="button"
                      className="w-full px-3 py-1.5 text-left text-[12px] text-cy-muted transition hover:bg-cy-inset"
                      onClick={(e) => {
                        e.stopPropagation()
                        onModelIdChange('')
                        setModelDropdownOpen(false)
                      }}
                    >
                      Clear selection
                    </button>
                  )}
                  {modelOptions.length === 0 ? (
                    <p className="px-3 py-2 text-[13px] text-cy-muted">
                      {modelOptionsEmptyHint ?? 'No models loaded'}
                    </p>
                  ) : (
                    modelOptions.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-cy-inset',
                          m.id === modelId ? 'text-cy-green font-medium' : 'text-cy-text',
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          onModelIdChange(m.id)
                          setModelDropdownOpen(false)
                        }}
                      >
                        {m.id === modelId && (
                          <span className="h-1.5 w-1.5 rounded-full bg-cy-green" />
                        )}
                        <span className={m.id === modelId ? '' : 'ml-3.5'}>
                          {m.label ?? m.id}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submit()
                  }
                }}
                disabled={disabled}
                className="relative z-[1] w-full flex-1 rounded-md border-0 bg-transparent py-2 text-[14px] font-normal text-cy-text outline-none placeholder:text-transparent"
                onFocus={handleActivate}
              />
              <div className="pointer-events-none absolute left-0 top-0 flex h-full w-full items-center py-2">
                <AnimatePresence mode="wait">
                  {showPlaceholder && !isActive && !inputValue && (
                    <motion.span
                      key={placeholderIndex}
                      className="absolute left-0 top-1/2 -translate-y-1/2 select-none text-[14px] text-cy-muted"
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', zIndex: 0 }}
                      variants={placeholderContainerVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      {PLACEHOLDERS[placeholderIndex].split('').map((char, i) => (
                        <motion.span
                          key={i}
                          variants={letterVariants}
                          style={{ display: 'inline-block' }}
                        >
                          {char === ' ' ? '\u00A0' : char}
                        </motion.span>
                      ))}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Current model label (subtle) */}
            <span className="hidden text-[11px] font-medium text-cy-muted sm:block">
              {resolvedModelLabel}
            </span>

            {/* Send */}
            <button
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-all',
                hasInput && !disabled
                  ? 'bg-cy-text text-white hover:bg-cy-secondary'
                  : 'bg-cy-border text-cy-muted',
              )}
              title="Send"
              type="button"
              disabled={disabled || !hasInput}
              onClick={(e) => {
                e.stopPropagation()
                submit()
              }}
            >
              <ArrowUp size={15} strokeWidth={2.5} />
            </button>
          </div>

          {/* Expanded toolbar */}
          <motion.div
            className="flex w-full items-center justify-start px-3 pb-3 text-sm"
            variants={{
              hidden: { opacity: 0, y: 10, pointerEvents: 'none' as const, transition: { duration: 0.15 } },
              visible: { opacity: 1, y: 0, pointerEvents: 'auto' as const, transition: { duration: 0.25, delay: 0.05 } },
            }}
            initial="hidden"
            animate={isActive || inputValue ? 'visible' : 'hidden'}
          >
            <div className="flex flex-wrap items-center gap-2">
              {onThinkToggle && (
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                    thinkEnabled
                      ? 'border border-cy-green bg-cy-green-light text-cy-green-dark'
                      : 'border border-transparent bg-cy-inset text-cy-secondary hover:text-cy-text',
                  )}
                  title="Think"
                  onClick={(e) => {
                    e.stopPropagation()
                    onThinkToggle(!thinkEnabled)
                  }}
                >
                  <Lightbulb size={14} strokeWidth={1.5} />
                  Think
                </button>
              )}

              <motion.button
                type="button"
                className={cn(
                  'flex items-center justify-start overflow-hidden rounded-md border py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors',
                  deepSearchActive
                    ? 'border-cy-green bg-cy-green-light text-cy-green-dark'
                    : 'border-transparent bg-cy-inset text-cy-secondary hover:text-cy-text',
                )}
                title="Deep search"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeepSearchActive((a) => !a)
                }}
                initial={false}
                animate={{
                  width: deepSearchActive ? 110 : 32,
                  paddingLeft: deepSearchActive ? 8 : 8,
                }}
              >
                <div className="flex flex-1 justify-center">
                  <GlobeIcon size={14} strokeWidth={1.5} />
                </div>
                <motion.span
                  className="pb-px"
                  initial={false}
                  animate={{ opacity: deepSearchActive ? 1 : 0 }}
                >
                  Deep search
                </motion.span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
