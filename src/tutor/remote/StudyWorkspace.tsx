import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, LogOut, MessageCircle, Send, ShieldCheck } from 'lucide-react'
import { ApiError, createStudyClient, safeSourceUrl } from './client'
import type { Health, Identity, Need, Participant, Problem, Profile, Recommendations, Session, SessionHead, Turn } from './client'
import { ProblemStatement } from './ProblemStatement'
import { SessionClock } from './SessionClock'
import { SessionDialog } from './SessionDialog'
import { formatDuration } from './sessionTime'
import './study.css'

const ACCESS_KEY = 'tesis-pc:access:v1'
const needLabels: Record<Need, string> = { comprension: 'Entender el problema', concepto: 'Comprender un concepto', idea: 'Revisar mi idea', depuracion: 'Revisar mi código', practica: 'Elegir qué practicar' }
function readToken() { try { return sessionStorage.getItem(ACCESS_KEY) ?? '' } catch { return '' } }
function date(value: string) { return new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) }

function Answer({ turn }: { turn: Turn }) {
  return <div className="study-answer">
    <div className="study-message-label">Tutor · {needLabels[turn.intervention]} {turn.help_level !== null && <span>N{turn.help_level}</span>}</div>
    <p className="study-prose">{turn.message}</p>
    {turn.code_observation && <p className="study-note">Lectura del código: {turn.code_observation}</p>}
    {turn.reported_result && <p className="study-note">Resultado declarado, no verificado: {turn.reported_result}</p>}
    <details><summary>Comprobación y fuentes ({turn.sources.length})</summary>
      <p>{turn.checks.status}: {turn.checks.detail}</p>
      {turn.checks.total > 0 && <p>{turn.checks.passed}/{turn.checks.total} pruebas disponibles superadas.</p>}
      {turn.sources.map(source => <div className="study-source" key={source.chunk_id}>
        <strong>{source.title}</strong><span>{source.provenance.platform} · {source.provenance.review_status}</span>
        {safeSourceUrl(source.provenance.url) && <a href={safeSourceUrl(source.provenance.url)} target="_blank" rel="noreferrer">Consultar fuente</a>}
      </div>)}
    </details>
  </div>
}

export function StudyWorkspace() {
  useEffect(() => {
    const previous = document.title
    document.title = 'Tutor · Sesiones de tesis'
    return () => { document.title = previous }
  }, [])
  const [token, setToken] = useState(readToken)
  const api = useMemo(() => createStudyClient(token), [token])
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [sessions, setSessions] = useState<SessionHead[]>([])
  const [session, setSession] = useState<Session | null>(null)
  const [problemId, setProblemId] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [newAccess, setNewAccess] = useState<{ label: string; code: string } | null>(null)
  const [loginCode, setLoginCode] = useState('')
  const [label, setLabel] = useState('')
  const [isTest, setIsTest] = useState(false)
  const [message, setMessage] = useState('')
  const [code, setCode] = useState('')
  const [reportedResult, setReportedResult] = useState('')
  const [need, setNeed] = useState<Need>('comprension')
  const [execute, setExecute] = useState(false)
  const [goal, setGoal] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dialog, setDialog] = useState<'start' | 'finish' | null>(null)
  const lock = useRef(false)
  const refreshVersion = useRef(0)
  const problem = problems.find(p => p.id === (session?.problem_id ?? problemId))
  const activeSession = sessions.find(item => item.measurement?.status === 'active')
  const isActive = session?.measurement?.status === 'active'

  function saveToken(next: string) {
    try { next ? sessionStorage.setItem(ACCESS_KEY, next) : sessionStorage.removeItem(ACCESS_KEY) } catch { /* memory-only access remains usable */ }
    setToken(next)
  }
  function clearView() {
    setIdentity(null); setSession(null); setSessions([]); setProfile(null); setParticipants([])
    setNewAccess(null); setRecommendations(null); setMessage(''); setCode(''); setReportedResult('')
    setDialog(null)
  }
  async function perform(description: string, action: () => Promise<void>) {
    if (lock.current) return
    refreshVersion.current += 1
    lock.current = true; setBusy(description); setError(''); setNotice('')
    try { await action() }
    catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo completar la acción.')
      if (caught instanceof ApiError && caught.status === 401) { saveToken(''); clearView() }
    } finally { lock.current = false; setBusy('') }
  }

  useEffect(() => {
    if (!token) return
    let live = true
    setBusy('Conectando con tu tutor…')
    void (async () => {
      try {
        const [who, status, catalog] = await Promise.all([api.me(), api.health(), api.problems()])
        const history = who.role === 'student' ? await api.sessions() : []
        const roster = who.role === 'teacher' ? await api.participants() : []
        if (!live) return
        setIdentity(who); setHealth(status); setProblems(catalog); setProblemId(catalog[0]?.id ?? '')
        setSessions(history); setParticipants(roster)
        const active = history.find(item => item.measurement?.status === 'active')
        if (active) {
          const restored = await api.session(active.id)
          if (live) { setSession(restored); setProblemId(restored.problem_id) }
        }
      } catch (caught) {
        if (!live) return
        setError(caught instanceof Error ? caught.message : 'No se pudo conectar.')
        if (caught instanceof ApiError && caught.status === 401) { saveToken(''); clearView() }
      } finally { if (live) setBusy('') }
    })()
    return () => { live = false }
  }, [api, token])

  // Restore authoritative state after another tab finishes or starts a session.
  useEffect(() => {
    if (identity?.role !== 'student') return
    let live = true
    const refresh = async () => {
      if (document.visibilityState === 'hidden' || lock.current) return
      const version = ++refreshVersion.current
      try {
        const history = await api.sessions()
        if (!live || lock.current || version !== refreshVersion.current) return
        setSessions(history)
        const current = history.find(item => item.id === session?.id)
        if (current) setSession(previous => previous?.id === current.id ? { ...previous, measurement: current.measurement } : previous)
      } catch { /* Foreground actions surface connection and access errors. */ }
    }
    const timer = window.setInterval(() => { void refresh() }, 15000)
    document.addEventListener('visibilitychange', refresh)
    return () => { live = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [api, identity?.role, session?.id])

  function login(event: FormEvent) {
    event.preventDefault()
    void perform('Comprobando tu acceso…', async () => {
      const result = await api.login(loginCode.trim())
      clearView(); saveToken(result.token); setLoginCode('')
    })
  }
  function logout() {
    void perform('Cerrando sesión…', async () => {
      await api.logout(); saveToken(''); clearView(); setNotice('Sesión cerrada. Tus avances permanecen en el servidor.')
    })
  }
  async function openSession(id: string) {
    const result = await api.session(id)
    setSession(result); setProblemId(result.problem_id); setMessage(''); setCode(''); setReportedResult(''); setExecute(false)
  }
  function confirmSession(outcome?: 'completed' | 'stopped') {
    void perform(dialog === 'finish' ? 'Guardando el tiempo de la sesión…' : 'Iniciando la sesión…', async () => {
      if (dialog === 'finish' && session) {
        const finished = await api.finish(session.id, outcome ?? 'stopped')
        setSession(finished)
        setSessions(previous => previous.map(item => item.id === finished.id ? finished : item))
        setNotice('Sesión finalizada. El tiempo quedó registrado.')
      } else {
        let opened: Session
        if (session && !session.measurement) opened = await api.resume(session.id, true)
        else {
          const head = await api.start(problemId, true)
          opened = { ...head, interactions: session?.id === head.id ? session.interactions : [] }
        }
        // Show a committed start immediately, even when a later read fails.
        setSession(opened); setProblemId(opened.problem_id); setMessage(''); setCode(''); setReportedResult(''); setExecute(false)
        setSessions(previous => [...previous.filter(item => item.id !== opened.id), opened])
        setDialog(null)
        try { setSession(await api.session(opened.id)) }
        catch { setNotice('Sesión iniciada. El contador está activo; actualiza el historial si falta una conversación anterior.') }
      }
      setDialog(null)
      try { setSessions(await api.sessions()) }
      catch { setNotice('El cambio quedó guardado. La lista de sesiones se actualizará cuando vuelva la conexión.') }
    })
  }
  function send(event: FormEvent) {
    event.preventDefault()
    if (!session || !isActive || !message.trim()) return
    const active = session.id
    void perform('El tutor está revisando tu consulta. Puede tardar unos minutos…', async () => {
      try {
        await api.ask(active, { message: message.trim(), need, request_execution: execute,
          ...(code.trim() ? { code } : {}), ...(reportedResult.trim() ? { reported_result: reportedResult.trim() } : {}) })
        // A successful write must never be silently retried when a later read fails.
        setMessage(''); setReportedResult(''); setExecute(false)
        setNotice('Respuesta guardada en tu sesión.')
      } finally {
        try { setSession(await api.session(active)) } catch { /* keep the original failure and the last visible history */ }
      }
    })
  }
  function enroll(event: FormEvent) {
    event.preventDefault()
    void perform('Creando acceso individual…', async () => {
      setNewAccess(await api.enroll(label.trim(), isTest)); setLabel(''); setParticipants(await api.participants())
    })
  }
  function exportStudy() {
    void perform('Preparando los registros…', async () => {
      const data = await api.exportData()
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = `sesiones-tesis-${new Date().toISOString().slice(0, 10)}.json`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice('Registros descargados. Los participantes de prueba se excluyeron.')
    })
  }

  return <div className="study-page">
    <header className="study-heading"><div><span className="eyebrow">PROGRAMACIÓN COMPETITIVA · SESIONES DE TESIS</span>
      <h1>Tutor de programación competitiva</h1><p>Un problema a la vez. Orientación para construir tu propia solución.</p></div>
      {identity && <button className="study-secondary" onClick={logout} disabled={!!busy}><LogOut size={16} /> Salir</button>}
    </header>
    {error && <div className="study-error" role="alert">{error}</div>}
    <div className="study-status" role="status" aria-live="polite">{busy || notice}</div>
    {!identity ? <section className="study-login study-card">
      <ShieldCheck className="study-mark" size={32} /><h2>Bienvenido a tu sesión</h2>
      <p>Ingresa el código personal que te entregó el investigador.</p>
      <form onSubmit={login}><label>Código de acceso<input type="password" autoComplete="off" required maxLength={200} value={loginCode} onChange={e => setLoginCode(e.target.value)} disabled={!!busy} /></label>
        <button className="study-primary" disabled={!!busy || !loginCode.trim()}>Entrar al tutor</button></form>
      <p className="study-note">Las consultas, el código y las respuestas se guardan para la investigación. Usa tu identificador asignado y evita incluir datos personales en los mensajes.</p>
      {token && !busy && <button className="study-secondary" onClick={() => { saveToken(''); clearView() }}>Volver al acceso</button>}
    </section> : identity.role === 'teacher' ? <div className="study-teacher">
      <section className="study-card"><span className="eyebrow">VISTA DEL INVESTIGADOR</span><h2>Accesos de los participantes</h2>
        <p>Crea un acceso por alumno. Usa un seudónimo como A001 y conserva la correspondencia fuera del sistema.</p>
        <form onSubmit={enroll} className="study-enroll"><label>Identificador del participante<input value={label} onChange={e => setLabel(e.target.value)} maxLength={100} required disabled={!!busy} /></label>
          <label className="study-checkbox"><input type="checkbox" checked={isTest} onChange={e => setIsTest(e.target.checked)} disabled={!!busy} /> Participante de prueba (excluir del estudio)</label>
          <button className="study-primary" disabled={!!busy || !label.trim()}>Crear acceso</button></form>
        {newAccess && <div className="study-access" role="status"><strong>Acceso de {newAccess.label}</strong><code>{newAccess.code}</code><p>Compártelo solo con este participante. Se muestra una única vez.</p><button className="study-secondary" onClick={() => setNewAccess(null)}>Ocultar código</button></div>}
        <div className="study-roster">{participants.map(p => <article key={p.student_id}><div><strong>{p.label}</strong><p>{p.is_test ? 'Prueba' : 'Participante'} · {p.session_count} sesiones · {p.revoked ? 'Acceso revocado' : 'Activo'}</p></div>
          {!p.revoked && <button className="study-secondary" disabled={!!busy} onClick={() => {
            if (window.confirm(`¿Revocar el acceso de ${p.label}? Sus registros se conservarán.`)) void perform('Revocando acceso…', async () => { await api.revoke(p.student_id); setParticipants(await api.participants()) })
          }}>Revocar acceso</button>}</article>)}</div>
      </section>
      <aside className="study-card"><h2>Registro de la investigación</h2><p>Descarga las sesiones, tiempos por problema, confirmaciones de enfoque, consultas y observaciones del perfil.</p>
        <button className="study-primary" onClick={exportStudy} disabled={!!busy}>Descargar registros</button>
        <p className="study-note">Los accesos y las claves no forman parte de la exportación. Los participantes marcados como prueba quedan excluidos.</p>
        <p className="study-note">El tiempo transcurrido incluye lectura, espera del tutor y tiempo fuera de la pestaña. Finalizar es una declaración del participante; no certifica una solución aceptada.</p>
        <h3>Disponibilidad</h3><p>Material: {health?.index_ready ? 'listo' : 'requiere indexación'}</p><p>Modelo: {health?.llm_configured ? 'configurado' : 'sin configurar'}</p>
        <p className="study-note">“Configurado” no confirma que el modelo esté encendido. Este equipo atiende una consulta a la vez; las demás reciben un aviso para reintentar.</p>
      </aside>
    </div> : <>
      <div className="study-session-bar"><strong><ShieldCheck size={16} /> {identity.student?.name}</strong><span>Tu progreso se guarda en el servidor</span></div>
      {activeSession && activeSession.id !== session?.id && <div className="study-focus-banner"><p>Tienes una sesión en curso. Finalízala antes de comenzar otro problema.</p><button className="study-secondary" disabled={!!busy} onClick={() => void perform('Recuperando la sesión activa…', () => openSession(activeSession.id))}>Volver al problema activo</button></div>}
      {(!health?.index_ready || !health.llm_configured) && <div className="study-error">El tutor necesita preparación del investigador antes de generar respuestas.</div>}
      <div className="study-layout">
        <aside className="study-left">
          <section className="study-card"><h2><BookOpen size={19} /> Problema de la sesión</h2>
            <label>Seleccionar problema<select value={problemId} disabled={!!busy || !!activeSession} onChange={e => { setProblemId(e.target.value); setSession(null); setMessage(''); setCode(''); setReportedResult('') }}>{problems.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
            {isActive && session?.measurement ? <>
              <SessionClock measurement={session.measurement} />
              <p className="study-note">Trabaja únicamente en este problema. El tiempo sigue contando fuera de esta pestaña y durante la espera del tutor.</p>
              <button className="study-primary" onClick={() => { setError(''); setDialog('finish') }} disabled={!!busy}>Finalizar sesión</button>
            </> : <>
              {session?.measurement && <><SessionClock measurement={session.measurement} /><p className="study-note">{session.measurement.outcome === 'completed' ? 'Solución terminada según el participante.' : 'Sesión detenida sin terminar.'}</p></>}
              {session && !session.measurement && <p className="study-note">Sesión anterior sin medición. El contador comenzará al confirmar que deseas continuar; el tiempo previo no se reconstruye.</p>}
              <button className="study-primary" onClick={() => { setError(''); setDialog('start') }} disabled={!!busy || !problemId || !!activeSession}>{session && !session.measurement ? 'Continuar con medición' : 'Iniciar sesión de resolución'}</button>
            </>}
            <label>Historial de sesiones<select aria-label="Historial de sesiones" value={session?.id ?? ''} disabled={!!busy || !!activeSession} onChange={e => { if (e.target.value) void perform('Recuperando tu sesión…', () => openSession(e.target.value)) }}>
              <option value="">Selecciona una sesión anterior</option>{[...sessions].reverse().map(s => <option key={s.id} value={s.id}>{problems.find(p => p.id === s.problem_id)?.title ?? s.problem_id} · {date(s.created)} · {s.measurement ? `${s.measurement.status === 'active' ? 'En curso' : 'Finalizada'} ${formatDuration(s.measurement.elapsed_seconds)}` : 'Sin medición'}</option>)}</select></label>
          </section>
          {problem && <ProblemStatement key={problem.id} problem={problem} />}
        </aside>
        <section className="study-card study-conversation"><h2><MessageCircle size={20} /> Conversa con tu tutor</h2>
          {!session ? <div className="study-empty"><BookOpen size={36} /><h3>Prepara tu sesión de resolución</h3><p>Selecciona un problema y confirma tu compromiso de trabajar en él. El contador empezará con tu confirmación.</p></div> : <>
            <div className="study-history" aria-label="Historial de la sesión">
              {!session.interactions.length && <p className="study-note">{isActive ? 'Cuéntale al tutor qué has entendido o en qué punto te has detenido.' : 'Esta sesión no contiene consultas al tutor.'}</p>}
              {session.interactions.map(turn => <article className="study-turn" key={turn.id}><div className="study-student-message"><div className="study-message-label">Tú · {date(turn.created)}</div><p className="study-prose">{turn.attempt.message}</p>
                {turn.attempt.code && <details><summary>Ver mi código</summary><pre>{turn.attempt.code}</pre></details>}</div>
                {turn.response ? <Answer turn={turn.response} /> : <p className="study-error">Intento guardado sin respuesta del tutor. No se generó una contestación de respaldo.</p>}
              </article>)}
            </div>
            {isActive ? <form className="study-compose" onSubmit={send}>
              <label>¿Qué necesitas?<select value={need} onChange={e => setNeed(e.target.value as Need)} disabled={!!busy}>{Object.entries(needLabels).filter(([value]) => value !== 'practica').map(([value, title]) => <option key={value} value={value}>{title}</option>)}</select></label>
              <label>Tu consulta<textarea placeholder="Explica qué intentaste y qué te genera dudas…" value={message} onChange={e => setMessage(e.target.value)} required maxLength={12000} rows={4} disabled={!!busy} /></label>
              <details className="study-code"><summary>Adjuntar mi código C++17 (opcional)</summary>
                <label>Mi código<textarea className="study-code-input" value={code} onChange={e => setCode(e.target.value)} maxLength={40000} rows={9} spellCheck={false} disabled={!!busy} /></label>
                <label>Resultado que observaste<input value={reportedResult} onChange={e => setReportedResult(e.target.value)} maxLength={2000} disabled={!!busy} /></label>
                <label className="study-checkbox"><input type="checkbox" checked={execute} onChange={e => setExecute(e.target.checked)} disabled={!!busy || !health?.execution_enabled || !code.trim()} /> Solicitar comprobación aislada</label>
                <p className="study-note">{health?.execution_enabled ? 'El tutor informará si realmente pudo ejecutar las pruebas.' : 'La ejecución está desactivada. El tutor puede revisar el código sin ejecutarlo.'}</p>
              </details>
              <div className="study-send"><button className="study-secondary" type="button" disabled={!!busy} onClick={() => void perform('Actualizando historial…', async () => setSession(await api.session(session.id)))}>Actualizar historial</button><button className="study-primary" disabled={!!busy || !message.trim()}><Send size={16} /> Enviar consulta</button></div>
            </form> : <p className="study-note">{session.measurement ? 'Sesión finalizada. Puedes consultar el historial o iniciar una nueva sesión.' : 'Confirma el inicio de la medición para continuar esta conversación.'}</p>}
          </>}
        </section>
      </div>
      <details className="study-followup"><summary>Seguimiento del aprendizaje</summary><div className="study-bottom">
        <section className="study-card"><h2>Evidencias de aprendizaje</h2><button className="study-secondary" disabled={!!busy} onClick={() => void perform('Consultando tu progreso…', async () => setProfile(await api.profile()))}>Consultar mi perfil</button>
          {profile && <><p>Conocimientos iniciales declarados: {profile.declared_basics.join(', ') || 'ninguno'}.</p>{!profile.observations.length && <p>Aún no hay observaciones respaldadas por tus intentos.</p>}{profile.observations.map(item => <div className="study-source" key={item.id}><strong>{item.concept} · {item.status}</strong><p>{item.note}</p><blockquote>{item.quote}</blockquote></div>)}</>}
        </section>
        <section className="study-card"><h2>Problemas sugeridos</h2><p className="study-note">Disponibles al terminar la sesión actual.</p><label>Tema de interés<input value={goal} onChange={e => setGoal(e.target.value)} maxLength={100} placeholder="Por ejemplo, arreglos" disabled={!!busy || !!activeSession} /></label><button className="study-secondary" disabled={!!busy || !!activeSession} onClick={() => void perform('Buscando problemas…', async () => setRecommendations(await api.recommendations(goal)))}>Ver sugerencias del tutor</button>
          {recommendations && <><p>{recommendations.message}</p>{recommendations.items.map(item => <div className="study-source" key={item.problem.id}><strong>{item.problem.title}</strong><p>{item.reason}</p><button className="study-secondary" disabled={!!busy || !!activeSession} onClick={() => { setSession(null); setProblemId(item.problem.id); setMessage(''); setCode('') }}>Seleccionar problema</button></div>)}</>}
        </section>
      </div></details>
    </>}
    <footer className="study-footer">Tutor personalizado · Las pistas orientan tu proceso; tú construyes la solución.</footer>
    {dialog && problem && <SessionDialog mode={dialog} title={problem.title} busy={!!busy} error={error} onClose={() => setDialog(null)} onConfirm={confirmSession} />}
  </div>
}
