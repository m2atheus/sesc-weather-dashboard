import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  FlaskConical,
  LayoutDashboard,
  RadioTower,
  CloudSun,
  RefreshCw,
} from 'lucide-react'
import { config } from './config'
import { api } from './data/api'
import {
  Source,
  readingState,
  useCurrent,
  useSource,
  useStations,
} from './data/hooks'
import type { WeatherService } from './data/types'
import { dateTime } from './utils/format'
import { Feedback } from './components/Feedback'
import { SlidingIndicator } from './components/SlidingTabs'
import Overview from './pages/Overview'
const History = lazy(() => import('./pages/History'))
const About = lazy(() => import('./pages/About'))
const demoModule = import.meta.env.DEV ? () => import('./data/demo') : undefined

export default function App() {
  const [service, setService] = useState<WeatherService>(api)
  const [demo, setDemo] = useState(config.demoInitially)
  useEffect(() => {
    let active = true
    if (demo && demoModule)
      demoModule().then((m) => {
        if (active) setService(m.demo)
      })
    else setService(api)
    return () => {
      active = false
    }
  }, [demo])
  if ((service !== api) !== demo) return <Feedback busy />
  return (
    <Source.Provider value={{ service, demo }}>
      <Dashboard key={String(demo)} toggle={() => setDemo(!demo)} />
    </Source.Provider>
  )
}
export function Dashboard({ toggle }: { toggle: () => void }) {
  const { demo } = useSource()
  const location = useLocation()
  const catalog = useStations()
  const stations = catalog.data?.pages.flat() ?? []
  const [selected, setSelected] = useState<number>()
  const listed = stations.find((s) => s.id === selected) ?? stations[0]
  const { detail, latest } = useCurrent(listed?.id)
  const station = detail.data ?? listed
  const hasError = catalog.error ?? detail.error ?? latest.error
  const status =
    catalog.isSuccess && !listed
      ? 'Sem estações'
      : readingState(station, latest.data, hasError)
  const fetchTime = latest.dataUpdatedAt
  const main = useRef<HTMLElement>(null)
  const previous = useRef(location.pathname)
  useEffect(() => {
    const page =
      location.pathname === '/'
        ? 'Visão geral'
        : location.pathname === '/historico'
          ? 'Histórico'
          : location.pathname === '/sobre'
            ? 'Sobre'
            : 'Página não encontrada'
    document.title = page + ' · ' + config.name
    if (previous.current !== location.pathname) {
      main.current?.focus()
      window.scrollTo(0, 0)
    }
    previous.current = location.pathname
  }, [location.pathname])
  function refresh() {
    void catalog.refetch()
    if (listed) {
      void detail.refetch()
      void latest.refetch()
    }
  }
  const [name, institution] = config.name.split('|').map((s) => s.trim())
  const isDataPage =
    location.pathname === '/' || location.pathname === '/historico'
  return (
    <>
      <a className="skip" href="#conteudo">
        Ir para o conteúdo
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link className="brand" to="/" aria-label={config.name}>
            <span className="brand-symbol">
              <CloudSun size={30} strokeWidth={1.65} />
            </span>
            <span className="brand-name">{name}</span>
            {institution && <b className="brand-inst">{institution}</b>}
          </Link>
          <nav className="t-tabs-nav" aria-label="Navegação principal">
            <SlidingIndicator selection={location.pathname} />
            {[
              { icon: LayoutDashboard, path: '/', label: 'Visão geral' },
              {
                icon: ChartNoAxesCombined,
                path: '/historico',
                label: 'Histórico',
              },
              { icon: BookOpen, path: '/sobre', label: 'Sobre' },
            ].map(({ icon: Icon, path, label }) => (
              <NavLink end key={path} to={path}>
                <Icon size={17} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <div className="context-strip">
        <div className="wrap context-inner">
          <div className="station-identity">
            <RadioTower size={16} />
            <span className="station-prefix">Estação</span>
            {stations.length > 1 ? (
              <label className="select-field">
                <span className="sr-only">Selecionar estação</span>
                <select
                  value={listed?.id}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
            ) : (
              <b>{station?.name ?? 'WS-2000'}</b>
            )}
            {catalog.hasNextPage && (
              <button
                className="text-button"
                disabled={catalog.isFetchingNextPage}
                onClick={() => catalog.fetchNextPage()}
              >
                Mais estações
              </button>
            )}
            {(demo || station?.is_simulated) && (
              <span className="demo-tag">
                <FlaskConical size={13} />
                {demo ? 'Demonstração' : 'Estação simulada'}
              </span>
            )}
          </div>
          <div className="station-status">
            {latest.data && (
              <span className="header-time">
                Medição em {dateTime(latest.data.measured_at_utc)}
              </span>
            )}
            <span
              className={
                'connection ' + (status === 'Dados atualizados' ? 'ok' : '')
              }
              role="status"
            >
              <i />
              {status === 'Carregando' ? 'Carregando medições…' : status}
            </span>
            <button
              className="refresh-action"
              onClick={refresh}
              disabled={
                catalog.isFetching || detail.isFetching || latest.isFetching
              }
            >
              <RefreshCw size={15} />
              Atualizar
            </button>
          </div>
        </div>
      </div>
      <main ref={main} tabIndex={-1} id="conteudo" className="wrap main">
        {isDataPage && (
          <>
            <Feedback
              error={hasError}
              retry={refresh}
              empty={
                catalog.isSuccess && !listed
                  ? 'Nenhuma estação cadastrada. Aguardando a primeira transmissão.'
                  : undefined
              }
            />
            {listed && !hasError && (
              <Feedback
                empty={
                  latest.data === null
                    ? 'Estação cadastrada. Aguardando a primeira medição.'
                    : undefined
                }
              />
            )}
            {import.meta.env.DEV &&
              !demo &&
              (hasError || (!listed && catalog.isSuccess)) && (
                <button className="demo-action" onClick={toggle}>
                  <FlaskConical size={16} />
                  Abrir demonstração com dados simulados
                </button>
              )}
          </>
        )}
        <Suspense fallback={<Feedback busy />}>
          <Routes>
            <Route
              path="/"
              element={
                <Overview
                  station={station}
                  row={latest.data}
                  status={status}
                  successAt={fetchTime}
                />
              }
            />
            <Route
              path="/historico"
              element={<History key={station?.id} station={station} />}
            />
            <Route path="/sobre" element={<About />} />
            <Route
              path="*"
              element={
                <section className="panel about-panel">
                  <h1>Página não encontrada</h1>
                  <Link className="text-button" to="/">
                    Voltar à visão geral
                  </Link>
                </section>
              }
            />
          </Routes>
        </Suspense>
      </main>
      <footer>
        <div className="wrap footer-inner">
          <span>
            <RadioTower size={17} />
            {config.name}
          </span>
          <span>Horário de Recife · Unidades métricas</span>
        </div>
        <div className="wrap footer-inner footer-meta">
          <span>
            {fetchTime
              ? 'Última consulta bem-sucedida em ' + dateTime(fetchTime)
              : 'Aguardando consulta às medições'}
          </span>
          <div>
            {import.meta.env.DEV && (
              <button onClick={toggle}>
                <FlaskConical size={14} />
                {demo ? 'Voltar à API' : 'Modo demonstração'}
              </button>
            )}
          </div>
        </div>
      </footer>
    </>
  )
}
