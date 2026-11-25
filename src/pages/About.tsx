import {
  Antenna,
  Database,
  Monitor,
  Ruler,
  Clock3,
  Activity,
} from 'lucide-react'
import partnership from '../assets/parceria-ufrpe-uast-sesc.png'

export default function About() {
  return (
    <>
      <header className="page-heading" data-enter>
        <h1>Sobre a estação</h1>
      </header>
      <section className="about-intro">
        <div className="about-lead">
          <h2>A Ambient Weather WS-2000</h2>
          <p>
            A Ambient Weather WS-2000 mede as condições do ar no local onde está
            instalada. Aqui, visitantes, estudantes e pesquisadores podem
            acompanhar essas leituras e consultar o histórico.
          </p>
          <p>
            Os sensores registram temperatura, umidade, vento, chuva, pressão
            atmosférica, radiação solar e índice ultravioleta.
          </p>
        </div>
        <div className="apparatus">
          <img
            src="/estacao-esquema.svg"
            width="310"
            height="218"
            alt="Esquema ilustrativo de uma estação com sensores de vento e abrigo para instrumentos."
          />
        </div>
      </section>
      <section className="about-process">
        <h2>Como os dados chegam ao painel</h2>
        <ol className="flow">
          {[
            {
              icon: Antenna,
              title: 'Estação meteorológica',
              description: 'Os sensores registram as condições locais.',
            },
            {
              icon: Database,
              title: 'Servidor de dados',
              description: 'O servidor recebe e organiza as medições.',
            },
            {
              icon: Monitor,
              title: 'Painel web',
              description: 'Os registros ficam disponíveis para consulta.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <li key={title}>
              <Icon size={22} aria-hidden="true" />
              <b>{title}</b>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>
      <div className="about-columns">
        <section className="panel about-panel">
          <h2>Sobre os dados</h2>
          <p>
            <Clock3 size={19} aria-hidden="true" />
            Os horários seguem o fuso de Recife. O horário da medição indica
            quando a estação registrou a amostra.
          </p>
          <p>
            <Ruler size={19} aria-hidden="true" />
            Os valores usam unidades métricas. A chuva indica o acumulado
            informado pela estação.
          </p>
          <p>
            <Activity size={19} aria-hidden="true" />A atualização depende da comunicação. Lacunas
            podem ocorrer quando a estação ou um sensor deixa de transmitir.
          </p>
        </section>
        <section className="panel about-panel partnership">
          <h2>Instituições do projeto</h2>
          <img
            src={partnership}
            alt="Parceria entre a UFRPE, Unidade Acadêmica de Serra Talhada (UAST), e o Sesc"
            width="800"
            height="450"
            loading="lazy"
            decoding="async"
          />
        </section>
      </div>
    </>
  )
}
