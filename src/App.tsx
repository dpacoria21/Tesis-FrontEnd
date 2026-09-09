import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, Dispatch, SetStateAction } from 'react'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Dices,
  ExternalLink,
  Flame,
  FolderKanban,
  Gauge,
  History,
  Home,
  ListFilter,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  X,
} from 'lucide-react'
import { FERNANDO_BENITO_BASELINE as baseline } from './data/baseline'
import { seedProblems } from './data/seedProblems'
import { FAILURE_CAUSES, TRAINING_PHASES, TRAINING_WEEKS } from './data/trainingPlan'
import { generateRandomSession } from './domain/randomSession'
import { generateDailyRecommendations } from './domain/recommendations'
import {
  clearTrainingState,
  initializeProblemCatalog,
  loadTrainingState,
  replaceProblemCatalog,
  saveTrainingState,
} from './storage'
import {
  fetchProblemset,
  fetchContestList,
  fetchUserRating,
  fetchUserStatus,
  fetchUserInfo,
  problemsetToCatalog,
} from './services/codeforces'
import type {
  CodeforcesRatingChange,
  CodeforcesContest,
  CodeforcesSubmission,
  DailyRecommendation,
  SessionCause,
  ProblemCatalogEntry,
  SessionLog,
  TrainingState,
} from './types'
import { TutorWorkspace } from './tutor/ui/TutorWorkspace'

type Page = 'today' | 'random' | 'problems' | 'tutor' | 'progress' | 'plan' | 'settings'
type Toast = { id: number; message: string }

const NAVIGATION: Array<{ id: Page; label: string; icon: typeof Home }> = [
  { id: 'today', label: 'Entrenamiento de hoy', icon: Home },
  { id: 'random', label: 'Sesión random', icon: Dices },
  { id: 'problems', label: 'Explorar problemas', icon: FolderKanban },
  { id: 'tutor', label: 'Tutor IA', icon: BrainCircuit },
  { id: 'progress', label: 'Mi progreso', icon: BarChart3 },
  { id: 'plan', label: 'Plan de 12 semanas', icon: BookOpen },
  { id: 'settings', label: 'Configuración', icon: Settings },
]

const PAGE_TITLES: Record<Page, string> = {
  today: 'Entrenamiento de hoy',
  random: 'Sesión random',
  problems: 'Explorar problemas',
  tutor: 'Tutor IA',
  progress: 'Mi progreso',
  plan: 'Plan de 12 semanas',
  settings: 'Configuración',
}

function localDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function problemId(problem: { contestId?: number; problemsetName?: string; index: string }): string {
  return `${problem.contestId ?? problem.problemsetName ?? 'unknown'}${problem.index}`
}

function formatSpanishDate(date = new Date()): string {
  const value = new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getWeekNumber(date = new Date()): number {
  const start = new Date('2026-08-17T12:00:00-05:00').getTime()
  return Math.min(12, Math.max(1, Math.floor((date.getTime() - start) / 604_800_000) + 1))
}

function cloneState(state: TrainingState): TrainingState {
  return JSON.parse(JSON.stringify(state)) as TrainingState
}

function defaultState(): TrainingState {
  return loadTrainingState()
}

function App() {
  const [page, setPage] = useState<Page>('today')
  const [state, setState] = useState<TrainingState>(defaultState)
  const [catalog, setCatalog] = useState<ProblemCatalogEntry[]>(seedProblems)
  const [contests, setContests] = useState<CodeforcesContest[]>(loadCachedContests)
  const [ratingHistory, setRatingHistory] = useState<CodeforcesRatingChange[]>([])
  const [liveRating, setLiveRating] = useState(baseline.currentRating)
  const [maxRating, setMaxRating] = useState(baseline.maxRating)
  const [isSyncing, setIsSyncing] = useState(false)
  const [activeRecommendation, setActiveRecommendation] = useState<DailyRecommendation | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [filters, setFilters] = useState({ search: '', rating: 'all', tag: 'all', status: 'all' })
  const fileInput = useRef<HTMLInputElement>(null)
  const weekNumber = getWeekNumber()
  const todayKey = localDateKey()

  useEffect(() => {
    initializeProblemCatalog().then(setCatalog).catch(() => setCatalog(seedProblems))
    if (loadCachedContests().length) return
    fetchContestList(false)
      .then((items) => setContests(cacheContests(items)))
      .catch(() => undefined)
  }, [])

  function notify(message: string) {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600)
  }

  function commit(nextOrUpdater: TrainingState | ((previous: TrainingState) => TrainingState)) {
    setState((previous) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater
      return saveTrainingState(next)
    })
  }

  const allSolved = useMemo(
    () => new Set([
      ...state.completedProblemIds,
      ...state.syncedSolvedProblemIds,
      ...Object.values(state.progress).filter((entry) => entry.status === 'solved').map((entry) => entry.problemId),
    ]),
    [state.completedProblemIds, state.syncedSolvedProblemIds, state.progress],
  )

  const recentIds = useMemo(
    () => state.recommendationHistory.filter((entry) => entry.date !== todayKey).slice(-4).flatMap((entry) => entry.problemIds),
    [state.recommendationHistory, todayKey],
  )

  const recommendations = useMemo(() => {
    const generated = generateDailyRecommendations({
      problems: catalog,
      currentRating: liveRating,
      targetRating: state.preferences.targetRating,
      weakTags: state.weakTags.length ? state.weakTags : ['implementation', 'greedy', 'binary search', 'dp'],
      solvedProblemIds: allSolved,
      completedProblemIds: state.completedProblemIds,
      recentlyRecommendedProblemIds: recentIds,
      date: todayKey,
    })
    const reliabilitySessions = (state.sessionLogs ?? []).filter((session) => {
      const problem = catalog.find((entry) => entry.id === session.problemId)
      return session.result === 'solved' && problem && problem.rating >= 1200 && problem.rating <= 1600
    })
    const firstSubmitRate = reliabilitySessions.length
      ? reliabilitySessions.filter((session) => session.firstSubmit).length / reliabilitySessions.length * 100
      : 0
    const requiredRate = weekNumber <= 4 ? 75 : weekNumber <= 8 ? 80 : 85
    const stretchUnlocked = reliabilitySessions.length >= 4 && firstSubmitRate >= requiredRate
    return state.preferences.enableStretch === false || !stretchUnlocked
      ? generated.filter((item) => item.slot !== 'stretch')
      : generated
  }, [catalog, liveRating, state.preferences.targetRating, state.preferences.enableStretch, state.weakTags, state.completedProblemIds, state.sessionLogs, allSolved, recentIds, todayKey, weekNumber])

  useEffect(() => {
    if (!recommendations.length) return
    const existing = state.recommendationHistory.find((entry) => entry.date === todayKey)
    const ids = recommendations.map((item) => item.problem.id)
    if (existing && existing.problemIds.join('|') === ids.join('|')) return
    commit((previous) => ({
      ...previous,
      recommendationHistory: [
        ...previous.recommendationHistory.filter((entry) => entry.date !== todayKey),
        { date: todayKey, problemIds: ids },
      ].slice(-30),
    }))
    // recommendations is intentionally the trigger; state history is handled inside commit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, recommendations.map((item) => item.problem.id).join('|')])

  const sessionLogs: SessionLog[] = state.sessionLogs ?? []
  const solvedSessions = sessionLogs.filter((session) => session.result === 'solved')
  const eligibleReliability = solvedSessions.filter((session) => {
    const problem = catalog.find((entry) => entry.id === session.problemId)
    return problem && problem.rating >= 1200 && problem.rating <= 1600
  })
  const reliability = eligibleReliability.length
    ? Math.round((eligibleReliability.filter((session) => session.firstSubmit).length / eligibleReliability.length) * 100)
    : 0
  const solvedTodayIds = new Set([
    ...sessionLogs.filter((session) => localDateKey(new Date(session.completedAt)) === todayKey && session.result === 'solved').map((session) => session.problemId),
    ...Object.values(state.progress).filter((progress) => progress.status === 'solved' && progress.solvedAt && localDateKey(new Date(progress.solvedAt)) === todayKey).map((progress) => progress.problemId),
  ])
  const solvedToday = solvedTodayIds.size
  const activeDates = new Set([...state.activityDates, ...sessionLogs.map((session) => localDateKey(new Date(session.completedAt)))])
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  const solvedThisWeek = new Set([
    ...solvedSessions.filter((session) => new Date(session.completedAt) >= weekStart).map((session) => session.problemId),
    ...Object.values(state.progress).filter((progress) => progress.status === 'solved' && progress.solvedAt && new Date(progress.solvedAt) >= weekStart).map((progress) => progress.problemId),
  ]).size
  const avgAttempts = solvedSessions.length
    ? (solvedSessions.reduce((sum, session) => sum + session.attempts, 0) / solvedSessions.length).toFixed(1)
    : '—'

  async function syncCodeforces() {
    setIsSyncing(true)
    try {
      const user = await fetchUserInfo(state.handle)
      setLiveRating(user.rating ?? baseline.currentRating)
      setMaxRating(user.maxRating ?? baseline.maxRating)
      const submissions: CodeforcesSubmission[] = []
      for (let from = 1; from <= 4001; from += 1000) {
        const batch = await fetchUserStatus(state.handle, { from, count: 1000 })
        submissions.push(...batch)
        if (batch.length < 1000) break
      }
      const solved = submissions.filter((submission) => submission.verdict === 'OK').map((submission) => problemId(submission.problem))
      const progress = { ...state.progress }
      for (const submission of submissions) {
        const id = problemId(submission.problem)
        const current = progress[id]
        const attempts = submissions.filter((item) => problemId(item.problem) === id).length
        progress[id] = {
          problemId: id,
          status: submission.verdict === 'OK' ? 'solved' : current?.status === 'solved' ? 'solved' : 'attempted',
          attempts,
          source: 'codeforces',
          firstSeenAt: current?.firstSeenAt ?? new Date(submission.creationTimeSeconds * 1000).toISOString(),
          lastAttemptAt: new Date(submission.creationTimeSeconds * 1000).toISOString(),
          solvedAt: submission.verdict === 'OK' ? new Date(submission.creationTimeSeconds * 1000).toISOString() : current?.solvedAt,
        }
      }
      commit((previous) => ({
        ...previous,
        handle: user.handle,
        syncedSolvedProblemIds: [...new Set(solved)],
        progress,
        activityDates: [...new Set([...previous.activityDates, ...submissions.map((submission) => localDateKey(new Date(submission.creationTimeSeconds * 1000)) )])],
        lastSyncAt: new Date().toISOString(),
      }))
      notify(`Sincronizado: ${solved.length} problemas resueltos detectados.`)
      try {
        setRatingHistory(await fetchUserRating(state.handle))
      } catch {
        // Profile and submissions are sufficient for a useful sync.
      }
      try {
        const problemset = await fetchProblemset()
        const normalized = problemsetToCatalog(problemset, 800, 3500)
        if (normalized.length) {
          setCatalog(normalized)
          await replaceProblemCatalog(normalized)
        }
      } catch {
        // Keep the offline catalog if the full problemset is unavailable.
      }
      try {
        const contestList = await fetchContestList(false)
        setContests(cacheContests(contestList))
      } catch {
        // Manual contest ID filters still work without contest metadata.
      }
    } catch (error) {
      notify(error instanceof Error ? `Codeforces no respondió: ${error.message}` : 'No se pudo sincronizar con Codeforces.')
    } finally {
      setIsSyncing(false)
    }
  }

  function openSession(recommendation: DailyRecommendation) {
    setActiveRecommendation(recommendation)
    setShowResult(false)
    window.open(recommendation.problem.url, '_blank', 'noopener,noreferrer')
  }

  function saveSession(log: SessionLog) {
    commit((previous) => {
      const next = cloneState(previous)
      next.sessionLogs = [...(next.sessionLogs ?? []), log]
      next.activityDates = [...new Set([...next.activityDates, localDateKey(new Date(log.completedAt))])]
      next.progress[log.problemId] = {
        problemId: log.problemId,
        status: log.result === 'solved' ? 'solved' : 'attempted',
        attempts: log.attempts,
        source: 'manual',
          firstSeenAt: next.progress[log.problemId]?.firstSeenAt ?? log.completedAt,
          lastAttemptAt: log.completedAt,
          solvedAt: log.result === 'solved' ? log.completedAt : undefined,
          timeSpentMinutes: log.timeMinutes,
        notes: log.notes,
      }
      if (log.result === 'solved') next.completedProblemIds = [...new Set([...next.completedProblemIds, log.problemId])]
      if (log.cause) {
        const causeTags: Partial<Record<SessionCause, string[]>> = {
          IMPLEMENTATION: ['implementation', 'constructive algorithms'],
          EDGE_CASE: ['implementation', 'greedy'],
          COMPLEXITY: ['binary search', 'data structures'],
          MATH: ['math', 'number theory'],
          IDEA: ['dp', 'greedy'],
          READING: ['implementation'],
          PANIC_TIME: ['implementation'],
        }
        next.weakTags = [...new Set([...next.weakTags, ...(causeTags[log.cause] ?? [])])].slice(-8)
      }
      return next
    })
    setActiveRecommendation(null)
    setShowResult(false)
    notify(log.result === 'solved' ? 'Sesión guardada. El siguiente plan ya se está adaptando.' : 'Intento registrado. Este problema quedará como deuda prioritaria.')
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), state }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `momentum-${state.handle}-${todayKey}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('Respaldo descargado.')
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as { state?: TrainingState } | TrainingState
      const next = 'state' in parsed && parsed.state ? parsed.state : parsed as TrainingState
      if (next.version !== 1 || !next.handle) throw new Error('Formato incompatible')
      commit(next)
      notify('Datos restaurados correctamente.')
    } catch {
      notify('El archivo no es un respaldo válido de Momentum.')
    } finally {
      event.target.value = ''
    }
  }

  function switchPage(next: Page) {
    setPage(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={switchPage} state={state} solvedThisWeek={solvedThisWeek} />
      <main className="main">
        <Topbar page={page} isSyncing={isSyncing} lastSyncAt={state.lastSyncAt} onSync={syncCodeforces} />
        {page === 'today' && (
          <TodayPage
            recommendations={recommendations}
            state={state}
            weekNumber={weekNumber}
            solvedToday={solvedToday}
            solvedThisWeek={solvedThisWeek}
            reliability={reliability}
            avgAttempts={avgAttempts}
            activeDates={activeDates.size}
            onStart={openSession}
            onNavigate={switchPage}
          />
        )}
        {page === 'random' && (
          <RandomSessionPage
            catalog={catalog}
            contests={contests}
            state={state}
            currentRating={liveRating}
            solvedProblemIds={allSolved}
            recentlyRecommendedProblemIds={recentIds}
            isSyncing={isSyncing}
            onSync={syncCodeforces}
            onStart={(problem, explanation) => openSession({
              slot: problem.rating <= liveRating ? 'recovery' : problem.rating >= liveRating + 200 ? 'stretch' : 'target',
              problem,
              idealRating: problem.rating,
              matchedWeakTags: [],
              score: 0,
              explanation,
            })}
          />
        )}
        {page === 'problems' && (
          <ProblemsPage catalog={catalog} state={state} filters={filters} setFilters={setFilters} onStart={(problem) => openSession({ slot: 'target', problem, idealRating: problem.rating, matchedWeakTags: [], score: 0, explanation: 'Elegido desde el explorador.' })} />
        )}
        {page === 'tutor' && <TutorWorkspace />}
        {page === 'progress' && (
          <ProgressPage state={state} catalog={catalog} ratingHistory={ratingHistory} liveRating={liveRating} maxRating={maxRating} reliability={reliability} avgAttempts={avgAttempts} />
        )}
        {page === 'plan' && <PlanPage weekNumber={weekNumber} />}
        {page === 'settings' && (
          <SettingsPage
            state={state}
            onChange={commit}
            onExport={exportData}
            onImport={() => fileInput.current?.click()}
            onReset={() => { commit(clearTrainingState()); notify('Progreso local reiniciado.') }}
          />
        )}
      </main>
      <MobileNav page={page} onNavigate={switchPage} />
      <input ref={fileInput} type="file" accept="application/json" hidden onChange={importData} />
      {activeRecommendation && (
        <SessionModal
          recommendation={activeRecommendation}
          showResult={showResult}
          onClose={() => { setActiveRecommendation(null); setShowResult(false) }}
          onFinish={() => setShowResult(true)}
          onSave={saveSession}
        />
      )}
      {toasts.map((toast) => <div className="toast" key={toast.id}><Check />{toast.message}</div>)}
    </div>
  )
}

function Sidebar({ page, onNavigate, state, solvedThisWeek }: { page: Page; onNavigate: (page: Page) => void; state: TrainingState; solvedThisWeek: number }) {
  return (
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark" /><span className="brand-name">momentum</span></div>
      <div className="nav-label">Entrenamiento</div>
      <nav className="side-nav">
        {NAVIGATION.filter(({ id }) => id !== 'settings').map(({ id, label, icon: Icon }) => (
          <button className={`nav-button ${page === id ? 'active' : ''}`} key={id} onClick={() => onNavigate(id)}><Icon />{label}</button>
        ))}
      </nav>
      <div className="nav-label" style={{ marginTop: 22 }}>Sistema</div>
      <nav className="side-nav">
        <button className={`nav-button ${page === 'settings' ? 'active' : ''}`} onClick={() => onNavigate('settings')}><Settings />Configuración</button>
        <a className="nav-button" href="https://codeforces.com/apiHelp" target="_blank" rel="noreferrer"><CircleHelp />Cómo funciona</a>
      </nav>
      <div className="sidebar-spacer" />
      <div className="week-mini">
        <div className="week-mini-top"><span className="week-mini-label">Meta semanal</span><span className="week-mini-value">{solvedThisWeek}/6</span></div>
        <div className="mini-track"><span style={{ width: `${Math.min(100, solvedThisWeek / 6 * 100)}%` }} /></div>
        <p>Constancia primero. La dificultad se adapta a tu fiabilidad.</p>
      </div>
      <div className="profile-chip">
        <span className="avatar">FB</span>
        <span className="profile-meta"><strong>{state.handle}</strong><span>Codeforces · Pupil</span></span>
        <MoreHorizontal />
      </div>
    </aside>
  )
}

function Topbar({ page, isSyncing, lastSyncAt, onSync }: { page: Page; isSyncing: boolean; lastSyncAt: string | null; onSync: () => void }) {
  const syncLabel = lastSyncAt
    ? `Actualizado ${new Intl.RelativeTimeFormat('es', { numeric: 'auto' }).format(Math.round((new Date(lastSyncAt).getTime() - Date.now()) / 60_000), 'minute')}`
    : 'Sincronizar Codeforces'
  return (
    <header className="topbar">
      <div className="breadcrumb">Momentum&nbsp;&nbsp;/&nbsp;&nbsp;<strong>{PAGE_TITLES[page]}</strong></div>
      <div className="top-actions">
        <button className="ghost-button" aria-label={isSyncing ? 'Sincronizando Codeforces' : syncLabel} disabled={isSyncing} onClick={onSync}><span className={`sync-dot ${isSyncing ? 'loading' : ''}`} /><span className="sync-label">{isSyncing ? 'Sincronizando…' : syncLabel}</span></button>
        <button className="icon-button" aria-label="Notificaciones"><Bell /></button>
      </div>
    </header>
  )
}

function TodayPage({ recommendations, state, weekNumber, solvedToday, solvedThisWeek, reliability, avgAttempts, activeDates, onStart, onNavigate }: {
  recommendations: DailyRecommendation[]; state: TrainingState; weekNumber: number; solvedToday: number; solvedThisWeek: number; reliability: number; avgAttempts: string; activeDates: number; onStart: (item: DailyRecommendation) => void; onNavigate: (page: Page) => void
}) {
  const currentWeek = TRAINING_WEEKS[weekNumber - 1]
  return (
    <div className="page page-enter">
      <div className="page-heading">
        <div><span className="eyebrow">{formatSpanishDate()}</span><h1>Volvamos a construir ritmo.</h1><p>Hoy no buscamos volumen: buscamos que cada idea correcta termine en código correcto.</p></div>
        <button className="ghost-button" onClick={() => onNavigate('plan')}><BookOpen /> Ver plan completo</button>
      </div>

      <section className="recovery-banner">
        <div className="banner-copy"><span className="eyebrow">Semana {weekNumber} de 12 · {currentWeek?.focus ?? 'Reactivación'}</span><h2>{solvedToday >= state.preferences.dailyGoal ? 'Meta diaria completada. Excelente control.' : 'Tu sesión está calibrada para recuperar Specialist.'}</h2><p>Meta final: estabilidad en 1500+, con fiabilidad de primer envío por encima de 85%.</p></div>
        <div className="banner-kpis"><div className="banner-kpi"><strong>{solvedToday}/{state.preferences.dailyGoal}</strong><span>AC de hoy</span></div><div className="banner-kpi"><strong>{solvedThisWeek}/6</strong><span>AC semanales</span></div></div>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-header"><div><h2>Selección adaptativa de hoy</h2><p>{recommendations.some((item) => item.slot === 'stretch') ? 'Recuperación, consolidación y un reto que tu fiabilidad ya habilitó.' : 'Recuperación y consolidación. El reto se desbloquea con fiabilidad sostenida.'}</p></div><Sparkles color="var(--lime)" size={17} /></div>
          <div className="panel-body"><div className="problem-list">{recommendations.map((item) => <ProblemCard key={`${item.slot}-${item.problem.id}`} item={item} solved={state.completedProblemIds.includes(item.problem.id)} hideTags={state.preferences.hideTags !== false} onStart={() => onStart(item)} />)}</div></div>
        </section>
        <aside className="side-stack">
          <section className="panel focus-card">
            <div className="focus-top"><span className="focus-icon"><BrainCircuit /></span><span className="week-badge">FOCO · S{weekNumber}</span></div>
            <h3>{currentWeek?.focus ?? 'Fiabilidad de implementación'}</h3>
            <p>{currentWeek?.milestone ?? 'Reduce los fallos evitables antes de subir la dificultad.'}</p>
            <ul className="focus-rules"><li><span>1</span><div>10 min para ejemplos, límites e invariante.</div></li><li><span>2</span><div>Tras el segundo WA, pausa y rederiva desde cero.</div></li><li><span>3</span><div>Registra la causa real; “WA” no es un diagnóstico.</div></li></ul>
          </section>
          <section className="panel reliability-card">
            <div className="reliability-head"><h3>Implementation Reliability</h3><span className="trend">objetivo 85%</span></div>
            <div className="reliability-value"><strong>{reliability}%</strong><span>primer submit AC</span></div>
            <div className="segmented">{Array.from({ length: 10 }, (_, index) => <i className={index < Math.round(reliability / 10) ? 'on' : ''} key={index} />)}</div>
            <div className="metric-foot"><span>Problemas 1200–1600</span><span>{reliability ? 'En progreso' : 'Aún sin baseline'}</span></div>
          </section>
        </aside>
      </div>

      <div className="section-title"><h2>Tu pulso de entrenamiento</h2><button onClick={() => onNavigate('progress')}>Ver análisis <ChevronRight size={12} /></button></div>
      <div className="metrics-row">
        <MetricCard icon={Flame} value={`${Math.min(activeDates, 99)}`} label="Días activos registrados" delta="meta: 5/sem" />
        <MetricCard icon={ShieldCheck} value={reliability ? `${reliability}%` : '—'} label="AC al primer submit" delta="meta S12: 85%" />
        <MetricCard icon={RotateCcw} value={avgAttempts} label="Intentos por AC" delta="meta S12: ≤1.5" />
        <MetricCard icon={Target} value={`${solvedThisWeek}/6`} label="AC deliberados esta semana" delta="ritmo sostenible" />
      </div>
    </div>
  )
}

type RandomSessionConfig = {
  totalProblems: number
  minRating: number
  maxRating: number
  dominantRating: number
  dominantCount: number
  reserveRecentContests: number
  minContestId: number | null
  maxContestId: number | null
  excludedContestIdsText: string
}

type RandomSessionRequest = {
  config: RandomSessionConfig
  seed: string
  previousSelectionIds: string[]
  protectedContestIds: number[]
}

type RandomSessionSnapshot = {
  draft: RandomSessionConfig
  request: RandomSessionRequest | null
}

const RANDOM_SESSION_STORAGE_KEY = 'momentum-cf:random-session:v1'
const CONTEST_CACHE_STORAGE_KEY = 'momentum-cf:contests:v1'
const CONTEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const RATING_OPTIONS = Array.from({ length: 28 }, (_, index) => 800 + index * 100)

function normalizeFinishedContests(items: CodeforcesContest[]): CodeforcesContest[] {
  return items
    .filter((contest) => contest.phase === 'FINISHED' && typeof contest.startTimeSeconds === 'number')
    .sort((left, right) => (right.startTimeSeconds ?? 0) - (left.startTimeSeconds ?? 0))
}

function loadCachedContests(): CodeforcesContest[] {
  try {
    const raw = window.localStorage.getItem(CONTEST_CACHE_STORAGE_KEY)
    if (!raw) return []
    const value = JSON.parse(raw) as { savedAt?: number; contests?: CodeforcesContest[] }
    if (!value.savedAt || Date.now() - value.savedAt > CONTEST_CACHE_TTL_MS || !Array.isArray(value.contests)) return []
    return normalizeFinishedContests(value.contests)
  } catch {
    return []
  }
}

function cacheContests(items: CodeforcesContest[]): CodeforcesContest[] {
  const normalized = normalizeFinishedContests(items)
  try {
    window.localStorage.setItem(CONTEST_CACHE_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), contests: normalized }))
  } catch {
    // Recent-contest protection still works for this visit without storage.
  }
  return normalized
}

function createDefaultRandomConfig(currentRating: number): RandomSessionConfig {
  const dominantRating = Math.min(1700, Math.max(1000, Math.round(currentRating / 100) * 100))
  return {
    totalProblems: 5,
    minRating: Math.max(800, dominantRating - 200),
    maxRating: Math.min(3500, dominantRating + 300),
    dominantRating,
    dominantCount: 3,
    reserveRecentContests: 0,
    minContestId: null,
    maxContestId: null,
    excludedContestIdsText: '',
  }
}

function normalizeRandomSessionConfig(value: Partial<RandomSessionConfig>, currentRating: number): RandomSessionConfig {
  const fallback = createDefaultRandomConfig(currentRating)
  return {
    ...fallback,
    ...value,
    reserveRecentContests: Number.isInteger(value.reserveRecentContests) ? Math.max(0, value.reserveRecentContests ?? 0) : 0,
    minContestId: Number.isInteger(value.minContestId) && (value.minContestId ?? 0) > 0 ? value.minContestId ?? null : null,
    maxContestId: Number.isInteger(value.maxContestId) && (value.maxContestId ?? 0) > 0 ? value.maxContestId ?? null : null,
    excludedContestIdsText: typeof value.excludedContestIdsText === 'string' ? value.excludedContestIdsText : '',
  }
}

function parseContestIds(value: string): { ids: number[]; invalid: boolean } {
  const tokens = value.split(/[\s,;]+/).map((token) => token.trim()).filter(Boolean)
  const invalid = tokens.some((token) => !/^\d+$/.test(token) || Number(token) < 1)
  return {
    ids: [...new Set(tokens.filter((token) => /^\d+$/.test(token) && Number(token) > 0).map(Number))],
    invalid,
  }
}

function loadRandomSessionSnapshot(currentRating: number): RandomSessionSnapshot | null {
  try {
    const raw = window.localStorage.getItem(RANDOM_SESSION_STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as {
      draft?: Partial<RandomSessionConfig>
      request?: { config?: Partial<RandomSessionConfig>; seed?: unknown; previousSelectionIds?: unknown; protectedContestIds?: unknown }
    }
    if (!value.draft || typeof value.draft.totalProblems !== 'number') return null
    const draft = normalizeRandomSessionConfig(value.draft, currentRating)
    const request = value.request?.config && typeof value.request.seed === 'string'
      ? {
          config: normalizeRandomSessionConfig(value.request.config, currentRating),
          seed: value.request.seed,
          previousSelectionIds: Array.isArray(value.request.previousSelectionIds) ? value.request.previousSelectionIds.filter((id): id is string => typeof id === 'string') : [],
          protectedContestIds: Array.isArray(value.request.protectedContestIds) ? value.request.protectedContestIds.filter((id): id is number => Number.isInteger(id) && id > 0) : [],
        }
      : null
    return { draft, request }
  } catch {
    return null
  }
}

function validateRandomSession(config: RandomSessionConfig): string | null {
  if (config.totalProblems < 1 || config.totalProblems > 20) return 'El número de problemas debe estar entre 1 y 20.'
  if (config.minRating > config.maxRating) return 'El rating mínimo no puede superar al máximo.'
  if (config.dominantRating < config.minRating || config.dominantRating > config.maxRating) return `El rating predominante debe estar entre ${config.minRating} y ${config.maxRating}.`
  if (config.dominantCount < 0 || config.dominantCount > config.totalProblems) return `La cuota predominante no puede superar los ${config.totalProblems} problemas de la sesión.`
  if (config.minContestId !== null && (!Number.isInteger(config.minContestId) || config.minContestId < 1)) return 'El contest mínimo debe ser un ID entero positivo.'
  if (config.maxContestId !== null && (!Number.isInteger(config.maxContestId) || config.maxContestId < 1)) return 'El contest máximo debe ser un ID entero positivo.'
  if (config.minContestId !== null && config.maxContestId !== null && config.minContestId > config.maxContestId) return 'El contest mínimo no puede superar al contest máximo.'
  if (parseContestIds(config.excludedContestIdsText).invalid) return 'Usa IDs de contest válidos separados por coma, por ejemplo: 1920, 1931.'
  return null
}

function RandomSessionPage({ catalog, contests, state, currentRating, solvedProblemIds, recentlyRecommendedProblemIds, isSyncing, onSync, onStart }: {
  catalog: ProblemCatalogEntry[]
  contests: CodeforcesContest[]
  state: TrainingState
  currentRating: number
  solvedProblemIds: ReadonlySet<string>
  recentlyRecommendedProblemIds: string[]
  isSyncing: boolean
  onSync: () => void
  onStart: (problem: ProblemCatalogEntry, explanation: string) => void
}) {
  const [initialSnapshot] = useState(() => loadRandomSessionSnapshot(currentRating))
  const [draft, setDraft] = useState<RandomSessionConfig>(() => initialSnapshot?.draft ?? createDefaultRandomConfig(currentRating))
  const [request, setRequest] = useState<RandomSessionRequest | null>(() => initialSnapshot?.request ?? null)
  const [showContestFilters, setShowContestFilters] = useState(() => Boolean(
    initialSnapshot?.draft.reserveRecentContests ||
    initialSnapshot?.draft.minContestId ||
    initialSnapshot?.draft.maxContestId ||
    initialSnapshot?.draft.excludedContestIdsText,
  ))
  const weakTags = state.weakTags.length ? state.weakTags : ['implementation', 'greedy', 'binary search', 'dp']
  const validationError = validateRandomSession(draft) ?? (draft.reserveRecentContests > 0 && !contests.length ? 'Sincroniza Codeforces antes de reservar contests recientes por fecha.' : null)
  const isDirty = request ? JSON.stringify(request.config) !== JSON.stringify(draft) : false
  const catalogContestIds = useMemo(() => [...new Set(catalog.map((problem) => problem.contestId))].sort((left, right) => right - left), [catalog])
  const recentContestIds = useMemo(() => contests.map((contest) => contest.id), [contests])
  const draftExplicitContestIds = useMemo(() => parseContestIds(draft.excludedContestIdsText).ids, [draft.excludedContestIdsText])
  const requestExplicitContestIds = useMemo(() => request ? parseContestIds(request.config.excludedContestIdsText).ids : [], [request])
  const draftProtectedContestIds = useMemo(() => [...new Set([...recentContestIds.slice(0, draft.reserveRecentContests), ...draftExplicitContestIds])], [recentContestIds, draft.reserveRecentContests, draftExplicitContestIds])
  const requestProtectedContestIds = useMemo(() => request ? [...new Set([...request.protectedContestIds, ...requestExplicitContestIds])] : [], [request, requestExplicitContestIds])

  useEffect(() => {
    try {
      window.localStorage.setItem(RANDOM_SESSION_STORAGE_KEY, JSON.stringify({ draft, request }))
    } catch {
      // The session still works if browser storage is unavailable.
    }
  }, [draft, request])

  const result = useMemo(() => request ? generateRandomSession({
    problems: catalog,
    totalProblems: request.config.totalProblems,
    minRating: request.config.minRating,
    maxRating: request.config.maxRating,
    dominantRating: request.config.dominantRating,
    dominantCount: request.config.dominantCount,
    minContestId: request.config.minContestId ?? undefined,
    maxContestId: request.config.maxContestId ?? undefined,
    excludedContestIds: requestProtectedContestIds,
    solvedProblemIds,
    weakTags,
    recentlyRecommendedProblemIds,
    previousSelectionIds: request.previousSelectionIds,
    seed: request.seed,
  }) : null, [request, catalog, requestProtectedContestIds, solvedProblemIds, weakTags, recentlyRecommendedProblemIds])

  const solvedInRange = useMemo(() => {
    const range = request?.config ?? draft
    const protectedIds = new Set(request ? requestProtectedContestIds : draftProtectedContestIds)
    return catalog.filter((problem) => problem.rating >= range.minRating && problem.rating <= range.maxRating
      && (range.minContestId === null || problem.contestId >= range.minContestId)
      && (range.maxContestId === null || problem.contestId <= range.maxContestId)
      && !protectedIds.has(problem.contestId)
      && solvedProblemIds.has(problem.id)).length
  }, [catalog, solvedProblemIds, request, draft, requestProtectedContestIds, draftProtectedContestIds])

  function updateDraft<Key extends keyof RandomSessionConfig>(field: Key, value: RandomSessionConfig[Key]) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function generate() {
    if (validationError) return
    const previousSelectionIds = result?.selections.map((selection) => selection.problem.id) ?? []
    setRequest({
      config: { ...draft },
      seed: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      previousSelectionIds,
      protectedContestIds: draftProtectedContestIds,
    })
  }

  const compositionText = `${draft.dominantCount} de ${draft.dominantRating} + ${Math.max(0, draft.totalProblems - draft.dominantCount)} entre ${draft.minRating} y ${draft.maxRating}`
  const profileTags = weakTags.slice(0, 4)
  const activeContestConfig = request?.config ?? draft
  const activeProtectedContestIds = request ? requestProtectedContestIds : draftProtectedContestIds
  const contestProtectionLabel = activeProtectedContestIds.length || activeContestConfig.minContestId !== null || activeContestConfig.maxContestId !== null
    ? `${activeProtectedContestIds.length} reservados · IDs ${activeContestConfig.minContestId ?? 'inicio'}–${activeContestConfig.maxContestId ?? 'actual'}`
    : 'Sin restricciones'
  const draftContestProtectionLabel = draftProtectedContestIds.length || draft.minContestId !== null || draft.maxContestId !== null
    ? `${draftProtectedContestIds.length} reservados · ${draft.minContestId ?? 'inicio'}–${draft.maxContestId ?? 'actual'}`
    : 'Sin restricciones'
  const notices = result ? [
    result.metadata.dominantShortfallCount > 0
      ? `No quedaban suficientes problemas de ${result.metadata.dominantRating}; completamos ${result.metadata.fallbackFromOtherRatingsCount} cupos con otros ratings del rango.`
      : null,
    result.metadata.shortageCount > 0
      ? activeProtectedContestIds.length || activeContestConfig.minContestId !== null || activeContestConfig.maxContestId !== null
        ? `La protección de contests deja solo ${result.metadata.selectedCount} problemas disponibles. Reserva menos contests, amplía los límites o reduce la cantidad.`
        : `Solo encontramos ${result.metadata.selectedCount} problemas sin resolver con estos filtros. Amplía el rango o reduce la cantidad.`
      : null,
    result.metadata.previousSelectionSelectedCount > 0
      ? `Repetimos ${result.metadata.previousSelectionSelectedCount} porque no quedaban más alternativas con esta composición.`
      : null,
  ].filter((notice): notice is string => Boolean(notice)) : []

  return (
    <div className="page page-enter">
      <div className="page-heading">
        <div><span className="eyebrow">Sesión a medida</span><h1>Entrena justo donde lo necesitas.</h1><p>Elige cantidad y dificultad. Momentum descarta lo que ya resolviste y prioriza las necesidades detectadas en tu perfil.</p></div>
        {result?.selections.length ? <button className="ghost-button" onClick={() => onStart(result.selections[0].problem, result.selections[0].explanation)}><Play /> Empezar primero</button> : null}
      </div>

      <div className="random-layout">
        <aside className="panel random-config">
          <div className="panel-header"><div><h2>Configura la sesión</h2><p>Define n, el rango x–y y el foco z.</p></div><Dices color="var(--lime)" size={17} /></div>
          <div className="panel-body">
            <div className="random-fields">
              <div className="field">
                <label htmlFor="random-total">Número de problemas</label>
                <select id="random-total" className="input" value={draft.totalProblems} onChange={(event) => updateDraft('totalProblems', Number(event.target.value))}>{Array.from({ length: 20 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value} {value === 1 ? 'problema' : 'problemas'}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="random-min">Rating mínimo (x)</label>
                <select id="random-min" className="input" value={draft.minRating} onChange={(event) => updateDraft('minRating', Number(event.target.value))}>{RATING_OPTIONS.map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="random-max">Rating máximo (y)</label>
                <select id="random-max" className="input" value={draft.maxRating} onChange={(event) => updateDraft('maxRating', Number(event.target.value))}>{RATING_OPTIONS.map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select>
              </div>
              <div className="field">
                <label htmlFor="random-dominant">Rating predominante (z)</label>
                <select id="random-dominant" className="input" value={draft.dominantRating} onChange={(event) => updateDraft('dominantRating', Number(event.target.value))}>{RATING_OPTIONS.map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select>
                <span className="random-field-hint">Será la dificultad principal de la sesión.</span>
              </div>
              <div className="field">
                <label htmlFor="random-quota">Problemas de rating z</label>
                <select id="random-quota" className="input" value={draft.dominantCount} onChange={(event) => updateDraft('dominantCount', Number(event.target.value))}>{Array.from({ length: Math.max(draft.totalProblems, draft.dominantCount) + 1 }, (_, index) => index).map((value) => <option key={value} value={value}>{value}</option>)}</select>
                <span className="random-field-hint">Por defecto, 3; puedes ajustar la cuota.</span>
              </div>
            </div>

            <div className={`contest-protection ${showContestFilters ? 'open' : ''}`}>
              <button className="contest-protection-toggle" type="button" aria-expanded={showContestFilters} onClick={() => setShowContestFilters((visible) => !visible)}>
                <span className="contest-protection-icon"><ShieldCheck /></span>
                <span className="contest-protection-copy"><strong>Protección para virtuales</strong><small>{draftContestProtectionLabel}</small></span>
                <ChevronRight />
              </button>
              {showContestFilters && <div className="contest-protection-body">
                <p>Reserva contests completos para no ver sus problemas antes de hacerlos en virtual.</p>
                <div className="random-fields contest-fields">
                  <div className="field">
                    <label htmlFor="random-recent-contests">Reservar contests recientes</label>
                    <select id="random-recent-contests" className="input" value={draft.reserveRecentContests} onChange={(event) => updateDraft('reserveRecentContests', Number(event.target.value))}>
                      <option value="0">No reservar</option>
                      <option value="3" disabled={!contests.length}>Últimos 3</option>
                      <option value="5" disabled={!contests.length}>Últimos 5 · recomendado</option>
                      <option value="10" disabled={!contests.length}>Últimos 10</option>
                      <option value="20" disabled={!contests.length}>Últimos 20</option>
                      <option value="50" disabled={!contests.length}>Últimos 50</option>
                    </select>
                    <span className="random-field-hint">{contests.length ? 'Se ordenan por la fecha real de inicio en Codeforces.' : 'Sincroniza Codeforces para identificar los contests más recientes.'}</span>
                  </div>
                  <div className="field contest-range-caption">
                    <label>Catálogo disponible</label>
                    <div className="contest-range-value">{catalogContestIds.length ? `${catalogContestIds[catalogContestIds.length - 1]} – ${catalogContestIds[0]}` : 'Sin contests cargados'}</div>
                    <span className="random-field-hint">Te ayuda a elegir los límites manuales.</span>
                  </div>
                  <div className="field">
                    <label htmlFor="random-contest-min">Contest mínimo</label>
                    <input id="random-contest-min" className="input" type="number" min="1" step="1" placeholder="Sin mínimo" value={draft.minContestId ?? ''} onChange={(event) => updateDraft('minContestId', event.target.value ? Number(event.target.value) : null)} />
                  </div>
                  <div className="field">
                    <label htmlFor="random-contest-max">Contest máximo</label>
                    <input id="random-contest-max" className="input" type="number" min="1" step="1" placeholder="Sin máximo" value={draft.maxContestId ?? ''} onChange={(event) => updateDraft('maxContestId', event.target.value ? Number(event.target.value) : null)} />
                  </div>
                  <div className="field full">
                    <label htmlFor="random-contest-excluded">Contests específicos reservados</label>
                    <input id="random-contest-excluded" className="input" inputMode="numeric" placeholder="Ejemplo: 1920, 1931" value={draft.excludedContestIdsText} onChange={(event) => updateDraft('excludedContestIdsText', event.target.value)} />
                    <span className="random-field-hint">Separa los IDs por coma. Ningún problema de esos contests aparecerá.</span>
                  </div>
                </div>
              </div>}
            </div>

            <div className="random-profile">
              <div className="random-profile-top">
                <div className="random-profile-title"><span><BrainCircuit /></span><span><strong>Perfil · {state.handle}</strong><small>Rating actual {currentRating} · foco adaptativo activo</small></span></div>
                <span className={`random-profile-status ${state.lastSyncAt ? '' : 'pending'}`}>{state.lastSyncAt ? 'Sincronizado' : 'Datos locales'}</span>
              </div>
              <p>{state.lastSyncAt ? 'El historial de Codeforces se usa para excluir resueltos y rotar las recomendaciones.' : 'Sincroniza para excluir todo lo que ya resolviste en Codeforces. Si continúas ahora, usaremos solo los datos guardados en Momentum.'}</p>
              <div className="tag-row">{profileTags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
              {!state.lastSyncAt && <button className="soft-button" style={{ width: '100%', marginTop: 12 }} disabled={isSyncing} onClick={onSync}>{isSyncing ? 'Sincronizando…' : 'Sincronizar Codeforces'}</button>}
            </div>

            <div className="random-profile" aria-live="polite">
              <div className="random-profile-top"><strong>Composición</strong><span className="rating-pill">{draft.totalProblems} total</span></div>
              <p style={{ marginBottom: 0 }}>{compositionText}.</p>
              <div className="contest-inline-status"><ShieldCheck />{draftContestProtectionLabel}</div>
            </div>
            {validationError && <div className="random-notice" role="alert"><CircleHelp />{validationError}</div>}
            <button className="primary-button random-generate" disabled={Boolean(validationError)} onClick={generate}>{result && !isDirty ? <RotateCcw /> : <Dices />}{result ? isDirty ? 'Actualizar y generar' : 'Regenerar sin repetir' : 'Generar sesión'}</button>
          </div>
        </aside>

        <section className="panel random-results" aria-live="polite">
          {result ? <>
            <div className="random-results-head">
              <div><span className="eyebrow">Tu sesión está lista</span><h2>{result.metadata.selectedCount} problemas elegidos para avanzar</h2><p>Descartamos {solvedInRange} resueltos, priorizamos {profileTags.join(', ')} y aplicamos la protección de contests.</p></div>
              <div className="random-composition"><span className="dominant"><strong>{result.metadata.dominantSelectedCount} × {result.metadata.dominantRating}</strong><small>foco principal</small></span><span><strong>{result.metadata.selectedCount - result.metadata.dominantSelectedCount}</strong><small>del resto</small></span></div>
            </div>
            <div className="contest-safe-summary"><ShieldCheck /><span><strong>{activeProtectedContestIds.length || activeContestConfig.minContestId !== null || activeContestConfig.maxContestId !== null ? 'Virtuales protegidos' : 'Protección disponible'}</strong><small>{contestProtectionLabel}. {activeProtectedContestIds.length || activeContestConfig.minContestId !== null || activeContestConfig.maxContestId !== null ? `${result.metadata.contestBoundsExcludedCount + result.metadata.explicitContestExcludedCount} candidatos quedaron fuera por estas reglas.` : 'Puedes reservar contests antes de la próxima generación.'}</small></span></div>
            {notices.map((notice) => <div className="random-notice" key={notice}><CircleHelp />{notice}</div>)}
            <div className="random-list">{result.selections.map((selection, index) => {
              const reason = state.preferences.hideTags !== false && selection.matchedWeakTags.length
                ? selection.explanation.replace(/ Refuerza áreas débiles: [^.]+\./, ' Se ajusta a una debilidad detectada en tu perfil.')
                : selection.explanation
              return <article className={`random-problem ${selection.isDominant ? 'dominant' : ''}`} key={selection.problem.id}>
                <span className="random-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="random-problem-main">
                  <div className="random-problem-top"><span className="rating-pill">{selection.problem.rating}</span><span className="contest-badge">Contest {selection.problem.contestId}</span>{selection.isDominant && <span className="dominant-badge">Foco {result.metadata.dominantRating}</span>}</div>
                  <a className="random-problem-name" href={selection.problem.url} target="_blank" rel="noreferrer">{selection.problem.name}<ExternalLink /></a>
                  <p className="random-problem-reason">{reason}</p>
                  <div className="tag-row">{state.preferences.hideTags !== false ? <span className="tag">tags ocultos hasta cerrar la sesión</span> : selection.problem.tags.slice(0, 4).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
                </div>
                <div className="random-problem-actions"><span className="random-popularity">{selection.problem.solvedCount ? `${selection.problem.solvedCount.toLocaleString('es-PE')} AC` : 'disponible'}</span><button className="start-button" onClick={() => onStart(selection.problem, reason)}><Play /> Empezar</button></div>
              </article>
            })}</div>
          </> : <div className="random-empty"><span><Dices /></span><h3>Diseña tu primera sesión random.</h3><p>La combinación queda bajo tu control; la selección queda a cargo de tu historial, tus temas débiles y la rotación de problemas.</p></div>}
        </section>
      </div>
    </div>
  )
}

function ProblemCard({ item, solved, hideTags, onStart }: { item: DailyRecommendation; solved: boolean; hideTags: boolean; onStart: () => void }) {
  const labels = { recovery: 'Recuperación', target: 'Objetivo', stretch: 'Reto controlado' }
  const times = { recovery: '25–35 min', target: '35–50 min', stretch: '60–75 min' }
  return (
    <article className={`problem-card ${item.slot} ${solved ? 'done' : ''}`}>
      <span className="problem-stripe" />
      <div className="problem-main">
        <div className="problem-top"><span className="slot-label">{labels[item.slot]}</span><span className="rating-pill">{item.problem.rating}</span></div>
        <a className="problem-name" href={item.problem.url} target="_blank" rel="noreferrer">{item.problem.name}<ExternalLink /></a>
        <p className="problem-reason">{item.explanation}</p>
        <div className="tag-row">{hideTags && !solved ? <span className="tag">tags ocultos hasta cerrar la sesión</span> : item.problem.tags.slice(0, 4).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
      </div>
      <div className="problem-actions">
        <span className="time-estimate"><Clock3 />{times[item.slot]}</span>
        <div className="card-buttons"><button className="swap-button" aria-label="Abrir problema" onClick={() => window.open(item.problem.url, '_blank')}><ArrowUpRight /></button>{solved ? <span className="done-button"><Check /> Hecho</span> : <button className="start-button" onClick={onStart}><Play /> Empezar</button>}</div>
      </div>
    </article>
  )
}

function MetricCard({ icon: Icon, value, label, delta }: { icon: typeof Flame; value: string; label: string; delta: string }) {
  return <div className="metric-card"><span className="metric-icon"><Icon /></span><span className="metric-delta">{delta}</span><div className="metric-number">{value}</div><div className="metric-label">{label}</div></div>
}

function ProblemsPage({ catalog, state, filters, setFilters, onStart }: {
  catalog: ProblemCatalogEntry[]; state: TrainingState; filters: { search: string; rating: string; tag: string; status: string }; setFilters: Dispatch<SetStateAction<{ search: string; rating: string; tag: string; status: string }>>; onStart: (problem: ProblemCatalogEntry) => void
}) {
  const tags = [...new Set(catalog.flatMap((problem) => problem.tags))].sort()
  const filtered = catalog.filter((problem) => {
    const status = state.completedProblemIds.includes(problem.id) || state.syncedSolvedProblemIds.includes(problem.id) ? 'solved' : state.progress[problem.id]?.status === 'attempted' ? 'attempted' : 'pending'
    return (!filters.search || `${problem.name} ${problem.tags.join(' ')}`.toLowerCase().includes(filters.search.toLowerCase()))
      && (filters.rating === 'all' || String(problem.rating) === filters.rating)
      && (filters.tag === 'all' || problem.tags.includes(filters.tag))
      && (filters.status === 'all' || status === filters.status)
  })
  return (
    <div className="page page-enter">
      <div className="page-heading"><div><span className="eyebrow">Catálogo inteligente</span><h1>Encuentra tu siguiente problema.</h1><p>Filtra por dificultad, tema o estado. Los resueltos desde Codeforces quedan fuera de las recomendaciones diarias.</p></div><span className="rating-pill">{catalog.length.toLocaleString('es-PE')} problemas</span></div>
      <div className="filters">
        <label className="search-field"><Search /><input value={filters.search} onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value }))} placeholder="Buscar por nombre o tema…" /></label>
        <select className="select-field" value={filters.rating} onChange={(event) => setFilters((value) => ({ ...value, rating: event.target.value }))}><option value="all">Cualquier rating</option>{[1200,1300,1400,1500,1600,1700,1800].map((rating) => <option key={rating} value={rating}>{rating}</option>)}</select>
        <select className="select-field" value={filters.tag} onChange={(event) => setFilters((value) => ({ ...value, tag: event.target.value }))}><option value="all">Todos los temas</option>{tags.map((tag) => <option key={tag}>{tag}</option>)}</select>
        <select className="select-field" value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}><option value="all">Cualquier estado</option><option value="pending">Pendiente</option><option value="attempted">Intentado</option><option value="solved">Resuelto</option></select>
      </div>
      <section className="panel table-panel">
        <table className="problem-table"><thead><tr><th>Problema</th><th>Rating</th><th>Temas</th><th>Estado</th><th /></tr></thead><tbody>{filtered.slice(0, 100).map((problem) => {
          const status = state.completedProblemIds.includes(problem.id) || state.syncedSolvedProblemIds.includes(problem.id) ? 'solved' : state.progress[problem.id]?.status === 'attempted' ? 'attempted' : 'pending'
          return <tr key={problem.id}><td><a className="table-name" href={problem.url} target="_blank" rel="noreferrer">{problem.name}</a></td><td><span className="rating-pill">{problem.rating}</span></td><td><div className="tag-row">{problem.tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div></td><td><span className={`status-pill ${status}`}>{status === 'solved' ? 'Resuelto' : status === 'attempted' ? 'Intentado' : 'Pendiente'}</span></td><td><button className="table-action" onClick={() => onStart(problem)} disabled={status === 'solved'}><Play /></button></td></tr>
        })}</tbody></table>
        {!filtered.length && <div className="empty-state">No encontramos problemas con esos filtros.</div>}
      </section>
    </div>
  )
}

function ProgressPage({ state, catalog, ratingHistory, liveRating, maxRating, reliability, avgAttempts }: {
  state: TrainingState; catalog: ProblemCatalogEntry[]; ratingHistory: CodeforcesRatingChange[]; liveRating: number; maxRating: number; reliability: number; avgAttempts: string
}) {
  const logs = state.sessionLogs ?? []
  const hasSyncedRatingHistory = ratingHistory.length > 0
  const values = hasSyncedRatingHistory ? ratingHistory.slice(-12).map((entry) => entry.newRating) : [1173, 1246, 1320, 1434, 1371, 1420, 1457, 1354, liveRating]
  const min = Math.min(...values, 1100) - 30
  const max = Math.max(...values, state.preferences.targetRating) + 30
  const points = values.map((value, index) => `${45 + index * (490 / Math.max(1, values.length - 1))},${190 - ((value - min) / (max - min)) * 145}`).join(' ')
  const areaPoints = `45,190 ${points} 535,190`
  const tagCounts = new Map<string, number>()
  for (const log of logs.filter((item) => item.result === 'solved')) {
    catalog.find((problem) => problem.id === log.problemId)?.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1))
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  const causeCounts = FAILURE_CAUSES.map((cause) => ({ ...cause, count: logs.filter((log) => log.cause === cause.value).length })).sort((a, b) => b.count - a.count)
  const goalProgress = Math.max(0, Math.min(100, ((liveRating - 1354) / (state.preferences.targetRating - 1354 || 1)) * 100))
  return (
    <div className="page page-enter">
      <div className="page-heading"><div><span className="eyebrow">Datos, no sensaciones</span><h1>Tu progreso real.</h1><p>El rating es una consecuencia. Aquí seguimos las variables que hacen que una idea se convierta en AC.</p></div></div>
      <div className="metrics-row" style={{ marginBottom: 18 }}>
        <MetricCard icon={Gauge} value={String(liveRating)} label="Rating actual" delta={`máximo ${maxRating}`} />
        <MetricCard icon={ShieldCheck} value={reliability ? `${reliability}%` : '—'} label="Implementation Reliability" delta="objetivo 85%" />
        <MetricCard icon={RotateCcw} value={avgAttempts} label="Intentos promedio por AC" delta="objetivo ≤1.5" />
        <MetricCard icon={Activity} value={String(logs.filter((log) => log.result === 'solved').length)} label="AC deliberados en Momentum" delta="objetivo 72" />
      </div>
      <div className="progress-hero">
        <section className="panel chart-card">
          <div className="chart-top"><div><h2>Evolución de rating</h2><p>{hasSyncedRatingHistory ? 'Historial sincronizado de concursos Codeforces' : 'Referencia local de diagnóstico · no sincronizada'}</p></div><div className="legend"><span>Rating</span><span>Meta</span></div></div>
          <svg className="line-chart" viewBox="0 0 580 220" role="img" aria-label="Curva del rating"><defs><linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d7ff5f" stopOpacity=".22"/><stop offset="1" stopColor="#d7ff5f" stopOpacity="0"/></linearGradient></defs><g className="chart-grid">{[45,95,145,190].map((y) => <line key={y} x1="45" x2="535" y1={y} y2={y} />)}</g><line className="chart-target" x1="45" x2="535" y1={190 - ((state.preferences.targetRating - min) / (max - min)) * 145} y2={190 - ((state.preferences.targetRating - min) / (max - min)) * 145} /><polygon className="chart-area" points={areaPoints} /><polyline className="chart-line" points={points} />{values.map((value, index) => <circle key={`${value}-${index}`} className="chart-dot" cx={45 + index * (490 / Math.max(1, values.length - 1))} cy={190 - ((value - min) / (max - min)) * 145} r="3" />)}<text className="chart-label" x="6" y="49">{max}</text><text className="chart-label" x="6" y="194">{min}</text><text className="chart-label" x="490" y="20">meta {state.preferences.targetRating}</text></svg>
        </section>
        <section className="panel rating-goal"><h2>Camino a {state.preferences.targetRating}</h2><div className="rating-ring" style={{ '--goal-progress': `${goalProgress}%` } as CSSProperties}><div><strong>{Math.round(goalProgress)}%</strong><span>del tramo recuperado</span></div></div><div className="goal-caption"><div><span>Actual</span><strong>{liveRating}</strong></div><div style={{ textAlign: 'right' }}><span>Faltan</span><strong>{Math.max(0, state.preferences.targetRating - liveRating)} pts</strong></div></div></section>
      </div>
      <div className="insight-grid">
        <section className="panel"><div className="panel-header"><div><h2>AC por tema</h2><p>Sesiones registradas en la app</p></div><ListFilter /></div><div className="panel-body bars">{topTags.length ? topTags.map(([tag,count]) => <div className="bar-row" key={tag}><label>{tag}</label><div className="bar-track"><span style={{ width: `${Math.min(100, count / Math.max(...topTags.map((entry) => entry[1])) * 100)}%` }} /></div><strong>{count}</strong></div>) : <div className="empty-state" style={{ padding: 25 }}>Completa sesiones para descubrir tus temas dominantes.</div>}</div></section>
        <section className="panel"><div className="panel-header"><div><h2>Causas de error</h2><p>El veredicto no es el diagnóstico</p></div><BrainCircuit /></div><div className="panel-body cause-list">{causeCounts.slice(0, 5).map((cause, index) => <div className="cause-row" key={cause.value}><span className="cause-number">{index + 1}</span><span className="cause-copy"><strong>{cause.label}</strong><span>{cause.description}</span></span><span className="rating-pill">{cause.count}</span></div>)}</div></section>
      </div>
    </div>
  )
}

function PlanPage({ weekNumber }: { weekNumber: number }) {
  return (
    <div className="page page-enter">
      <div className="page-heading"><div><span className="eyebrow">17 ago. — 8 nov. 2026</span><h1>De pico ocasional a nivel base.</h1><p>Doce semanas para estabilizar 1450, consolidar 1500 y acercarte a 1600 sin perseguir rating a ciegas.</p></div><span className="rating-pill">Semana actual · {weekNumber}</span></div>
      <section className="panel"><div className="panel-header"><div><h2>Ruta completa</h2><p>6 AC deliberados y 1–2 contests o virtuales por semana.</p></div><History /></div><div className="timeline-panel"><div className="plan-timeline">{TRAINING_WEEKS.map((week) => <div className={`week-node ${week.week === weekNumber ? 'current' : ''}`} key={week.week}><small>SEMANA {week.week}</small><h3>{week.focus}</h3><p>{week.minimumWork}</p></div>)}</div></div></section>
      <div className="phase-grid">{TRAINING_PHASES.map((phase) => <section className="panel phase-card" key={phase.id}><div className="phase-card-top"><span>Semanas {phase.startWeek}–{phase.endWeek}</span><span>{phase.trainingBand}</span></div><h3>{phase.label}</h3><p>{phase.goal}</p><div className="phase-tags"><span className="tag">{phase.startDate}</span><span className="tag">{phase.endDate}</span></div></section>)}</div>
      <div className="section-title"><h2>Hitos semanales</h2></div>
      <section className="panel table-panel"><table className="problem-table"><thead><tr><th>Semana</th><th>Foco</th><th>Trabajo mínimo</th><th>Hito medible</th></tr></thead><tbody>{TRAINING_WEEKS.map((week) => <tr key={week.week}><td><span className={week.week === weekNumber ? 'slot-label' : 'rating-pill'}>{week.week}</span></td><td><span className="table-name">{week.focus}</span></td><td>{week.minimumWork}</td><td>{week.milestone}</td></tr>)}</tbody></table></section>
    </div>
  )
}

function SettingsPage({ state, onChange, onExport, onImport, onReset }: { state: TrainingState; onChange: (state: TrainingState) => void; onExport: () => void; onImport: () => void; onReset: () => void }) {
  const update = (changes: Partial<TrainingState>) => onChange({ ...state, ...changes })
  const [confirmReset, setConfirmReset] = useState(false)
  return (
    <div className="page page-enter">
      <div className="page-heading"><div><span className="eyebrow">Tu sistema</span><h1>Configuración.</h1><p>Ajusta el objetivo sin perder el enfoque del diagnóstico original. Todo el progreso se guarda localmente.</p></div></div>
      <div className="settings-grid">
        <section className="panel">
          <div className="form-section"><h2>Perfil de Codeforces</h2><p>La sincronización usa únicamente información pública; no necesitas API key.</p><div className="form-grid"><div className="field"><label>Handle</label><input className="input" value={state.handle} onChange={(event) => update({ handle: event.target.value.trim() })} /></div><div className="field"><label>Rating objetivo</label><input className="input" type="number" min="1400" max="2400" step="50" value={state.preferences.targetRating} onChange={(event) => update({ preferences: { ...state.preferences, targetRating: Number(event.target.value) } })} /></div></div></div>
          <div className="form-section"><h2>Ritmo de entrenamiento</h2><p>El informe recomienda 5–6 días activos y 6 AC deliberados por semana.</p><div className="form-grid"><div className="field"><label>Meta diaria</label><select className="input" value={state.preferences.dailyGoal} onChange={(event) => update({ preferences: { ...state.preferences, dailyGoal: Number(event.target.value) } })}><option value="1">1 problema</option><option value="2">2 problemas</option><option value="3">3 problemas</option></select></div><div className="field"><label>Zona horaria</label><input className="input" value="America/Lima" disabled /></div><div className="field full"><label>Temas débiles (separados por coma)</label><input className="input" value={state.weakTags.join(', ')} onChange={(event) => update({ weakTags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} placeholder="implementation, greedy, binary search…" /></div></div></div>
          <div className="form-section"><h2>Preferencias</h2><p>Estas opciones modifican la experiencia, no el algoritmo base.</p><div className="toggle-row"><div className="toggle-copy"><strong>Ocultar tags antes de resolver</strong><span>Evita pistas accidentales del enunciado.</span></div><button aria-label="Alternar ocultar tags" className={`toggle ${state.preferences.hideTags ? 'on' : ''}`} onClick={() => update({ preferences: { ...state.preferences, hideTags: !state.preferences.hideTags } })} /></div><div className="toggle-row"><div className="toggle-copy"><strong>Reto controlado</strong><span>Permite un 1700+ cuando tu fiabilidad semanal alcance el objetivo.</span></div><button aria-label="Alternar reto diario" className={`toggle ${state.preferences.enableStretch !== false ? 'on' : ''}`} onClick={() => update({ preferences: { ...state.preferences, enableStretch: state.preferences.enableStretch === false } })} /></div></div>
          <div className="form-section"><h2>Datos y respaldo</h2><p>Exporta tu progreso si cambias de navegador o dispositivo.</p><div style={{ display:'flex', flexWrap:'wrap', gap:8 }}><button className="ghost-button" onClick={onExport}><Download /> Exportar JSON</button><button className="ghost-button" onClick={onImport}><Upload /> Importar JSON</button>{confirmReset ? <><button className="danger-button" onClick={onReset}>Confirmar reinicio</button><button className="ghost-button" onClick={() => setConfirmReset(false)}>Cancelar</button></> : <button className="danger-button" onClick={() => setConfirmReset(true)}><RotateCcw /> Reiniciar progreso</button>}</div></div>
        </section>
        <aside className="panel diagnostic-card"><span className="eyebrow">Baseline · 12 ago. 2026</span><h2>Diagnóstico inicial</h2><p>La aplicación parte de tu informe analítico y reemplaza gradualmente estos datos con tus sesiones y sincronizaciones.</p><div className="baseline-list"><BaselineItem label="Rating actual" value="1354 · Pupil" /><BaselineItem label="Máximo histórico" value="1457 · Specialist" /><BaselineItem label="Problemas resueltos" value="1521" /><BaselineItem label="Sin rated contest" value="113 días" /><BaselineItem label="Objetivo" value="1500+" /></div><blockquote className="quote">“Specialist no es un nivel nuevo que debas aprender desde cero: ya lo alcanzaste. El trabajo es convertirlo de pico ocasional a nivel base.”</blockquote></aside>
      </div>
    </div>
  )
}

function BaselineItem({ label, value }: { label: string; value: string }) { return <div className="baseline-item"><span>{label}</span><strong>{value}</strong></div> }

function SessionModal({ recommendation, showResult, onClose, onFinish, onSave }: { recommendation: DailyRecommendation; showResult: boolean; onClose: () => void; onFinish: () => void; onSave: (log: SessionLog) => void }) {
  const [seconds, setSeconds] = useState(0)
  const [running, setRunning] = useState(true)
  const [checks, setChecks] = useState([false, false, false])
  useEffect(() => {
    if (!running || showResult) return
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [running, showResult])
  const minutes = Math.floor(seconds / 60)
  const phase = minutes < 10 ? 'Modelar' : minutes < 35 ? 'Implementar' : 'Validar y decidir'
  const protocol = minutes < 10 ? 'Escribe ejemplos propios, límites, complejidad e invariante.' : minutes < 35 ? 'Desarrolla y programa. Evita enviar hasta poder explicar cada transición.' : 'Prueba al menos tres casos deliberados antes de enviar.'
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Sesión ${recommendation.problem.name}`}>
      <section className="session-modal">
        <div className="modal-head"><div><span className="eyebrow">{recommendation.problem.rating} · {recommendation.slot}</span><h2>{recommendation.problem.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X /></button></div>
        {!showResult ? <>
          <div className="modal-body">
            <div className="timer"><div className="timer-value">{String(Math.floor(seconds / 60)).padStart(2,'0')}:{String(seconds % 60).padStart(2,'0')}</div><div className="timer-phase">{phase}</div><div className="timer-progress"><span style={{ width: `${Math.min(100, seconds / (60 * 45) * 100)}%` }} /></div><div className="protocol-now">{protocol}</div><div className="session-actions"><button className="soft-button" onClick={() => setRunning((value) => !value)}>{running ? <Pause /> : <Play />}{running ? 'Pausar' : 'Continuar'}</button><a className="ghost-button" href={recommendation.problem.url} target="_blank" rel="noreferrer"><ExternalLink /> Abrir problema</a></div></div>
            <div className="session-checklist">{['Probé n=1/2 y límites máximos.', 'Probé duplicados, ordenado e invertido.', 'Puedo explicar la complejidad y el invariante.'].map((label,index) => <label className="check-item" key={label}><input type="checkbox" checked={checks[index]} onChange={() => setChecks((values) => values.map((value,i) => i === index ? !value : value))} />{label}</label>)}</div>
          </div>
          <div className="modal-footer"><button className="ghost-button" onClick={onClose}>Salir sin registrar</button><button className="primary-button" onClick={onFinish}>Cerrar sesión <ChevronRight /></button></div>
        </> : <SessionResult problemId={recommendation.problem.id} seconds={seconds} onSave={onSave} />}
      </section>
    </div>
  )
}

function SessionResult({ problemId, seconds, onSave }: { problemId: string; seconds: number; onSave: (log: SessionLog) => void }) {
  const [result, setResult] = useState<'solved' | 'unsolved'>('solved')
  const [attempts, setAttempts] = useState(1)
  const [cause, setCause] = useState<SessionCause | null>(null)
  const [confidence, setConfidence] = useState(3)
  const [editorialUsed, setEditorialUsed] = useState(false)
  const [notes, setNotes] = useState('')
  const needsCause = result === 'unsolved' || attempts > 1
  return <>
    <div className="modal-body">
      <div className="result-options"><button className={`result-option ${result === 'solved' ? 'selected' : ''}`} onClick={() => setResult('solved')}><strong>Accepted</strong><span>La solución quedó resuelta y enviada.</span></button><button className={`result-option ${result === 'unsolved' ? 'selected' : ''}`} onClick={() => setResult('unsolved')}><strong>Quedó pendiente</strong><span>Se convertirá en deuda para upsolve.</span></button></div>
      <div className="form-grid">
        <div className="field"><label>Número de envíos</label><input className="input" type="number" min="1" max="30" value={attempts} onChange={(event) => setAttempts(Math.max(1, Number(event.target.value)))} /></div>
        <div className="field"><label>Usé editorial</label><select className="input" value={editorialUsed ? 'yes' : 'no'} onChange={(event) => setEditorialUsed(event.target.value === 'yes')}><option value="no">No</option><option value="yes">Sí, y reimplementé</option></select></div>
        <div className="field full"><label>Causa principal del error {needsCause ? '· requerida' : '· opcional'}</label><div className="cause-grid">{FAILURE_CAUSES.map((item) => <button key={item.value} className={`cause-button ${cause === item.value ? 'selected' : ''}`} onClick={() => setCause(cause === item.value ? null : item.value)}>{item.label}</button>)}</div></div>
        <div className="field full"><label>Confianza en la solución · {confidence}/5</label><div className="rating-scale">{[1,2,3,4,5].map((value) => <button className={confidence === value ? 'selected' : ''} onClick={() => setConfidence(value)} key={value}>{value}</button>)}</div></div>
        <div className="field full"><label>Aprendizaje o contraejemplo</label><textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="¿Qué afirmación falló? ¿Qué vas a reconocer más rápido la próxima vez?" /></div>
      </div>
    </div>
    <div className="modal-footer"><span style={{ color:'var(--muted)', fontSize:9, alignSelf:'center' }}>{needsCause && !cause ? 'Elige la causa real, no el veredicto.' : `${Math.max(1, Math.round(seconds / 60))} min registrados`}</span><button className="primary-button" disabled={needsCause && !cause} onClick={() => onSave({ id: `${problemId}-${Date.now()}`, problemId, completedAt: new Date().toISOString(), timeMinutes: Math.max(1, Math.round(seconds / 60)), result, attempts, firstSubmit: result === 'solved' && attempts === 1, cause, confidence: confidence as 1 | 2 | 3 | 4 | 5, editorialUsed, notes })}><Check /> Guardar sesión</button></div>
  </>
}

function MobileNav({ page, onNavigate }: { page: Page; onNavigate: (page: Page) => void }) {
  const shortLabels: Record<Page, string> = { today: 'Hoy', random: 'Random', problems: 'Problemas', tutor: 'Tutor', progress: 'Progreso', plan: 'Plan', settings: 'Ajustes' }
  return <nav className="mobile-nav">{NAVIGATION.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => onNavigate(id)} aria-label={label}><Icon /><span>{shortLabels[id]}</span></button>)}</nav>
}

export default App
