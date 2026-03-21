/** Turn inference proxy errors into short, actionable copy. */
export function formatChatApiError(status: number, rawBody: string): string {
  const trimmed = rawBody.trim()
  if (!trimmed) {
    return status === 0 ? 'Network error — check URL and CORS.' : `Request failed (${status}).`
  }

  try {
    const j = JSON.parse(trimmed) as {
      error?: { message?: string }
      detail?: string | { msg?: string }
    }
    const msg =
      j.error?.message ??
      (typeof j.detail === 'string' ? j.detail : (j.detail as { msg?: string })?.msg) ??
      ''

    if (status === 404 && /no instance found for model/i.test(msg)) {
      return (
        'This model is in the catalog but not loaded as a running instance on the cluster yet. ' +
        'Open the cluster dashboard (usually :52415), place or download the model, wait until it’s running, then chat again — ' +
        'or pick a different favorite in Settings that already has an instance.'
      )
    }

    if (msg) return msg
  } catch {
    /* not JSON */
  }

  if (trimmed.length > 280) {
    return `${trimmed.slice(0, 240)}…`
  }
  return trimmed
}
