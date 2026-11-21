import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react'
import { config } from './config'
import { api, ApiError } from './data/api'
import {
  Source,
  useCurrent,
  useSource,
  useStations,
} from './data/hooks'
import type { WeatherService } from './data/types'
import { StationStatusBadge } from './components/StationStatusBadge'
import { Feedback } from './components/Feedback'
import { SlidingIndicator } from './components/SlidingTabs'
import { ThemeToggle } from './components/ThemeToggle'
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
  const checks = [catalog, detail, latest]
  const lastSuccess = Math.max(...checks.map((query) => query.dataUpdatedAt))
  const lastFailure = checks.reduce((a, b) => a.errorUpdatedAt >= b.errorUpdatedAt ? a : b)
  const readerError = lastFailure.errorUpdatedAt >= lastSuccess ? lastFailure.error : null
  let readerStatus = lastSuccess ? 'API disponível' : 'Verificando API…'
  if (readerError instanceof ApiError && readerError.status === 429) {
    readerStatus = 'API com limite de consultas'
  } else if (readerError instanceof ApiError && readerError.status < 500) {
    readerStatus = 'API respondeu com erro'
  } else if (readerError) {
    readerStatus = 'API indisponível'
  }
  const checkedAt = Math.max(lastSuccess, lastFailure.errorUpdatedAt)
  const readerAddress = new URL(config.base, window.location.href).host
  const previouslyUnavailable = useRef(false)
  useEffect(() => {
    if (previouslyUnavailable.current && !readerError && lastSuccess) {
      // The reader is back. Retry cached failures without waiting for their backoff.
      if (catalog.isError) void catalog.refetch({ cancelRefetch: false })
      if (detail.isError) void detail.refetch({ cancelRefetch: false })
      if (latest.isError) void latest.refetch({ cancelRefetch: false })
    }
    previouslyUnavailable.current = Boolean(readerError)
  }, [
    readerError, lastSuccess, catalog.isError, catalog.refetch,
    detail.isError, detail.refetch, latest.isError, latest.refetch,
  ])
  const refreshing = catalog.isFetching || detail.isFetching || latest.isFetching
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
  const partners = institution?.split(' e ')
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
            <img className="brand-symbol" src="/estacao-meteorologica.png" alt="" width="1024" height="1024" />
            <span className="brand-name">
              {name === 'Estação Meteorológica' ? (
                <>Estação<small>Meteorológica</small></>
              ) : name}
            </span>
            {institution && (
              <span className="brand-inst">
                {partners?.map((partner) => <span key={partner}>{partner}</span>)}
              </span>
            )}
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
          <ThemeToggle />
        </div>
      </header>
      <div className="context-strip">
        <div className="wrap context-inner">
          <div className="station-identity">
            <StationStatusBadge station={station} loading={catalog.isPending} failed={Boolean(catalog.error || detail.error || readerError)}
              demo={demo} toggleDemo={toggle} readerAddress={readerAddress} checkedAt={checkedAt} />
            {stations.length > 1 && (
              <label className="select-field">
                <span className="sr-only">Selecionar estação</span>
                <select value={listed?.id} onChange={(e) => setSelected(Number(e.target.value))}>
                  {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown size={14} />
              </label>
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
          </div>
          <div className="station-status">
            {!demo && (
              <span className={'connection ' + (readerError ? 'failed' : lastSuccess ? 'ok' : '')}
                role="status">
                <i />{readerStatus}
              </span>
            )}
            <button
              className="refresh-action"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? 'spin' : undefined} size={15} />
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
                  loading={latest.isPending && !hasError && (!catalog.isSuccess || !!listed)}
                  cached={Boolean(hasError && latest.data)}
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
            <span className="footer-mark">
              <img src="/favicon-estacao.png" alt="" width="24" height="24" />
            </span>
            {config.name}
          </span>
          <span>Horário de Recife · Unidades métricas</span>
        </div>
        <nav className="wrap footer-repos" aria-label="Repositórios do projeto no GitHub">
          {[
            { repo: 'sesc-weather-dashboard', label: 'Código do painel' },
            { repo: 'projeto-sesc-API', label: 'Código da API' },
          ].map(({ repo, label }) => (
            <a key={repo} href={`https://github.com/m2atheus/${repo}`} target="_blank" rel="noopener noreferrer">
              <svg width="21" height="21" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              {label}
              <ArrowUpRight size={16} aria-hidden="true" />
              <span className="sr-only"> no GitHub (abre em nova aba)</span>
            </a>
          ))}
        </nav>
      </footer>
    </>
  )
}
