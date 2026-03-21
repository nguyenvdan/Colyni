import { useMachineRole } from '@/hooks/use-machine-role'

export function RoleBanner() {
  const { role, coordinatorApiUrl } = useMachineRole()
  const missing = role === 'contributor' && !coordinatorApiUrl.trim()

  return (
    <div
      className={`mx-auto max-w-[1100px] px-6 md:px-12 ${missing ? 'pt-3' : 'pt-2'}`}
      role="status"
    >
      {role === 'coordinator' ? (
        <p className="rounded-xl border border-cy-green/25 bg-cy-green-light/60 px-4 py-3 text-[13px] leading-snug text-cy-secondary">
          <span className="font-semibold text-cy-text">This Mac runs the LLM</span>
          <span className="text-cy-muted"> — </span>
          Chat and the Colyni API use this computer. Others can switch to &quot;Contributor&quot; in
          Settings and point at your LAN IP (port 8787).
        </p>
      ) : missing ? (
        <p className="rounded-xl border border-cy-error/25 bg-cy-error-light px-4 py-3 text-[13px] leading-snug text-cy-error">
          <span className="font-semibold">Contributor mode needs a coordinator URL</span>
          {' — '}
          Open Settings and paste the host Mac&apos;s Colyni API (e.g.{' '}
          <span className="font-mono text-[12px]">http://192.168.x.x:8787</span>).
        </p>
      ) : (
        <p className="rounded-xl border border-cy-border bg-cy-inset px-4 py-3 text-[13px] leading-snug text-cy-secondary">
          <span className="font-semibold text-cy-text">Contributing from this Mac</span>
          <span className="text-cy-muted"> — </span>
          Chat and credits go through{' '}
          <span className="font-mono text-[12px] text-cy-text">{coordinatorApiUrl}</span>. Keep your
          local <span className="font-mono text-[12px]">colyni-cluster</span> worker running so this
          machine can help run models.
        </p>
      )}
    </div>
  )
}
