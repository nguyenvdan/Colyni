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
          <span className="font-semibold text-cy-text">You’re on the main computer</span>
          <span className="text-cy-muted"> — </span>
          Friends connect to you in Settings. You don’t need to do anything special here — just
          chat like normal.
        </p>
      ) : missing ? (
        <p className="rounded-xl border border-cy-error/25 bg-cy-error-light px-4 py-3 text-[13px] leading-snug text-cy-error">
          <span className="font-semibold">One more step</span>
          {' — '}
          Open <span className="font-medium">Settings</span> and paste the link your friend gave you
          (or ask them to send the invite link again).
        </p>
      ) : (
        <p className="rounded-xl border border-cy-border bg-cy-inset px-4 py-3 text-[13px] leading-snug text-cy-secondary">
          <span className="font-semibold text-cy-text">You’re helping a friend’s computer</span>
          <span className="text-cy-muted"> — </span>
          Chat goes through their machine. Leave the helper app running on this laptop so you can
          share GPU power.
        </p>
      )}
    </div>
  )
}
