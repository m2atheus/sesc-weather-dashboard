import { useEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LoaderCircle,
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
            type="button"
            className="btn btn-primary"
            disabled={!station || exporting}
            aria-busy={exporting}
            onClick={exportData}
          >
            {exporting ? <LoaderCircle className="spin" size={16} aria-hidden="true" />
              : <Download size={16} aria-hidden="true" />}
            {exporting ? 'Preparando CSV…' : 'Exportar CSV'}
          </button>
        )}
      </div>
      <section className="panel toolbar" aria-label="Filtros da consulta">
        <div className="toolbar-row">
          {/* The variable drives both the period summary and the series below. */}
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
            <ChevronDown size={16} aria-hidden="true" />
          </label>
          <div className="field">
            <span className="field-label" aria-hidden="true">Período</span>
            <SlidingTabs
              className="period-buttons"
              label="Período de consulta"
              selection={edit ? 'custom' : preset}
            >
              {[1, 7, 30]
                .filter((d) => d <= config.maxDays)
                .map((d) => (
                  <button
                    type="button"
                    className="t-tab"
                    key={d}
                    aria-pressed={!edit && preset === d}
                    onClick={() => apply(rollingPeriod(d), d)}
                  >
                    {d === 1 ? '24 horas' : d + ' dias'}
                  </button>
                ))}
              <button
                type="button"
                className="t-tab"
                aria-expanded={edit}
                aria-pressed={edit || preset === 'custom'}
                onClick={() => setEdit(!edit)}
              >
                Personalizado
              </button>
            </SlidingTabs>
          </div>
        </div>
        {edit && (
          <form
            className="date-form"
            noValidate
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
                aria-invalid={validation ? true : undefined}
                aria-describedby={validation ? 'period-error' : undefined}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Data final
              <input
                required
                type="date"
                value={to}
                aria-invalid={validation ? true : undefined}
                aria-describedby={validation ? 'period-error' : undefined}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
            <button className="btn btn-primary">Aplicar período</button>
            {validation && <p id="period-error" className="form-error" role="alert">{validation}</p>}
          </form>
        )}
        <p className="period-caption">
          <CalendarDays size={15} aria-hidden="true" />
          {dateTime(period.start)} até {dateTime(period.end)} · Horário de
          Recife
        </p>
      </section>
      <Feedback error={exportError} />
      {station && <HistoryIndicators stationId={station.id} period={period} variable={variable} />}
      <section className="panel history-panel" aria-labelledby="series-title">
        <div className="history-controls">
          <div className="history-title">
            <h2 id="series-title">Série de medições</h2>
            {rows.length > 0 && (
              <p className="period-caption">
                {dateTime(rows[rows.length - 1].measured_at_utc)} até{' '}
                {dateTime(rows[0].measured_at_utc)} · {rows.length}{' '}
                {rows.length === 1 ? 'medição' : 'medições'} nesta página
              </p>
            )}
          </div>
          <SlidingTabs
            className="view-buttons"
            label="Apresentação das medições"
            selection={table ? 'table' : 'chart'}
          >
            <button
              type="button"
              className="t-tab"
              aria-pressed={!table}
              onClick={() => setTable(false)}
            >
              <ChartNoAxesCombined size={16} aria-hidden="true" />
              Gráfico
            </button>
            <button
              type="button"
              className="t-tab"
              aria-pressed={table}
              onClick={() => setTable(true)}
            >
              <Table2 size={16} aria-hidden="true" />
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
              type="button"
              className="btn btn-secondary last-day"
              onClick={() => {
                const day = localDay(Date.parse(station.last_measured_at_utc!))
                setFrom(day)
                setTo(day)
                apply(calendarPeriod(day, day), 'custom')
              }}
            >
              <CalendarDays size={16} aria-hidden="true" />
              Consultar dia da última medição
            </button>
          )}
        {rows.length > 0 &&
          (table ? (
            <div className="data-table" tabIndex={0} role="region" aria-labelledby="series-title">
              <table>
                <caption className="sr-only">
                  Medições da página em ordem decrescente
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Data e hora</th>
                    <th scope="col" className="num">
                      {v.title} ({v.unit})
                    </th>
                    {variable === 'wind' && <th scope="col" className="num">Rajadas (m/s)</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{dateTime(r.measured_at_utc)}</td>
                      <td className="num">{number(r[v.key])}</td>
                      {variable === 'wind' && (
                        <td className="num">{number(r.wind_gust_ms)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Plot variable={variable} rows={rows} />
          ))}
        <nav className="pagination" aria-label="Paginação das medições">
          <span>Página {page} · Mais recentes primeiro</span>
          <div>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="Página anterior"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              aria-label="Próxima página"
              disabled={!history.data || rows.length < history.data.page_size}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </nav>
      </section>
    </>
  )
}
