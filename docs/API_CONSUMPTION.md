# Consumo da API pelo dashboard

A implementação segue o guia `docs/FRONTEND_INTEGRATION.md`, o README do repositório Python, os schemas Pydantic e o OpenAPI gerado por `create_public_app().openapi()`. O OpenAPI público contém seis operações GET. O catálogo e o detalhe do serviço combinado DEV têm um contrato diferente. O cliente valida o modelo público antes de exibir os dados.

## Operações utilizadas

Os caminhos abaixo são relativos a `VITE_API_BASE_URL`, normalmente terminada em `/api/v1`. As requisições usam GET anônimo, sem cookies ou credenciais. Os IDs vêm da lista do servidor.

| Caminho | Consulta enviada | Contrato e consumidores |
| --- | --- | --- |
| `/stations` | `page` a partir de 1 e `page_size=25` | Array de `PublicStation`. Cabeçalho, identificação de origem e seleção da estação. Uma página cheia habilita carregar mais estações. Array vazio indica catálogo vazio. |
| `/stations/{id}` | Sem query | `PublicStation`. Atualização do estado de comunicação e nome no cabeçalho. |
| `/stations/{id}/latest` | Sem query | `ObservationOut` mais recentemente recebida. Temperatura de destaque, indicadores, horário e estado da medição. O 404 textual “Estação sem observações” representa ausência de dados. |
| `/stations/{id}/observations` | `start`, `end`, `page`, `order=desc` | Objeto `{page, page_size, items: ObservationOut[]}`. Gráfico recente, histórico e tabela. O tamanho padrão da API é o menor entre 100 e seu teto. O gráfico ordena os registros da página por medição crescente. |
| `/stations/{id}/summary` | `start`, `end` | `Summary`. Contagem e temperaturas mínima, média e máxima de **todo o intervalo** na página Histórico. |
| `/stations/{id}/export.csv` | Os mesmos `start` e `end` do histórico | Corpo `text/csv` UTF-8. O navegador salva os bytes recebidos como `estacao-{id}.csv`. Cabeçalhos, unidades, ordem, células vazias e horários em UTC são preservados. |

## Campos dos contratos

**PublicStation.** `id`, `name`, `model`, `is_simulated`, `last_seen_at`, `communication`, `seconds_since_contact`, `last_measured_at_utc` e `seconds_since_measurement`. Os dois últimos aceitam null. Os estados de comunicação são `online`, `delayed` e `offline`. A origem simulada informada pelo servidor tem identificação própria na interface.

**ObservationOut.** `id`, `station_id`, `measured_at_utc` e `received_at_utc` são obrigatórios. Datas incluem o fuso. Os sensores abaixo podem ser números, null ou omitidos.

| Grandeza | Campos | Unidade |
| --- | --- | --- |
| Temperatura | `outdoor_temperature_c`, `indoor_temperature_c` | °C |
| Umidade | `outdoor_humidity_pct`, `indoor_humidity_pct` | % |
| Vento | `wind_speed_ms`, `wind_gust_ms` | m/s |
| Direção | `wind_direction_deg`, `wind_gust_direction_deg` | graus |
| Precipitação acumulada | `hourly_rain_mm`, `daily_rain_mm`, `weekly_rain_mm`, `monthly_rain_mm`, `yearly_rain_mm` | mm |
| Pressão | `relative_pressure_hpa`, `absolute_pressure_hpa` | hPa |
| Radiação | `solar_radiation_wm2`, `uv_index` | W/m² e índice adimensional, respectivamente |

**Summary.** `sample_count` é inteiro. As estatísticas `temperature_min_c`, `temperature_avg_c`, `temperature_max_c`, `humidity_min_pct`, `humidity_avg_pct`, `humidity_max_pct`, `wind_avg_ms` e `wind_max_ms` aceitam null. `latest` contém uma observação ou null. O frontend deixa o cálculo dessas estatísticas com o leitor público.

## Período, paginação e falhas

Os extremos do intervalo são inclusivos e filtram a **hora da medição**. O cliente envia ambos via `URLSearchParams`. Intervalos predefinidos são móveis no momento da seleção e ficam fixos entre páginas. Datas personalizadas correspondem a dias civis de Recife, até o último microssegundo do último dia. A apresentação usa `Intl.DateTimeFormat` com `America/Recife`.

Uma página com menos itens que `page_size` encerra o histórico. Quando a última página vem cheia, o servidor pode devolver uma página vazia no avanço seguinte. O botão anterior continua disponível. Uma medição atrasada inserida durante a navegação pode mudar os registros entre páginas. O leitor usa deslocamento e não fornece cursor de snapshot.

O cliente verifica tipos e datas dos objetos, inclusive a diferença entre sensores ausentes e zero. Respostas incompatíveis, erros de rede e falhas de acesso têm feedback visual. O backend usa `detail` textual para erros do leitor. Em 422, o usuário pode ajustar o intervalo. Em 429, o cliente posterga chamadas durante a janela indicada por `Retry-After`. Um erro 503 mantém as medições já recebidas no cache com o horário original. O polling de consultas ativas pausa em abas ocultas.

## Limitações e validação futura

- A API oferece resumo por período e observações paginadas. Uma série horária ou diária agregada ao longo de todo um mês depende de uma futura operação do backend. Hoje o gráfico identifica o intervalo efetivamente representado e a página.
- O índice UV é apresentado sem categoria de risco. Sensação térmica e classificações de conforto dependem de suporte documentado no backend.
- A integração local pode ser exercitada com o simulador oficial ou com uma estação existente no leitor. Validar periodicidade, disponibilidade de sensores e origem HTTPS com a instalação física antes da abertura ao público.
- O limite de datas e os períodos de cache do leitor podem ser ajustados pela TI. O servidor continua responsável pelos limites de linhas, tamanho da página e cotas.
