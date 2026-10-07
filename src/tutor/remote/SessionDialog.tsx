import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'

export function SessionDialog({ mode, title, busy, error, onClose, onConfirm }: {
  mode: 'start' | 'finish'; title: string; busy: boolean; error: string
  onClose: () => void; onConfirm: (outcome?: 'completed' | 'stopped') => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [accepted, setAccepted] = useState(false)
  const [outcome, setOutcome] = useState<'completed' | 'stopped'>('completed')
  useEffect(() => {
    const node = dialog.current
    node?.showModal()
    return () => node?.close()
  }, [])
  return <dialog ref={dialog} className="study-dialog" aria-labelledby="session-dialog-title"
    onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <div className="study-dialog-top"><ShieldCheck size={25} /><button className="study-secondary" aria-label="Cerrar" onClick={onClose} disabled={busy}><X size={18} /></button></div>
    <h2 id="session-dialog-title">{mode === 'start' ? 'Antes de comenzar' : 'Finalizar esta sesión'}</h2>
    <p className="study-dialog-problem">{title}</p>
    {mode === 'start' ? <>
      <p>Dedica esta sesión únicamente a este problema. Así podremos registrar el tiempo de tu proceso de resolución.</p>
      <p>El contador comienza al confirmar y continúa aunque cambies de pestaña o cierres el navegador. Incluye la lectura y la espera del tutor. Finaliza la sesión cuando termines o decidas detenerte.</p>
      <label className="study-checkbox"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} />
        Me comprometo a trabajar solo en este problema durante la sesión y a finalizarla al dejar de trabajar.</label>
    </> : <>
      <p>Se guardará el tiempo transcurrido y podrás consultar el historial. Para volver a trabajar en el problema, inicia una nueva sesión.</p>
      <label>¿Cómo terminó tu trabajo?<select value={outcome} onChange={event => setOutcome(event.target.value as typeof outcome)} disabled={busy}>
        <option value="completed">Terminé mi solución</option><option value="stopped">Me detuve sin terminar</option>
      </select></label>
      <p className="study-note">Esta declaración no equivale a una solución aceptada por el juez.</p>
    </>}
    {error && <p className="study-error" role="alert">{error}</p>}
    <div className="study-dialog-actions"><button className="study-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
      <button className="study-primary" onClick={() => onConfirm(mode === 'finish' ? outcome : undefined)} disabled={busy || (mode === 'start' && !accepted)}>
        {busy ? 'Guardando…' : mode === 'start' ? 'Confirmar e iniciar' : 'Guardar y finalizar'}
      </button></div>
  </dialog>
}
