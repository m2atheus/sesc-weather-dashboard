# Observatório Meteorológico | SESC

Painel público das medições da Ambient Weather WS-2000. A aplicação consulta o leitor público FastAPI e apresenta valores métricos em português, com datas no fuso de Recife. O frontend é estático em produção.

## Executar no computador pessoal

Pré-requisitos: Node.js 22.16 ou superior e npm. Execute os comandos na raiz de `sesc-weather-dashboard`.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

No Linux ou macOS, use `cp .env.example .env.local`. Abra **http://localhost:5173**. Use exatamente essa origem quando o backend estiver com o CORS padrão de desenvolvimento. Se o Vite indicar outra porta, libere a 5173 ou cadastre a nova origem no ambiente de desenvolvimento do leitor.

Para usar a API, inicie o **leitor público** no projeto Python já instalado. No Windows, execute `.\scripts\start.ps1 public` na raiz de `projeto-sesc-API`. No Linux, use `bash scripts/start.sh public`. O endereço padrão é `http://127.0.0.1:8080/api/v1`. O aplicativo descobre os IDs pelo catálogo de estações. A instância combinada de Swagger entrega um cadastro de estações diferente. O dashboard exige o contrato do leitor público.

### Demonstração sem equipamento

Em desenvolvimento, selecione **Modo demonstração** no rodapé ou defina `VITE_DEMO_MODE=true` em `.env.local` e reinicie o Vite. O painel identifica a fonte como **Demonstração** e oferece **Voltar à API**. As leituras ilustrativas ficam na memória do navegador. A exportação CSV fica disponível quando o leitor fornece o arquivo.

Uma estação cadastrada no FastAPI com `is_simulated=true` recebe a identificação **Estação simulada**, inclusive quando as informações vêm pelo HTTP real. Uma falha de conexão mantém a fonte selecionada. O build de produção exclui o serviço de demonstração local.

## Páginas e medições

| Página | O que permite consultar |
| --- | --- |
| `/` | Temperatura externa e interna, umidade externa, vento, rajada e direção, chuva acumulada, pressão relativa e absoluta, radiação solar, UV e gráfico das últimas leituras de temperatura. |
| `/historico` | Intervalos de 24 horas, 7 ou 30 dias e datas personalizadas. Resumo do período, seis grandezas em gráfico ou tabela, paginação e exportação CSV do período pelo servidor. |
| `/sobre` | Estação, coleta, interpretação dos dados e imagem institucional fornecida pelo projeto. |

Temperaturas usam °C, vento e rajadas m/s, direção graus, chuva mm, pressão hPa, umidade %, radiação W/m² e UV é adimensional. Zero é exibido como medida. Campos ausentes ou nulos recebem “Indisponível”. A chuva representa o contador transmitido pela estação em cada instante, inclusive quando ele volta a zero. O gráfico preserva lacunas de sensores nulos.

## Configuração pública

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_API_BASE_URL` | DEV `http://127.0.0.1:8080/api/v1`, produção `/api/v1` | Base do serviço público, com o prefixo da API. |
| `VITE_OBSERVATORY_NAME` | `Observatório Meteorológico \| SESC` | Nome no cabeçalho, título do navegador e rodapé. |
| `VITE_DEMO_MODE` | `false` | Inicia com demonstração quando o valor é `true` em desenvolvimento. |
| `VITE_POLL_SECONDS` | `60` | Intervalo das consultas automáticas em aba visível. |
| `VITE_STALE_SECONDS` | `180` | Idade a partir da qual uma medição exibida é antiga. |
| `VITE_MAX_PERIOD_DAYS` | `31` | Limite para datas personalizadas e predefinições. Alinhe com `MAX_PERIOD_DAYS` no leitor. |

Os intervalos aceitam inteiros positivos. O Vite incorpora `VITE_*` ao JavaScript público no build. Configure apenas valores públicos. Mudanças exigem reiniciar o Vite ou recompilar os arquivos estáticos.

## Atualização, erros e volume de dados

O TanStack Query compartilha consultas por fonte, estação, período e página. Em aba visível, catálogo, comunicação e última observação são consultados a cada minuto por padrão. O gráfico recente acompanha novas consultas bem-sucedidas. O histórico mantém datas fixas entre páginas. A série utiliza a página de leituras e o resumo utiliza os agregados do servidor para o intervalo inteiro.

O horário de medição vem de `measured_at_utc`. O rodapé informa a última consulta bem-sucedida à observação atual. O detalhe da estação informa a comunicação. Uma retransmissão pode devolver uma leitura antiga mesmo que a estação continue online. A interface distingue atraso, perda de comunicação, falta de registros e falha de acesso à API.

Em caso de falha, o cache mantém a última leitura com seu horário. A próxima consulta automática é espaçada e o botão de nova tentativa permanece disponível. O cliente respeita `Retry-After` em 429, inclusive ao repetir manualmente. Os filtros permanecem editáveis após um 422. Requisições de consultas obsoletas recebem sinal de cancelamento.

O leitor fornece páginas de observações e resumos de todo o período. O gráfico mostra até uma página por vez, normalmente 100 pontos, e informa a faixa exibida. A tabela oferece acesso aos valores via teclado e leitor de tela. Os padrões do backend limitam a consulta a 31 dias e o CSV a 5.000 registros. Consulte [o consumo da API](docs/API_CONSUMPTION.md).

## Estrutura e tecnologias

```text
src/
  main.tsx, App.tsx       React Router, navegação, provedores e seleção de estação
  config.ts              Configuração pública do Vite
  data/                  Contratos TypeScript, validação HTTP, hooks e demonstração DEV
  pages/                 Visão geral, histórico e sobre
  components/            Cartões, valores, estados de consulta e gráficos
  utils/                 Formatação pt-BR e períodos em America/Recife
  styles.css             Estilos responsivos e Tailwind CSS
public/                  Ilustração vetorial do painel
docs/                    Contrato de integração, implantação e arte institucional
tests/                   Vitest e React Testing Library
```

React e TypeScript estrito implementam as telas. Vite e Tailwind CSS geram os recursos estáticos. Recharts renderiza as séries, Lucide React fornece os ícones e TanStack Query gerencia o estado remoto. Histórico, página institucional e gráficos têm carregamento sob demanda.

## Testes e produção

```sh
npm run test
npm run build
npm run preview
```

A suíte roda com mocks de HTTP e serviços, sem estação física. O build verifica tipos antes de gerar `dist/`. A pré-visualização serve os arquivos do build localmente, normalmente em `http://localhost:4173`. Para testar a API em outra origem, o leitor deve autorizar essa origem específica.

Para a instalação futura, gere o build com `VITE_API_BASE_URL=/api/v1` no ambiente de produção. Um valor absoluto em `.env.local` também é lido no build. Remova o ajuste de desenvolvimento ou sobrescreva-o em `.env.production.local` ou no ambiente do processo que compila.

No computador autorizado pela TI, o servidor estático deverá servir `dist/` em `/` e entregar `index.html` para as rotas de navegação do React. O proxy deverá encaminhar `/api/v1/` ao leitor, preservando caminhos, filtros, status e cabeçalhos. Essa regra tem precedência sobre o fallback da aplicação. O domínio HTTPS pode chegar a esse serviço pelo túnel autorizado. O navegador acessará frontend e API pela mesma origem. A instalação do túnel, a escolha do domínio e a validação com os sensores físicos fazem parte da implantação futura.

Os guias fornecidos pelo backend estão em [Integração do frontend](docs/FRONTEND_INTEGRATION.md) e [Implantação no SESC](docs/DEPLOY_SESC.md).
