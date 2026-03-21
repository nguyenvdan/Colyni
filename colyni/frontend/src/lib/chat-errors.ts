/** Parsed API error for Chat UI (message + optional “open cluster” CTA). */
export type ChatApiErrorParsed = {
  message: string
  /** True when the model exists in catalog but no GPU instance is running yet. */
  showOpenCluster: boolean
}

/** Turn inference proxy errors into short, actionable copy. */
export function parseChatApiError(status: number, rawBody: string): ChatApiErrorParsed {
  const trimmed = rawBody.trim()
  if (!trimmed) {
    return {
      message:
        status === 0 ? 'Network error — check URL and CORS.' : `Request failed (${status}).`,
      showOpenCluster: false,
    }
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
      return {
        message:
          'This model is sleeping — it isn’t turned on yet. Tap the green button below to turn it on (or pick another star in Settings).',
        showOpenCluster: true,
      }
    }

    if (msg) {
      return { message: msg, showOpenCluster: false }
    }
  } catch {
    /* not JSON */
  }

  if (trimmed.length > 280) {
    return { message: `${trimmed.slice(0, 240)}…`, showOpenCluster: false }
  }
  return { message: trimmed, showOpenCluster: false }
}

export function formatChatApiError(status: number, rawBody: string): string {
  return parseChatApiError(status, rawBody).message
}
