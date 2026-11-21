import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Table2,
} from 'lucide-react'
import { Feedback } from '../components/Feedback'
import { SlidingTabs } from '../components/SlidingTabs'
import Plot from '../components/Plot'
import { variables, type Variable } from '../data/variables'
import { HistoryIndicators } from '../components/HistoryIndicators'
import { config } from '../config'
import { downloadCsv } from '../data/api'
import { useHistory, useSource } from '../data/hooks'
import type { Period, Station } from '../data/types'
import {
  calendarPeriod,
  dateTime,
  dayMs,
  localDay,
  number,
  rollingPeriod,
} from '../utils/format'

export default function History({ station }: { station?: Station }) {
  const { demo } = useSource()
  const [period, setPeriod] = useState(() =>
    rollingPeriod(Math.min(1, config.maxDays)),
  )
  const [preset, setPreset] = useState<number | 'custom'>(1)
  const [edit, setEdit] = useState(false)
  const [from, setFrom] = useState(() => localDay(Date.now() - dayMs))
  const [to, setTo] = useState(() => localDay(Date.now()))
  const [validation, setValidation] = useState('')
  const [page, setPage] = useState(1)
  const [variable, setVariable] = useState<Variable>('temperature')
  const [table, setTable] = useState(false)
  const history = useHistory(station?.id, period, page)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<unknown>(null)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  function apply(next: Period, name: typeof preset) {
    controller.current?.abort()
    controller.current = null
    setExporting(false)
    setExportError(null)
    setValidation('')
    setEdit(false)
    setPeriod(next)
    setPage(1)
    setPreset(name)
  }
  async function exportData() {
    if (!station || controller.current) return
    const task = new AbortController()
    controller.current = task
    setExportError(null)
    setExporting(true)
    try {
      await downloadCsv(station.id, period, task.signal)
    } catch (error) {
      if (!task.signal.aborted) setExportError(error)
    } finally {
      if (controller.current === task) {
        controller.current = null
        setExporting(false)
      }
    }
  }
  const rows = history.data?.items ?? []
  const v = variables[variable]
  return (
    <>
      <div className="page-heading" data-enter>
        <div>
          <h1>Histórico meteorológico</h1>
          <p>Consulte um período para comparar as leituras dos sensores.</p>
        </div>
        {!demo && (
          <button
            className="primary-button"
            disabled={!station || exporting}
            onClick={exportData}
          >
            <Download size={17} />
            {exporting ? 'Preparando CSV…' : 'Exportar CSV'}
          </button>
        )}
      </div>
      <div className="panel filter-panel">
        <div className="filter-top">
          <h2>
            <CalendarDays size={18} /> Período
          </h2>
          <SlidingTabs
            className="period-buttons"
            label="Período de consulta"
            selection={edit ? 'custom' : preset}
          >
            {[1, 7, 30]
              .filter((d) => d <= config.maxDays)
              .map((d) => (
                <button
                  className="t-tab"
                  key={d}
                  aria-pressed={!edit && preset === d}
                  onClick={() => apply(rollingPeriod(d), d)}
                >
                  {d === 1 ? '24 horas' : d + ' dias'}
                </button>
              ))}
            <button
              className="t-tab"
              aria-expanded={edit}
              aria-pressed={edit || preset === 'custom'}
              onClick={() => setEdit(!edit)}
            >
              Personalizado
            </button>
          </SlidingTabs>
        </div>
        {edit && (
          <form
            className="date-form"
            onSubmit={(e) => {
              e.preventDefault()
              try {
                apply(calendarPeriod(from, to), 'custom')
              } catch (err) {
                setValidation((err as Error).message)
              }
            }}
          >
            <label>
              Data inicial
              <input
                required
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Data final
              <input
                required
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <button className="primary-button">Aplicar período</button>
            {validation && <span role="alert">{validation}</span>}
          </form>
        )}
        <p className="period-caption">
          {dateTime(period.start)} até {dateTime(period.end)} · Horário de
          Recife
        </p>
      </div>
      <Feedback error={exportError} />
      {station && <HistoryIndicators stationId={station.id} period={period} variable={variable} />}
      <section className="panel history-panel">
        <div className="history-controls">
          <div>
            <h2>Série de medições</h2>
            <label className="select-field">
              <span className="field-label">Grandeza meteorológica</span>
              <select
                value={variable}
                onChange={(e) => setVariable(e.target.value as Variable)}
              >
                {Object.entries(variables).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.title} ({item.unit})
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </label>
          </div>
          <SlidingTabs
            className="view-buttons"
            label="Apresentação das medições"
            selection={table ? 'table' : 'chart'}
          >
            <button
              className="t-tab"
              aria-pressed={!table}
              onClick={() => setTable(false)}
            >
              <ChartNoAxesCombined size={16} />
              Gráfico
            </button>
            <button
              className="t-tab"
              aria-pressed={table}
              onClick={() => setTable(true)}
            >
              <Table2 size={16} />
              Tabela
            </button>
          </SlidingTabs>
        </div>
        {!station ? (
          <Feedback empty="Aguardando uma estação disponível." />
        ) : (
          <Feedback
            busy={history.isPending}
            error={history.error}
            retry={() => history.refetch()}
            empty={
              history.isSuccess && !rows.length
                ? page === 1
                  ? 'Nenhuma medição no período selecionado.'
                  : 'Fim das medições deste período.'
                : undefined
            }
          />
        )}
        {history.isSuccess &&
          !rows.length &&
          page === 1 &&
          station?.last_measured_at_utc &&
          (Date.parse(station.last_measured_at_utc) <
            Date.parse(period.start) ||
            Date.parse(station.last_measured_at_utc) >
              Date.parse(period.end)) && (
            <button
              className="text-button last-day"
              onClick={() => {
                const day = localDay(Date.parse(station.last_measured_at_utc!))
                setFrom(day)
                setTo(day)
                apply(calendarPeriod(day, day), 'custom')
              }}
            >
              <CalendarDays size={16} />
              Consultar dia da última medição
            </button>
          )}
        {rows.length > 0 && (
          <>
            <p className="period-caption">
              {dateTime(rows[rows.length - 1].measured_at_utc)} até{' '}
              {dateTime(rows[0].measured_at_utc)} · {rows.length}{' '}
              {rows.length === 1 ? 'medição' : 'medições'} nesta página
            </p>
            {table ? (
              <div className="data-table">
                <table>
                  <caption className="sr-only">
                    Medições da página em ordem decrescente
                  </caption>
                  <thead>
                    <tr>
                      <th>Data e hora</th>
                      <th>
                        {v.title} ({v.unit})
                      </th>
                      {variable === 'wind' && <th>Rajadas (m/s)</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td>{dateTime(r.measured_at_utc)}</td>
                        <td>{number(r[v.key])}</td>
                        {variable === 'wind' && (
                          <td>{number(r.wind_gust_ms)}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Plot variable={variable} rows={rows} />
            )}
          </>
        )}
        <div className="pagination">
          <span>Página {page} · Mais recentes primeiro</span>
          <div>
            <button
              aria-label="Página anterior"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <button
              aria-label="Próxima página"
              disabled={!history.data || rows.length < history.data.page_size}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
