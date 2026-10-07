export interface Problem {
  id: string; title: string; statement: string; constraints: string
  input_format: string; output_format: string; difficulty: number
  examples: { input: string; output: string }[]; topics: string[]; prerequisites: string[]
  provenance: { platform: string; url: string | null; license_note: string; review_status: string }
}
export interface Identity { role: 'teacher' | 'student'; student: { id: string; name: string } | null }
export interface Health { index_ready: boolean; llm_configured: boolean; execution_enabled: boolean }
export interface Measurement {
  started_at: string; ended_at: string | null; elapsed_seconds: number; focus_confirmed_at: string
  status: 'active' | 'finished'; outcome: 'completed' | 'stopped' | null; server_now: string
}
export interface SessionHead { id: string; student_id: string; problem_id: string; created: string; measurement: Measurement | null }
export type Need = 'comprension' | 'concepto' | 'idea' | 'depuracion' | 'practica'
export interface Attempt { message: string; code?: string; need?: Need; reported_result?: string; request_execution: boolean }
export interface Turn {
  interaction_id: string; message: string; intervention: Need; help_level: number | null
  sources: { chunk_id: string; title: string; provenance: Problem['provenance'] }[]
  checks: { status: string; detail: string; passed: number; total: number }
  code_observation: string | null; reported_result: string | null
}
export interface Session extends SessionHead {
  interactions: { id: string; created: string; attempt: Attempt; response: Turn | null; status: 'completed' | 'failed' }[]
}
export interface Profile {
  declared_basics: string[]
  observations: { id: string; concept: string; kind: string; quote: string; note: string; status: string; interaction_id: string }[]
}
export interface Recommendations { items: { problem: Problem; reason: string }[]; message: string }
export interface Participant { student_id: string; label: string; is_test: boolean; revoked: boolean; session_count: number }
interface TurnJob { id: string; status: 'running' | 'completed' | 'failed'; response: Turn | null; error: string | null }
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

/** Relative same-origin requests: credentials and provider configuration stay on the server. */
export function createStudyClient(token: string, fetcher: typeof fetch = fetch) {
  async function request<T>(path: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetcher(`/api/tutor${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      })
    } catch {
      throw new ApiError('Se perdió la conexión. Revisa el historial antes de reenviar: el servidor podría haber guardado tu intento.', 0)
    }
    const data = await response.json().catch(() => null) as { detail?: unknown } | null
    if (!response.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : response.status === 422
        ? 'Revisa los campos: alguno supera el límite permitido o tiene un formato incorrecto.'
        : 'No se pudo completar la solicitud. Revisa la conexión con el tutor.'
      throw new ApiError(detail, response.status)
    }
    if (data === null) throw new ApiError('El servidor devolvió una respuesta inesperada.', response.status)
    return data as T
  }
  return {
    login: (code: string) => request<{ token: string }>('/login', { code }),
    logout: () => request('/logout', {}),
    me: () => request<Identity>('/me'),
    health: () => request<Health>('/health'),
    problems: () => request<Problem[]>('/problems'),
    sessions: () => request<SessionHead[]>('/sessions'),
    session: (id: string) => request<Session>(`/sessions/${encodeURIComponent(id)}`),
    start: (problem_id: string, focus_confirmed: true) => request<SessionHead>('/sessions', { problem_id, focus_confirmed }),
    resume: (id: string, focus_confirmed: true) => request<Session>(`/sessions/${encodeURIComponent(id)}/resume`, { focus_confirmed }),
    finish: (id: string, outcome: 'completed' | 'stopped') => request<Session>(`/sessions/${encodeURIComponent(id)}/finish`, { outcome }),
    ask: async (id: string, body: Attempt) => {
      let job = await request<TurnJob>(`/sessions/${encodeURIComponent(id)}/turns`, { ...body, request_id: crypto.randomUUID() })
      const deadline = Date.now() + 20 * 60_000
      while (job.status === 'running' && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1500))
        job = await request<TurnJob>(`/jobs/${encodeURIComponent(job.id)}`)
      }
      if (job.status !== 'completed' || !job.response) throw new ApiError(job.error ?? 'La consulta sigue pendiente. Actualiza el historial antes de reenviar.', 503)
      return job.response
    },
    profile: () => request<Profile>('/profile'),
    recommendations: (goal: string) => request<Recommendations>(`/recommendations?goal=${encodeURIComponent(goal)}`),
    participants: () => request<Participant[]>('/research/participants'),
    enroll: (label: string, is_test: boolean) => request<{ label: string; code: string }>('/research/participants', { label, is_test }),
    revoke: (id: string) => request(`/research/participants/${encodeURIComponent(id)}/revoke`, {}),
    exportData: () => request<unknown>('/research/export'),
  }
}

export function safeSourceUrl(url: string | null | undefined): string | undefined {
  try { const parsed = new URL(url ?? ''); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined }
  catch { return undefined }
}
