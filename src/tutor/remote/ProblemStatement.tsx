import { useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import type { Problem } from './client'
import { codeforcesSourceUrl } from './codeforcesSource'

type StatementTab = 'statement' | 'codeforces'

export function ProblemStatement({ problem }: { problem: Problem }) {
  return <ProblemStatementContent key={problem.id} problem={problem} />
}

function ProblemStatementContent({ problem }: { problem: Problem }) {
  const id = useId()
  const [activeTab, setActiveTab] = useState<StatementTab>('statement')
  const statementButton = useRef<HTMLButtonElement>(null)
  const sourceButton = useRef<HTMLButtonElement>(null)
  const sourceUrl = codeforcesSourceUrl(problem.provenance)
  const selectedTab = sourceUrl ? activeTab : 'statement'

  function selectWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    let next: StatementTab
    if (event.key === 'Home') next = 'statement'
    else if (event.key === 'End') next = sourceUrl ? 'codeforces' : 'statement'
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      next = sourceUrl && selectedTab === 'statement' ? 'codeforces' : 'statement'
    } else return
    event.preventDefault()
    setActiveTab(next)
    ;(next === 'statement' ? statementButton : sourceButton).current?.focus()
  }

  return <section className="study-card study-problem">
    <span className="eyebrow">{problem.topics.join(' · ')}</span>
    <h2>{problem.title}</h2>
    <div className="study-statement-tabs" role="tablist" aria-label="Enunciado y fuente del problema">
      <button type="button" className="study-statement-tab" role="tab" id={`${id}-statement-tab`}
        aria-selected={selectedTab === 'statement'} aria-controls={`${id}-statement-panel`}
        tabIndex={selectedTab === 'statement' ? 0 : -1} ref={statementButton}
        onKeyDown={selectWithKeyboard} onClick={() => setActiveTab('statement')}>Enunciado</button>
      <button type="button" className="study-statement-tab" role="tab" id={`${id}-codeforces-tab`}
        aria-selected={selectedTab === 'codeforces'} aria-controls={`${id}-codeforces-panel`}
        aria-describedby={!sourceUrl ? `${id}-source-note` : undefined}
        tabIndex={selectedTab === 'codeforces' ? 0 : -1} disabled={!sourceUrl} ref={sourceButton}
        onKeyDown={selectWithKeyboard} onClick={() => setActiveTab('codeforces')}>Codeforces</button>
    </div>
    {sourceUrl
      ? <a className="study-original-link" href={sourceUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink size={15} aria-hidden="true" /> Abrir original en Codeforces <span>(nueva pestaña)</span>
      </a>
      : <p className="study-note" id={`${id}-source-note`}>Este problema no tiene un enunciado de Codeforces vinculado.</p>}
    <div className="study-statement-panel" id={`${id}-statement-panel`} role="tabpanel"
      aria-labelledby={`${id}-statement-tab`} hidden={selectedTab !== 'statement'} tabIndex={0}>
      <p className="study-prose">{problem.statement}</p>
      <details open><summary>Entrada, salida y ejemplos</summary>
        <h3>Entrada</h3><p className="study-prose">{problem.input_format}</p>
        <h3>Salida</h3><p className="study-prose">{problem.output_format}</p>
        <h3>Restricciones</h3><p className="study-prose">{problem.constraints}</p>
        {problem.examples.map((sample, index) => <div className="study-example" key={index}>
          <span>Entrada</span><pre>{sample.input}</pre><span>Salida</span><pre>{sample.output}</pre>
        </div>)}
      </details>
      <p className="study-note">{problem.provenance.platform} · dificultad local {problem.difficulty}/5</p>
    </div>
    <div className="study-statement-panel study-external-source" id={`${id}-codeforces-panel`} role="tabpanel"
      aria-labelledby={`${id}-codeforces-tab`} hidden={selectedTab !== 'codeforces'} tabIndex={0}>
      <h3>Enunciado original</h3>
      <p>Consulta la explicación y los ejemplos de este mismo problema en Codeforces.</p>
      <p className="study-note">La vista integrada de Codeforces no está disponible. Usa el enlace de arriba para abrir el original en una nueva pestaña y vuelve aquí para continuar con el tutor.</p>
    </div>
  </section>
}
