import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Station } from '../data/types'
import { dateTime } from '../utils/format'

type Props = {
  station?: Station
  loading: boolean
  failed: boolean
  demo: boolean
  toggleDemo: () => void
  readerAddress: string
  checkedAt: number
}

export function StationStatusBadge({ station, loading, failed, demo, toggleDemo, readerAddress, checkedAt }: Props) {
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const shown = open || hovered
  const state = failed ? 'unknown' : station?.communication ?? (loading ? 'loading' : 'empty')
  const label = {
    online: 'Em comunicação', delayed: 'Comunicação atrasada', offline: 'Sem comunicação',
    unknown: 'Comunicação não confirmada', loading: 'Consultando estação…', empty: 'Sem estação',
  }[state]
  const shortName = demo ? 'Demonstração' : station?.is_simulated ? 'Simulador' : station?.name

  useEffect(() => {
    if (!shown) return
    function close() {
      setOpen(false)
      setHovered(false)
    }
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) close()
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (container.current?.contains(document.activeElement)) trigger.current?.focus()
        close()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [shown])

  return <div className="station-badge" ref={container}
    onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true) }}
    onPointerLeave={() => setHovered(false)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setHovered(false) } }}>
    <button ref={trigger} type="button" className="badge-trigger" aria-expanded={shown} aria-controls={id}
      onClick={() => { setHovered(false); setOpen(!open) }}>
      <i className={'station-dot ' + state} aria-hidden="true" />
      <span aria-live="polite">{label}{shortName && <> · <span className="badge-source">{shortName}</span></>}</span>
      <span className="sr-only">Detalhes da estação</span>
      <ChevronDown size={14} aria-hidden="true" />
    </button>
    <div id={id} className={`badge-details t-dropdown${shown ? ' is-open' : ''}`} inert={!shown}>
      <dl>
        {station && <><dt>Estação</dt><dd>{station.name}</dd></>}
        <dt>Fonte</dt><dd>{demo ? 'Demonstração local' : station?.is_simulated ? 'Simulador da estação' : 'Leitor público'}</dd>
        {station && <><dt>Modelo</dt><dd>{station.model}</dd><dt>Último contato</dt><dd>{dateTime(station.last_seen_at)} (Recife)</dd></>}
        {!demo && <><dt>API</dt><dd>{readerAddress}</dd>
          {!!checkedAt && <><dt>Verificação</dt><dd>{dateTime(checkedAt)} (Recife)</dd></>}</>}
      </dl>
      {import.meta.env.DEV && <button type="button" className="text-button" onClick={toggleDemo}>
        {demo ? 'Voltar à API' : 'Abrir demonstração'}
      </button>}
    </div>
  </div>
}
