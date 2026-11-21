# Integração do dashboard com a API meteorológica WS-2000

Este guia permite desenvolver o dashboard do projeto UFRPE–UAST e Sesc usando dados do simulador no computador pessoal e o mesmo contrato de leitura na futura instalação.

[Endpoints](#endpoints-do-dashboard) · [Unidades e sensores](#padrão-de-unidades-meteorológicas) · [Respostas de erro](#respostas-de-erro) · [Tipos e exemplos TypeScript](#tipos-de-resposta) · [Atualização do dashboard](#atualização-cache-e-horário-de-apresentação)

A estação Ambient Weather WS-2000 (ou o simulador em DEV) envia o protocolo `Same As AMBWeather` ao processo `ingest`. Esse processo valida a transmissão e grava os dois horários e os sensores em SQLite. O processo `public` abre o mesmo arquivo para leitura. A coleta continua mesmo com o dashboard fechado ou o túnel indisponível.

| Ambiente | Endereço padrão | Uso |
|---|---|---|
| DEV · leitor | `http://127.0.0.1:8080/api/v1` | Contrato do dashboard, inclusive os limites de produção |
| DEV · ingestão | `http://127.0.0.1:8001` | Console, simulador e monitoramento local |
| DEV · combinado | `http://127.0.0.1:8000` | Swagger, diagnóstico e cadastro interno das estações |
| SESC · futuro | `/api/v1` na origem HTTPS do dashboard | A TI definirá o domínio. O túnel encaminhará a API ao leitor local |

Os caminhos HTTP dos exemplos partem da raiz do respectivo serviço. Os IDs, horários, medições, arquivos e respostas de exemplo são ilustrativos. Descubra o ID pelo endpoint de estações.

## Endpoints do dashboard

| Método | Caminho | Serviço | Acesso | Finalidade |
|---|---|---|---|---|
| GET | `/api/v1/stations` | Público | Leitura anônima | Listar estações por ID |
| GET | `/api/v1/stations/{station_id}` | Público | Leitura anônima | Consultar identificação e comunicação |
| GET | `/api/v1/stations/{station_id}/latest` | Público | Leitura anônima | Obter a última observação recebida |
| GET | `/api/v1/stations/{station_id}/observations` | Público | Leitura anônima | Paginar medições por período |
| GET | `/api/v1/stations/{station_id}/summary` | Público | Leitura anônima | Calcular estatísticas de um período |
| GET | `/api/v1/stations/{station_id}/export.csv` | Público | Leitura anônima | Baixar medições em CSV |

## Como ler os contratos

Em **cada rota** desta referência, corpo da requisição, cabeçalhos obrigatórios e credenciais de usuário: **Não se aplica**. O acesso depende do serviço indicado. Parâmetros de caminho ou de query ausentes da descrição: **Não se aplica**. Todos os parâmetros de caminho são obrigatórios e sem valor padrão. O sucesso de um GET é `200`, normalmente com `application/json`. CSV, confirmação do console, HTML e arquivos estáticos têm o formato indicado em suas rotas.

| Parâmetro | Onde usar | Tipo, padrão e validação |
|---|---|---|
| `station_id` | Todos os caminhos que contêm `{station_id}` | Inteiro entre 1 e 9223372036854775807. No navegador use IDs retornados pelo servidor. O tipo `number` só representa inteiros com exatidão até `Number.MAX_SAFE_INTEGER`. |
| `page` | Lista pública, monitor e histórico | Inteiro opcional, começa em 1 (padrão). Na lista e no monitor o máximo é 1.000.000. No histórico, `(page - 1) × page_size` precisa caber em inteiro assinado de 64 bits. |
| `page_size` | Mesmas rotas de `page` | Inteiro opcional de 1 a `MAX_PAGE_SIZE` (padrão configurado 500). Omitido, vale o menor entre 100 e esse teto. |
| `start`, `end` | Histórico, resumo e CSV | Opcionais. Envie strings ISO 8601 com fuso, por exemplo `2026-11-20T00:00:00Z`. Os limites incluem os dois extremos e filtram `measured_at_utc`. Podem ser iguais. Use `URLSearchParams` para codificar offsets com `+`. |
| `order` | Somente histórico | String opcional `asc` (padrão) ou `desc`, por instante da medição. |

No leitor público, sem datas o período é o **dia corrente UTC** inteiro. Com uma única data, o servidor calcula o outro extremo somando ou subtraindo `MAX_PERIOD_DAYS` (padrão 31 dias). Com ambas, o início precisa ser anterior ou igual ao fim e a duração deve ficar dentro desse limite. Para exibir um dia civil de Recife, envie os limites daquele dia com seu fuso, inclusive na exportação.

## Padrão de unidades meteorológicas

O receptor converte as unidades originais da WS-2000 na ingestão. O SQLite guarda as grandezas normalizadas e conserva os parâmetros originais apenas em `raw_payload` para diagnóstico interno. JSON e CSV públicos já contêm os valores métricos. Use o valor recebido e arredonde apenas na apresentação.

| Propriedades de uma observação | Grandeza, na ordem indicada | Unidade |
|---|---|---|
| `outdoor_temperature_c`, `indoor_temperature_c` | Temperatura externa e interna | °C |
| `outdoor_humidity_pct`, `indoor_humidity_pct` | Umidade relativa externa e interna | % |
| `wind_speed_ms`, `wind_gust_ms` | Velocidade do vento e rajada | m/s |
| `wind_direction_deg`, `wind_gust_direction_deg` | Direção do vento e da rajada | graus (°) |
| `daily_rain_mm`, `hourly_rain_mm`, `weekly_rain_mm`, `monthly_rain_mm`, `yearly_rain_mm` | Acumulados do dia, hora, semana, mês e ano | mm |
| `absolute_pressure_hpa`, `relative_pressure_hpa` | Pressão absoluta e relativa | hPa |
| `uv_index` | Índice ultravioleta | adimensional |
| `solar_radiation_wm2` | Radiação solar | W/m² |

Os 17 sensores são números JSON ou `null`. O OpenAPI permite omitir cada sensor e o modelo usa `null` por padrão. A serialização atual inclui as chaves dos sensores ausentes com `null`. Na interface, use `valor == null` para mostrar “sem leitura”. Zero é uma medida válida. Para chuva, conserve o intervalo do acumulador e evite somar valores sucessivos do mesmo período.

## Consultas públicas, rota por rota

Os exemplos desta seção usam o leitor na porta 8080. Todas as seis rotas compartilham os erros de infraestrutura `414`, `429`, `503` e `500` descritos em **Respostas de erro**. Nas rotas com ID também se aplicam `404` para estação desconhecida e `422` para ID inválido.

### GET `/api/v1/stations`

Lista de `PublicStation` em ordem crescente de ID. Query opcional: `page` e `page_size`. A resposta é um array simples, inclusive quando só há uma estação. Uma página após a última ou um banco sem estações devolve `[]`. Paginação inválida resulta em `422`. Use esta chamada para preencher o seletor de estações.

```http
GET /api/v1/stations?page=2&page_size=100
```

```json
[]
```

### GET `/api/v1/stations/{station_id}`

Devolve um objeto `PublicStation`. Query: Não se aplica. Atualize esta consulta para saber se a estação ainda transmite. Exemplo de `GET /api/v1/stations/1`:

```json
{
  "id": 1, "name": "Simulador WS-2000", "model": "WS-2000", "is_simulated": true,
  "last_seen_at": "2026-11-20T14:30:02Z", "communication": "online", "seconds_since_contact": 58,
  "last_measured_at_utc": "2026-11-20T14:30:00Z", "seconds_since_measurement": 60
}
```

Todos os campos são obrigatórios. `id` é o inteiro da estação. `name` e `model` são textos. `is_simulated` identifica a origem simulada. `last_seen_at` é a data UTC da última transmissão aceita, inclusive repetida. `seconds_since_contact` é a idade inteira desse contato, com mínimo zero. `communication` é `online` abaixo de `STATION_DELAY_SECONDS` (180 s), `delayed` a partir desse limite e `offline` a partir de `STATION_TIMEOUT_SECONDS` (600 s). Os limiares são configuráveis.

`last_measured_at_utc` é o maior instante de medição conhecido. `seconds_since_measurement` é sua idade em segundos inteiros e pode ser negativa se o relógio do console estiver adiantado. Esses dois campos são nulos quando a estação ainda não tem observações. Um reenvio pode manter a estação online mesmo que a medição exibida seja antiga.

### GET `/api/v1/stations/{station_id}/latest`

Devolve `ObservationOut`, a observação recebida mais recentemente, com desempate pelo maior `id`. Uma transmissão atrasada pode ocupar essa posição. Query: Não se aplica. Para uma estação cadastrada sem observações, devolve `404` com `Estação sem observações`. Exemplo de `GET /api/v1/stations/1/latest`:

```json
{
  "id": 1, "station_id": 1,
  "measured_at_utc": "2026-11-20T14:30:00Z", "received_at_utc": "2026-11-20T14:30:02Z",
  "outdoor_temperature_c": 30.0, "indoor_temperature_c": null,
  "outdoor_humidity_pct": 60.0, "indoor_humidity_pct": null,
  "wind_speed_ms": 5.36448, "wind_gust_ms": null,
  "wind_direction_deg": null, "wind_gust_direction_deg": null,
  "daily_rain_mm": 2.54, "hourly_rain_mm": null, "weekly_rain_mm": null,
  "monthly_rain_mm": null, "yearly_rain_mm": null,
  "absolute_pressure_hpa": null, "relative_pressure_hpa": null,
  "uv_index": null, "solar_radiation_wm2": null
}
```

As quatro propriedades obrigatórias no schema são `id` (inteiro da observação), `station_id` (inteiro da estação), `measured_at_utc` (hora do console) e `received_at_utc` (primeira recepção daquela observação no servidor). Os dois horários são strings ISO 8601 em UTC. A tabela de unidades descreve cada sensor. Use o instante da medição nos cartões meteorológicos.

### GET `/api/v1/stations/{station_id}/observations`

Histórico paginado. Query opcional: `start`, `end`, `page`, `page_size` e `order`. O objeto `History` exige `page` (inteiro solicitado), `page_size` (inteiro efetivo) e `items` (array de objetos `ObservationOut` completos, como no exemplo de `latest`). Não há total nem cursor. Período ou paginação inválidos recebem `422`. Exemplo de página vazia para estação existente:

```http
GET /api/v1/stations/1/observations?start=2026-11-20T00:00:00Z&end=2026-11-20T23:59:59.999999Z&page=2&page_size=50&order=asc
```

```json
{"page":2,"page_size":50,"items":[]}
```

Leia mais uma página enquanto `items.length === page_size`. Uma última página cheia exige uma consulta adicional para descobrir o fim. Fixe `start` e `end` entre páginas. A paginação por deslocamento pode mudar se chegarem leituras atrasadas para o período. Use `id` para identificar pontos no gráfico.

### GET `/api/v1/stations/{station_id}/summary`

Query opcional: `start` e `end`. Devolve `Summary` agregado de todo o período. Todas as chaves são obrigatórias. `sample_count` é o número inteiro de observações, incluindo amostras com sensores nulos. Os trios `temperature_min_c`, `temperature_avg_c`, `temperature_max_c` e `humidity_min_pct`, `humidity_avg_pct`, `humidity_max_pct` trazem mínima, média e máxima externas em °C e %. `wind_avg_ms` e `wind_max_ms` usam a velocidade do vento em m/s. Cada estatística é um número ou `null` quando o sensor está ausente em todo o período. A média usa as amostras com valor. `latest` é um objeto `ObservationOut` completo com o recebimento mais recente dentre as medições do período, ou `null`. Período inválido recebe `422`. Use esta chamada para os indicadores do período, inclusive quando o histórico tiver várias páginas.

```http
GET /api/v1/stations/1/summary?start=2026-11-19T00:00:00Z&end=2026-11-19T23:59:59.999999Z
```

```json
{
  "sample_count": 0, "temperature_min_c": null, "temperature_avg_c": null, "temperature_max_c": null,
  "humidity_min_pct": null, "humidity_avg_pct": null, "humidity_max_pct": null,
  "wind_avg_ms": null, "wind_max_ms": null, "latest": null
}
```

### GET `/api/v1/stations/{station_id}/export.csv`

Query opcional: `start` e `end`. O leitor aceita até `MAX_CSV_ROWS` observações (padrão 5.000), além do limite de duração. Ultrapassar qualquer limite recebe `422`. O arquivo contém todas as observações do período em ordem crescente de medição. JSON de sucesso: **Não se aplica**. O navegador pode salvar o corpo `text/csv; charset=utf-8` com o nome de `Content-Disposition: attachment; filename="estacao-1.csv"`, onde `1` é o ID pedido. O arquivo usa vírgula, ponto decimal, quebras CRLF, UTF-8 sem BOM e células vazias para sensores nulos. Os horários são ISO 8601 com offset UTC. Estação existente e período vazio produzem `200` apenas com a primeira linha.

```http
GET /api/v1/stations/1/export.csv?start=2026-11-20T14:30:00Z&end=2026-11-20T14:30:00Z
```

```csv
Estação (ID),Medição (UTC),Recebimento (UTC),Temperatura externa (°C),Temperatura interna (°C),Umidade externa (%),Umidade interna (%),Velocidade do vento (m/s),Rajada (m/s),Direção do vento (°),Direção da rajada (°),Chuva acumulada diária (mm),Chuva acumulada horária (mm),Chuva acumulada semanal (mm),Chuva acumulada mensal (mm),Chuva acumulada anual (mm),Pressão absoluta (hPa),Pressão relativa (hPa),Índice UV (adimensional),Radiação solar (W/m²)
1,2026-11-20T14:30:00+00:00,2026-11-20T14:30:02+00:00,30.0,,60.0,,5.36448,,,,2.54,,,,,,,,
```

# Segurança e limites de acesso

O dashboard usa as seis operações GET da tabela pública. Todas permitem leitura anônima. Nenhuma exige login, cookie, token ou chave de API. Na futura implantação, apenas o leitor deve receber tráfego do túnel. Ele não registra `/data/report/`, o alias sem barra, as sondas internas, a documentação ou operações administrativas. O navegador nunca deve chamar a ingestão. O cadastro local com MAC, o payload bruto, os IPs e os dados de operação ficam fora da interface pública.

Em DEV, o modelo de `CORS_ORIGINS` autoriza `http://localhost:5173`. A origem do Vite precisa coincidir exatamente, inclusive protocolo e porta. O leitor e o processo combinado permitem o método GET no preflight e expõem `Content-Disposition` e `Retry-After` ao JavaScript. O navegador envia `Origin` quando necessário. A ingestão não instala CORS. Na futura produção de mesma origem, a configuração exemplificada é `[]`. Para um dashboard em outra origem, a TI deve cadastrá-la explicitamente. CORS rege a leitura pelo navegador. A proteção da ingestão depende da separação das aplicações e do IP da conexão.

A cota do leitor opera em janelas fixas de um minuto por processo, com padrões de 120 requisições por cliente e 1.200 no total. Consultas que acertam o cache também consomem cota. O IP observado depende da configuração do proxy confiável. Visitantes podem compartilhar a mesma cota quando o proxy mascara sua origem. A configuração de execução usa um worker. Uma query inteira acima de `MAX_QUERY_BYTES` (8.192 bytes por padrão) é rejeitada antes de consultar o banco.

## Respostas de erro

No leitor, erros da aplicação usam `application/json` com uma única propriedade obrigatória `detail` do tipo string. Exemplo: `{"detail":"Estação desconhecida"}`. A tabela indica quais erros podem ocorrer em cada operação. Respostas de rede e do proxy podem ter outro formato.

| HTTP e `detail` do leitor | Quando ocorre | Tratamento no dashboard |
|---|---|---|
| 404 · `Estação desconhecida` | O ID é válido, mas a estação não existe | Atualizar a lista e permitir nova seleção |
| 404 · `Estação sem observações` | `latest` de uma estação cadastrada sem medições | Mostrar “aguardando primeira medição” |
| 422 · `Parâmetros de consulta inválidos` | Falha de tipo, faixa declarada, fuso ausente ou enum inválido (também em parâmetro de caminho) | Corrigir a entrada e preservar os filtros para edição |
| 422 · `start deve anteceder end`, `Reduza o período consultado` ou `Instante fora do intervalo suportado` | Ordem, duração ou cálculo dos limites UTC inválido | Ajustar as datas antes de repetir |
| 422 · `Página excede o limite` ou `Paginação excede o limite` | Tamanho acima do teto na lista ou no histórico, ou deslocamento excessivo no histórico | Reduzir o tamanho ou ajustar a página |
| 422 · `Reduza o período para exportar menos linhas` | O período do CSV contém registros demais | Dividir a exportação em intervalos menores |
| 414 · `Query excede o limite` | URL com query acima do limite | Enviar apenas os filtros necessários |
| 429 · `Limite de requisições atingido` | Cota por cliente ou cota total atingida | Ler `Retry-After` (atualmente `60` segundos) e reagendar |
| 503 · `Banco de dados indisponível` | Falha do SQLAlchemy ao acessar o banco | Manter o último valor com sua hora e tentar depois |
| 500 · `Falha interna no serviço` | Exceção inesperada no leitor | Mostrar indisponibilidade, espaçar tentativas e registrar recorrência |
| 404 · `Not Found` / 405 · `Method Not Allowed` | Caminho ausente / método incompatível | Verificar a base URL, a rota e o método |

No ambiente combinado, uma falha de validação declarativa devolve `422` com `detail` como **array**, por exemplo `{"detail":[{"type":"int_parsing","loc":["path","station_id"],"msg":"Input should be a valid integer, unable to parse string as an integer","input":"abc"}]}`. Cada item tem `type` e `msg` (texto), `loc` (lista de nomes ou índices) e pode incluir `input` e `ctx`. Já os limites validados pelo próprio código produzem `detail` textual, inclusive em DEV. As falhas de SQLAlchemy recebem `503` em todos os serviços. O tratamento genérico JSON de `500` é específico do leitor. Restrição de origem da ingestão gera `403`. Para requisições públicas, autenticação e `401`: **Não se aplica**.

Um preflight OPTIONS com origem, método ou cabeçalhos rejeitados pode receber `400` em texto do middleware. O navegador também pode impedir a leitura de uma resposta sem permissão CORS. Se `fetch` rejeitar sem `Response`, trate como falha de conexão ou de origem, separadamente de um erro JSON lido da API.

# Guia de integração com React + TypeScript

Use o mesmo contrato em DEV e PROD. Em DEV, inicie `python -m app.serve ingest` e `python -m app.serve public` com a `.venv` ativa em terminais separados. Com o perfil DEV instalado, `python scripts/simulate_station.py --samples 2 --interval 2` fornece dados sem equipamento físico. Aponte o Vite para o **leitor**, na porta 8080 por padrão.

### Tipos de resposta

Estes tipos descrevem o JSON efetivamente emitido. Datas permanecem strings durante o transporte. As propriedades de sensores aceitam `?` para também respeitar o schema OpenAPI, que admite sua omissão.

```ts
type UTCString = string

interface PublicStation {
  id: number
  name: string
  model: string
  is_simulated: boolean
  last_seen_at: UTCString
  communication: "online" | "delayed" | "offline"
  seconds_since_contact: number
  last_measured_at_utc: UTCString | null
  seconds_since_measurement: number | null
}

interface ObservationOut {
  id: number
  station_id: number
  measured_at_utc: UTCString
  received_at_utc: UTCString
  outdoor_temperature_c?: number | null
  indoor_temperature_c?: number | null
  outdoor_humidity_pct?: number | null
  indoor_humidity_pct?: number | null
  wind_speed_ms?: number | null
  wind_gust_ms?: number | null
  wind_direction_deg?: number | null
  wind_gust_direction_deg?: number | null
  daily_rain_mm?: number | null
  hourly_rain_mm?: number | null
  weekly_rain_mm?: number | null
  monthly_rain_mm?: number | null
  yearly_rain_mm?: number | null
  absolute_pressure_hpa?: number | null
  relative_pressure_hpa?: number | null
  uv_index?: number | null
  solar_radiation_wm2?: number | null
}

interface ObservationPage {
  page: number
  page_size: number
  items: ObservationOut[]
}

interface Summary {
  sample_count: number
  temperature_min_c: number | null
  temperature_avg_c: number | null
  temperature_max_c: number | null
  humidity_min_pct: number | null
  humidity_avg_pct: number | null
  humidity_max_pct: number | null
  wind_avg_ms: number | null
  wind_max_ms: number | null
  latest: ObservationOut | null
}

interface PublicError { detail: string }
```

### Base URL, HTTP e filtros

No `.env.local` do **futuro frontend** pode-se definir `VITE_API_BASE_URL=http://127.0.0.1:8080/api/v1`. Em produção na mesma origem, use `/api/v1`. Se a TI escolher outra origem, use a URL HTTPS completa e configure o CORS no backend. Variáveis `VITE_*` são públicas. Os blocos TypeScript desta seção podem ser usados juntos em um módulo do cliente.

```ts
const base = (import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "http://127.0.0.1:8080/api/v1" : "/api/v1")).replace(/\/$/, "")

class ApiHttpError extends Error {
  readonly status: number
  readonly retryAfter: number | null

  constructor(status: number, message: string, retryAfter: number | null) {
    super(message)
    this.status = status
    this.retryAfter = retryAfter
  }
}

async function request(path: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(base + path, { signal })
  if (response.ok) return response
  const body = await response.json().catch(() => null)
  const retry = response.headers.get("Retry-After")
  throw new ApiHttpError(response.status,
    typeof body?.detail === "string" ? body.detail : "Falha HTTP " + response.status,
    retry !== null && /^\d+$/.test(retry) ? Number(retry) : null)
}

async function json<T>(path: string, signal?: AbortSignal): Promise<T> {
  return (await request(path, signal)).json() as Promise<T>
}

const stations = (page = 1, pageSize = 50, signal?: AbortSignal) =>
  json<PublicStation[]>("/stations?" + new URLSearchParams({
    page: String(page), page_size: String(pageSize)
  }), signal)
const station = (id: number, signal?: AbortSignal) =>
  json<PublicStation>("/stations/" + id, signal)
const latest = (id: number, signal?: AbortSignal) =>
  json<ObservationOut>("/stations/" + id + "/latest", signal)

interface Period { start?: string; end?: string }
function dates(period: Period): URLSearchParams {
  const query = new URLSearchParams()
  if (period.start) query.set("start", period.start)
  if (period.end) query.set("end", period.end)
  return query
}

function historyPage(id: number, period: Period, page = 1, pageSize = 50,
                     order: "asc" | "desc" = "asc", signal?: AbortSignal) {
  const query = dates(period)
  query.set("page", String(page))
  query.set("page_size", String(pageSize))
  query.set("order", order)
  return json<ObservationPage>("/stations/" + id + "/observations?" + query, signal)
}

const summary = (id: number, period: Period, signal?: AbortSignal) =>
  json<Summary>("/stations/" + id + "/summary?" + dates(period), signal)
```

Exemplo de leitura de um dia de Recife. No React, passe um `AbortSignal` e cancele requisições ao trocar de estação ou desmontar o componente. O exemplo busca apenas a primeira página. A interface pode usar `nextPage` quando o usuário pedir mais dados.

```ts
async function loadDay(signal: AbortSignal) {
  const available = await stations(1, 50, signal)
  if (available.length === 0) return { available }
  const id = available[0].id
  const day = { start: "2026-11-20T00:00:00-03:00", end: "2026-11-20T23:59:59.999999-03:00" }
  const [status, totals, readings] = await Promise.all([
    station(id, signal), summary(id, day, signal), historyPage(id, day, 1, 50, "asc", signal)
  ])
  const last = await latest(id, signal).catch((error: unknown) => {
    if (error instanceof ApiHttpError && error.status === 404 &&
        error.message === "Estação sem observações") return null
    throw error
  })
  const nextPage = readings.items.length === readings.page_size ? readings.page + 1 : null
  return { available, status, totals, readings, last, nextPage }
}
```

### Download pelo navegador

Dispare o download a partir de uma ação do usuário. O exemplo usa o nome declarado pelo servidor e um nome alternativo baseado no ID. O mesmo tratamento de `422` ou `429` ocorre antes de criar o arquivo.

```ts
async function downloadCsv(id: number, period: Period, signal?: AbortSignal) {
  const response = await request("/stations/" + id + "/export.csv?" + dates(period), signal)
  const blobUrl = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  const disposition = response.headers.get("Content-Disposition") ?? ""
  link.download = /filename="(estacao-\d+\.csv)"/.exec(disposition)?.[1] ?? "estacao-" + id + ".csv"
  link.href = blobUrl
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}
```

### Atualização, cache e horário de apresentação

Para uma estação que transmite a cada 60 segundos, comece consultando o detalhe e `latest` uma vez por minuto. Atualize resumo e histórico quando mudarem a estação ou os filtros. Em uma visão diária contínua, atualize o resumo a cada cinco minutos. Pause as consultas de abas ocultas e compartilhe a resposta entre componentes que exibem a mesma estação.

O cache do leitor é em memória, por processo, com até 32 entradas. Os TTLs padrão são 60 s para `latest` (`CACHE_TTL_SECONDS`), 60 s para histórico (`HISTORY_CACHE_TTL_SECONDS`) e 300 s para resumo (`SUMMARY_CACHE_TTL_SECONDS`). Zero desativa o respectivo cache. A chave inclui a versão baseada no maior ID de observação do banco. Uma nova inserção, mesmo de medição antiga, muda a versão. Lista, detalhe, monitor, CSV e ingestão ficam fora do cache. O middleware público marca as respostas processadas com `Cache-Control: no-store`.

Agende a próxima busca depois que a atual terminar. Em `429`, respeite `Retry-After`. Em `503`, `500` ou falha de rede, mantenha a última medição visível com seu horário, sinalize a falha de atualização e aumente o intervalo entre tentativas (por exemplo, 1, 2 e 4 minutos com pequena variação aleatória). Retome o intervalo habitual após sucesso. Uma falha ao buscar a API, por si só, não determina o estado `offline` da estação.

Use `communication` para mostrar o contato com a estação e `measured_at_utc` da leitura apresentada para indicar a idade daquele dado. `last_measured_at_utc` pode ser mais recente que a medição retornada por `latest`. Para mostrar hora local com a data correta:

```ts
const recife = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Recife", dateStyle: "short", timeStyle: "medium"
})
// recife.format(new Date(observacao.measured_at_utc))
```

### Conferir o contrato na máquina de desenvolvimento

O Swagger combinado está em `http://127.0.0.1:8000/docs` e sua especificação está em `/openapi.json`. Nessa instância, lista e detalhe de estação usam um cadastro interno que inclui MAC e omite o estado de comunicação. O leitor da porta 8080 entrega os modelos deste guia e mantém Swagger e OpenAPI HTTP desativados. Para gerar seu contrato com a `.venv` ativa, use `python -c "import json; from app.main import create_public_app; print(json.dumps(create_public_app().openapi(), indent=2))"`. Limites dinâmicos, cabeçalhos e erros `414/500` são descritos neste guia e não estão enumerados no schema público.

## Funcionalidades previstas, mas ainda não implementadas

- O dashboard React + TypeScript + Vite será desenvolvido a partir das consultas acima. A atualização disponível hoje é por HTTP periódico. O backend não oferece WebSocket, SSE nem endpoint de totais de páginas.
- A instalação física, a confirmação do intervalo de envio do console, a escolha do domínio/origem e a publicação do túnel dependem da TI do SESC. Serviços, backup e modelos de configuração já existem no repositório. Para desenvolver o cliente, bastam o simulador e o leitor locais.
### Indicadores da página Histórico

O painel usa os agregados de temperatura, umidade e vento de `GET /api/v1/stations/{station_id}/summary`. Para contar leituras válidas por sensor e calcular rajada máxima, pressões e radiação, percorre `observations` com os mesmos limites inclusivos e estação. A resposta só é usada após a última página e a conferência dos IDs únicos com `sample_count`. Zeros contam como leituras. Nulos são excluídos das médias aritméticas e dos extremos. Em caso de empate na radiação máxima, aparece a primeira medição do pico em horário de Recife.

O custo da contagem cresce com o número de páginas. Para eliminar essa varredura, uma evolução do endpoint existente `GET /api/v1/stations/{station_id}/summary?start=…&end=…` poderia acrescentar as chaves abaixo. Exemplo de extensão proposta para um período vazio:

```json
{
  "valid_counts": {
    "outdoor_temperature_c": 0, "outdoor_humidity_pct": 0, "wind_speed_ms": 0,
    "daily_rain_mm": 0, "relative_pressure_hpa": 0, "absolute_pressure_hpa": 0,
    "solar_radiation_wm2": 0
  },
  "wind_gust_max_ms": null,
  "relative_pressure_hpa": { "min": null, "avg": null, "max": null },
  "absolute_pressure_hpa": { "min": null, "avg": null, "max": null },
  "solar_radiation_wm2": { "avg": null, "max": null, "peak_at_utc": null },
  "rain": { "total_mm": null, "max_daily_mm": null, "wet_days": null }
}
```

Cada estatística de chuva exige precipitação atribuível ao intervalo. O backend precisaria de incrementos confiáveis, ou de leituras de fronteira com cobertura e reinicializações conhecidas, além do início do dia pluviométrico da estação. Dias parciais devem considerar apenas a contribuição dentro dos limites. Lacunas ou resets ambíguos devem resultar em `null` para cada estatística afetada. Hoje o painel mostra a contagem de leituras válidas e o último acumulado diário disponível no período, com a data e hora da medição em Recife.
