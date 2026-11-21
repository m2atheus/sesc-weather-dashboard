# Implantação da WS-2000 no SESC

Este procedimento será executado após a validação em DEV e a autorização da TI. Para trabalhar agora no computador pessoal, siga a [instalação DEV](../README.md#instalacao).

A implantação usa o computador existente na instituição, SQLite em disco local e dois serviços Python com um processo Uvicorn cada. O console envia observações mesmo com o leitor, o dashboard ou a internet indisponíveis. Uma interrupção do próprio computador, da LAN ou do disco interrompe a coleta. O preenchimento de lacunas depende da capacidade de reenvio do console.

```text
WS-2000 ── HTTP na LAN ──► ingestão :8001 ── grava ──► SQLite + WAL
                                                        │
                                     API de leitura ◄───┘
Visitante ── HTTPS ──► Cloudflare ── túnel de saída ──► 127.0.0.1:8080
```

## Antes de instalar

- Combine com a TI o computador, a conta de serviço, a reserva DHCP, o firewall, a unidade física de backup e o domínio autorizado. Anote o caminho absoluto do banco existente e a revisão de `alembic current`.
- Desative a suspensão automática enquanto o equipamento estiver ligado à tomada. No Windows, ajuste **Energia e bateria → Tempos limite de tela e suspensão**. Em Linux, confira as políticas de energia e de fechamento da tampa aplicadas à instalação. Sincronize o relógio do servidor e do console. Configure a retomada após falta de energia conforme os recursos do equipamento.
- Use disco local para o banco, `-wal` e `-shm`. Evite SMB, NFS e pastas sincronizadas. Mantenha espaço para crescimento do banco, WAL, migrações e backups. A uma amostra por minuto, uma estação gera cerca de 525.600 linhas por ano. Use o tamanho real após um mês para dimensionar disco e retenção, incluindo índices e payload JSON.
- Confira o SQLite **carregado pelo Python** com `python -c "import sqlite3; print(sqlite3.sqlite_version)"`. Para produção use uma distribuição com a correção de concorrência de checkpoints WAL, por exemplo SQLite 3.51.3 ou posterior, ou um backport confirmado pelo fornecedor. [Nota técnica do SQLite](https://sqlite.org/wal.html#the_wal_reset_bug)

## Transferir a versão testada para o SESC

1. No computador pessoal, rode a suíte e o ensaio com o simulador. Registre o commit ou a tag da versão aprovada. Inclua nessa revisão o código, os scripts de instalação e inicialização, `pyproject.toml`, o diretório Alembic e os modelos de configuração.
2. Na máquina de destino, clone o repositório autorizado e selecione a revisão aprovada com `git switch --detach REVISAO_APROVADA`. Se a entrega for por mídia, gere no computador de desenvolvimento o arquivo `git archive --format=zip --output=ws2000-release.zip REVISAO_APROVADA` e extraia-o no destino. O arquivo contém a revisão registrada no Git. A `.venv`, o `.env` privado, os bancos locais e as credenciais ficam em suas máquinas de origem.
3. Instale Python 3.12+ no destino e confira a versão da biblioteca SQLite. A partir da raiz da cópia, rode o instalador de **produção**. Ele cria um ambiente virtual próprio do sistema operacional do SESC, instala as dependências da aplicação e, na primeira execução, cria o `.env` com o modelo institucional. A escolha da base e a migração vêm depois da revisão da configuração.

| Tarefa de produção | Windows · PowerShell | Linux · Bash |
| --- | --- | --- |
| Instalar dependências no destino | `python scripts/install.py prod` | `python3 scripts/install.py prod` |
| Origem do novo `.env` | [Modelo de produção](../deploy/production.env.example) | Mesmo modelo |

Use um diretório dedicado. Os modelos de serviços mais adiante usam `C:\ws2000` e `/opt/ws2000` como exemplos ajustáveis. A conta de serviço deve ler o código e a configuração e ter acesso aos diretórios de dados e logs. Restrinja escrita nos executáveis, serviços e credenciais à administração.

## Escolher a base e aplicar migrações

- **Primeira instalação sem histórico institucional:** mantenha a URL do novo arquivo local de produção. `alembic upgrade head` cria o banco e o esquema. As amostras simuladas ficam no computador pessoal.
- **Histórico a transferir:** leve separadamente um backup institucional validado com `scripts/backup_sqlite.py --test-restore`. No destino, copie o snapshot fechado para um novo arquivo local, ajuste `DATABASE_URL` para ele e só então aplique as migrações. Confira estações, contagens e última medição antes de iniciar o receptor. O procedimento de restauração completa está na seção de backup abaixo.

Configure a cópia privada de `.env` antes da migração. Para uma instalação existente, mantenha o valor de `DATABASE_URL` apontando para o arquivo original. Uma URL relativa usa o diretório de trabalho do processo. Prefira uma URL absoluta em produção, como `sqlite:///C:/ws2000/data/weather.db` no Windows ou `sqlite:////var/lib/ws2000/weather.db` no Linux. Todos os serviços, o backup e o Alembic devem usar o mesmo arquivo.

```dotenv
APP_ENV=production
INGEST_HOST=127.0.0.1
INGEST_PORT=8001
INGEST_NETWORKS=["127.0.0.1/32"]
PUBLIC_HOST=127.0.0.1
PUBLIC_PORT=8080
TRUSTED_PROXY_IPS=["127.0.0.1"]
CORS_ORIGINS=[]
ALLOW_SIMULATED=false
SQLITE_BUSY_TIMEOUT_MS=15000
BACKUP_DIR=./backups/prod
BACKUP_RETENTION_DAYS=30
```

Os valores de loopback permitem o ensaio inicial. Para a estação física, substitua `INGEST_HOST` pelo IP da interface LAN do **servidor** e acrescente o IP reservado do **console** com máscara `/32` a `INGEST_NETWORKS`. Inclua o próprio endereço do servidor, ou o do equipamento autorizado de monitoramento, para consultar as sondas. Em instalações anteriores, revise listas que liberavam redes privadas inteiras. Configure também `BACKUP_SECONDARY_DIR` com um diretório existente em outro dispositivo.

Com dados anteriores, execute o backup e o ensaio de restauração descritos abaixo antes de migrar. A atualização de `0001_weather` para `0002_time_index` acrescenta um índice de data. As chaves de estação e de idempotência e as linhas existentes são preservadas. Reserve uma janela para a criação do índice em bases grandes.

| Ação | Windows | Linux |
| --- | --- | --- |
| Conferir revisão | `.\.venv\Scripts\python -m alembic current` | `.venv/bin/python -m alembic current` |
| Aplicar migração | `.\.venv\Scripts\python -m alembic upgrade head` | `.venv/bin/python -m alembic upgrade head` |
| Executar ingestão | `.\.venv\Scripts\python -m app.serve ingest` | `.venv/bin/python -m app.serve ingest` |
| Executar leitura | `.\.venv\Scripts\python -m app.serve public` | `.venv/bin/python -m app.serve public` |

Para validação manual, use um terminal por serviço. A fábrica do leitor registra somente consultas meteorológicas e abre o arquivo SQLite com `mode=ro` e `query_only`. A ingestão continua usando a transação original e confirma após o commit. Cada conexão ativa chaves estrangeiras e espera até o `busy_timeout` em disputas de lock. O escritor e a migração ativam WAL. O leitor aguarda o banco migrado em WAL e responde 503 enquanto estiver indisponível.

## Primeira transmissão e diagnóstico de rede

1. Descubra a interface do servidor com `ipconfig` ou `ip -br addr`. Peça à TI a reserva DHCP dos endereços do servidor e do console ou endereços estáticos gerenciados. Confirme a comunicação entre VLANs e a política de isolamento de clientes Wi-Fi.
2. Restrinja a entrada TCP 8001 à estação e às origens de monitoramento autorizadas. No Windows, em **Firewall do Windows com Segurança Avançada**, crie a regra de entrada no perfil institucional correto e use o escopo de endereços remotos. Em Linux com UFW, a forma é `sudo ufw allow from <IP_DO_CONSOLE> to <IP_LAN_DO_SERVIDOR> port 8001 proto tcp`; substitua os marcadores antes da execução. Mantenha 8080 em loopback e deixe o roteador sem redirecionamentos de entrada.
3. No console, abra **Setup → Weather Server → Customized**, habilite **Same As AMBWeather** e salve o IP LAN do servidor, porta **8001**, intervalo inicial **60 s** e Path **/data/report/**. [Manual do equipamento](https://ambientweather.com/mwdownloads/download/link/id/1113/#page=48)
4. De uma origem autorizada, confira `Test-NetConnection IP_DO_SERVIDOR -Port 8001` ou `curl -i http://IP_DO_SERVIDOR:8001/ready`. Observe ao menos dois intervalos. Uma recepção válida gera `observation_saved` ou `observation_duplicate`. No host, consulte `http://127.0.0.1:8080/api/v1/stations`, use o ID retornado em `/api/v1/stations/{id}/latest` e confira os dois horários UTC.
O ensaio sem o equipamento físico usa o [perfil DEV com simulador](../README.md#simulador), no computador pessoal e com base própria.

| Sintoma | Verificação |
| --- | --- |
| Ausência de requisições | IP/Path do console, energia, LAN e regra do firewall. Confira a escuta com `Get-NetTCPConnection -LocalPort 8001` ou `ss -ltn`. |
| 403 na ingestão | Confira o IP real de origem e `INGEST_NETWORKS`. A ingestão ignora cabeçalhos de proxy. |
| 422 na ingestão | Consulte `ingestion_rejected`, o protocolo selecionado e o relógio UTC. O diagnóstico opcional registra valores métricos; os parâmetros originais ficam em `raw_payload`. |
| `/health` responde e `/ready` devolve 503 | Verifique URL absoluta, revisão Alembic, espaço livre, permissões e disponibilidade do disco. Ao recuperar o banco, repita a sonda. Uma tentativa de ingestão que falha não recebe confirmação de sucesso. |
| Estação atrasada | Em `/monitor/stations` no receptor, compare `seconds_since_contact` com `seconds_since_measurement`. Reenvios atualizam o contato. Um relógio adiantado pode produzir idade de medição negativa. Uma lista vazia indica que nenhuma estação foi cadastrada. |
| Túnel indisponível | Consulte o leitor pelo loopback e verifique logs de `cloudflared`, DNS e saída da rede. A ingestão e o histórico local continuam disponíveis. |

<a id="contrato-publico"></a>

## Contrato público para React e TypeScript

Todas as rotas públicas são GET sob `/api/v1/stations`. A lista e o detalhe fornecem ID, nome, modelo, última comunicação, instante da medição mais recente, idades em segundos e `communication`. O estado muda para `delayed` a partir de `STATION_DELAY_SECONDS` (180) e `offline` a partir de `STATION_TIMEOUT_SECONDS` (600). Esses limites medem silêncio da estação, independentemente de chuva e temperatura.

| Recurso | Contrato de produção |
| --- | --- |
| Lista e histórico | `page` começa em 1. `page_size` tem padrão de até 100 e máximo `MAX_PAGE_SIZE` (500). A lista conserva o formato de array, o histórico conserva `page`, `page_size` e `items`. |
| `latest` | Última observação recebida, inclusive quando se trata de leitura atrasada. `last_measured_at_utc` no detalhe da estação indica a medição cronologicamente mais recente. |
| `observations`, `summary`, `export.csv` | Os limites inclusivos `start` e `end` usam o instante medido. Sem filtros, a janela é o dia UTC atual. Com um só limite, a janela se estende até `MAX_PERIOD_DAYS` (31) a partir dele ou retrocede esse intervalo. Períodos maiores recebem 422. Para um dia no Recife, o cliente deve enviar os limites desejados com fuso. |
| CSV | `MAX_CSV_ROWS` (5.000) por arquivo. A API verifica o limite antes de enviar o cabeçalho HTTP. Em 422, reduza o intervalo. |
| Unidade e tempo | Temperatura em °C, vento em m/s, chuva em mm, pressão em hPa, radiação em W/m², umidade em %, direção em graus e UV adimensional. Campos ausentes aparecem como `null`. Os horários JSON são UTC ISO 8601. Use `Intl.DateTimeFormat("pt-BR", {timeZone: "America/Recife", timeStyle: "medium"})` para apresentação. |
| Erros | `detail` no JSON da aplicação. 404 para recurso ausente, 422 para parâmetros ou limites, 429 com `Retry-After` para excesso de solicitações e 503 para indisponibilidade. O servidor HTTP ou a borda também podem responder sob sobrecarga. |

O leitor usa um único processo com cache limitado a 32 entradas. Os TTLs padrão são 60 s para a última leitura, 300 s para resumo e 60 s para histórico. Configure `CACHE_TTL_SECONDS`, `SUMMARY_CACHE_TTL_SECONDS` e `HISTORY_CACHE_TTL_SECONDS`; zero desativa a categoria. Antes de reutilizar um resultado, o leitor consulta o maior ID de observação pelo índice primário. Um novo commit em qualquer estação muda a chave do cache, inclusive para entregas atrasadas. O contato da estação é consultado diretamente. Reinicie o leitor durante restaurações ou manutenções externas. O limite por minuto é 120 requisições por cliente e 1.200 no total, ajustável por `PUBLIC_REQUESTS_PER_MINUTE` e `PUBLIC_TOTAL_PER_MINUTE`.

Para explorar a API local de desenvolvimento, use `APP_ENV=development` e `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-proxy-headers`. Abra `/docs`. Para gerar **o contrato exato do leitor** sem expor Swagger ou OpenAPI, rode na raiz:

```bash
python -c "from pathlib import Path; import json; from app.main import create_public_app; Path('public-openapi.json').write_text(json.dumps(create_public_app().openapi(), ensure_ascii=False, indent=2), encoding='utf-8')"
```

O frontend poderá chamar `fetch("/api/v1/stations")` na mesma origem. Ao publicar futuramente o build estático, acrescente uma regra para o mesmo hostname apontando os demais caminhos ao servidor local de arquivos, **depois** da regra da API e antes da resposta final 404. Restrinja o diretório servido aos arquivos do build. Para origens diferentes, liste apenas os endereços do dashboard em `CORS_ORIGINS`. CORS controla navegadores; qualquer pessoa com acesso ao endereço público pode ler os dados meteorológicos.

## Inicialização automática e logs

**Linux com systemd.** Prepare uma conta de serviço `ws2000` e os diretórios locais com as permissões adequadas. Os exemplos leem o `.env` pelo diretório de trabalho. Depois de conferir os caminhos e a conta, a TI pode instalar as unidades:

```bash
sudo install -m 0644 deploy/systemd/ws2000* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ws2000@ingest ws2000@public ws2000-backup.timer
systemctl status ws2000@ingest ws2000@public
systemctl list-timers ws2000-backup.timer
journalctl -u ws2000@ingest -u ws2000@public -u ws2000-backup --since today
```

Configure o journal com armazenamento persistente e limite de disco segundo a política local. As unidades usam reinício automático e encerramento gracioso. O timer executa às 02:15 no fuso do host e recupera execuções perdidas com `Persistent=true`. Para mudar o horário, edite o timer com `systemctl edit ws2000-backup.timer`, sob `[Timer]` limpe o valor anterior com `OnCalendar=`, adicione `OnCalendar=*-*-* 03:30:00` (exemplo) e reinicie o timer. [Arquivos systemd](../deploy/systemd/)

**Windows.** Use dois serviços gerenciados pelo Service Control Manager. O exemplo usa WinSW 2.x. Instale a distribuição aprovada pela TI em uma pasta administrativa, faça duas cópias do executável com os nomes `ws2000-ingest.exe` e `ws2000-public.exe` e prepare um XML com o mesmo nome-base de cada executável. No segundo XML, mude `id`, nome, descrição e argumento para `-m app.serve public`. Ajuste os caminhos nos dois arquivos, crie a pasta de logs e conceda acesso à conta de serviço. [Modelo XML](../deploy/windows/ws2000-service.example.xml) · [Documentação do WinSW 2.x](https://github.com/winsw/winsw/blob/v2/doc/xmlConfigFile.md)

```powershell
.\ws2000-ingest.exe install
.\ws2000-public.exe install
# Antes de iniciar, configure a conta de logon de cada serviço em services.msc.
Start-Service ws2000-ingest,ws2000-public
Get-Service ws2000-ingest,ws2000-public
```

O modelo define início automático, recuperação após falha, tempo de parada e rotação de stdout/stderr. Configure uma conta com privilégios mínimos e direito de logon como serviço, inclusive após reinício e sem login interativo. O nível de detalhe dos processos é ajustável em `LOG_LEVEL`.

No **Agendador de Tarefas**, crie a tarefa diária de backup com a mesma configuração de diretório do serviço. Use o horário aprovado (por exemplo, 02:15 local), **Executar independentemente de o usuário estar conectado**, **Executar assim que possível após perder o início agendado**, reinício em caso de falha e apenas uma instância simultânea.

| Campo da ação Windows | Exemplo |
| --- | --- |
| Programa | `C:\ws2000\.venv\Scripts\python.exe` |
| Argumentos | `scripts/backup_sqlite.py --log-file logs/backup.log` |
| Iniciar em | `C:\ws2000` |

Execute a tarefa manualmente uma vez. Confira o código de retorno zero, log e réplica no segundo dispositivo. Em ambos os sistemas, reinicie o computador em uma janela autorizada e confirme os processos, `/ready`, o avanço de `last_seen_at` após dois intervalos, a consulta pública e o próximo backup.

## Backup, restauração e atualização

A API de backup do SQLite captura páginas comprometidas, inclusive do WAL, em lotes. O comando gera um arquivo fechado e autônomo, verifica integridade, chaves estrangeiras e esquema e só então publica o nome com timestamp UTC. `BACKUP_RETENTION_DAYS` controla a remoção de backups vencidos com o padrão de nomes do projeto. Use um diretório dedicado para cada banco. [API oficial de backup SQLite](https://sqlite.org/backup.html)

1. Configure `BACKUP_DIR`, `BACKUP_RETENTION_DAYS=30` e **uma segunda unidade física** com `BACKUP_SECONDARY_DIR` (por exemplo, uma pasta provisionada pela TI em outro disco). Confirme o dispositivo e a montagem, espaço e permissões da conta de serviço. No Linux mantenha a pasta de destino dentro do volume montado, ausente quando desmontado. Uma segunda pasta no disco do banco também se perde se esse disco falhar.
2. Execute o comando abaixo com o Python do ambiente. Ele registra `backup_saved` e, quando configurada, `backup_replicated`. Uma falha retorna código diferente de zero e gera `backup_failed`. Se a réplica falhar, o snapshot local já publicado permanece disponível. Monitore a idade da última cópia **nos dois destinos**.
3. Faça o ensaio de restauração a partir de um backup, preferencialmente a réplica externa. O comando reconstitui uma base temporária, executa `integrity_check` e `foreign_key_check` e compara as contagens. Repita periodicamente e antes de atualizar.

```powershell
.\.venv\Scripts\python scripts/backup_sqlite.py
$ultimo = Get-ChildItem C:\ws2000\backups\prod\ws2000-*.sqlite3 | Sort-Object Name -Descending | Select-Object -First 1
.\.venv\Scripts\python scripts/backup_sqlite.py --test-restore $ultimo.FullName
```

```bash
.venv/bin/python scripts/backup_sqlite.py
.venv/bin/python scripts/backup_sqlite.py --test-restore /caminho/do/backup/ws2000-ARQUIVO.sqlite3
```

**Restaurar em produção.** Identifique o último backup íntegro e a data até a qual ele contém dados. Combine a janela com a TI, pare os dois serviços e suspenda o agendamento. Preserve a base atual e seus arquivos auxiliares para investigação. Copie o backup validado para **um novo nome de banco em disco local** (por exemplo, `weather-restaurado.db`, sem arquivos WAL/SHM preexistentes desse nome). Aponte `DATABASE_URL` para essa cópia, aplique `alembic upgrade head` e confira `alembic current`. Reinicie a ingestão, o leitor e o agendamento. Compare contagens, horários e uma amostra do histórico e confirme a próxima leitura e backup. Um backup diário pode perder até o intervalo transcorrido desde a última cópia válida.

**Atualizar o software.** Registre a versão, revisão e caminho da base. Teste o backup, pare os serviços, preserve o `.env`, instale a versão nova com suas dependências e migre o mesmo arquivo. Reinicie e confira os critérios acima. Guarde a versão anterior e o backup. Para recuar depois de receber novas observações, primeiro preserve o banco atualizado e reconcilie essas leituras.

## Túnel permanente e domínio

Aplique esta etapa **no SESC, com autorização da TI para o hostname, DNS e serviço do sistema**. O túnel nomeado faz conexão de saída. Aponte somente `/api/v1/` para `http://127.0.0.1:8080`. O servidor da estação continua ligado à LAN na porta 8001. Uma falha do túnel afeta o acesso externo.

1. Instale `cloudflared` do canal oficial da plataforma. No Windows use o executável oficial no PATH ou o caminho completo. No Linux use o repositório oficial para a distribuição. Confira `cloudflared --version` e a conectividade de saída exigida pela Cloudflare (incluindo porta 7844). Use um domínio/subdomínio administrado pela instituição na zona autorizada. [Instalação e túnel localmente gerenciado](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)
2. Autentique o operador, crie o túnel e copie o exemplo para o `config.yml` privado. Preencha UUID, hostname e caminho absoluto do JSON de credenciais da máquina. Restrinja permissões do JSON e do certificado de gestão `cert.pem`. Armazene ambos fora do repositório. [Exemplo de configuração](../deploy/cloudflared.example.yml)
3. Valide regras localmente, verifique os resultados esperados e só então crie o registro DNS e inicie o túnel. Os comandos abaixo usam o diretório padrão do usuário para o arquivo de configuração e um hostname ilustrativo.

```text
cloudflared tunnel login
cloudflared tunnel create ws2000-sesc
# Preencher config.yml antes dos comandos abaixo
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://clima.example.org/api/v1/stations
cloudflared tunnel ingress rule https://clima.example.org/data/report/
cloudflared tunnel route dns ws2000-sesc clima.example.org
cloudflared tunnel run ws2000-sesc
```

A primeira URL deve selecionar 8080; a segunda deve selecionar `http_status:404`. O próprio leitor também devolve 404 para ingestão, sondas e documentação. No Uvicorn, somente o leitor processa cabeçalhos encaminhados, confiando nos endereços TCP enumerados em `TRUSTED_PROXY_IPS`. Reserve o loopback para processos locais confiáveis. Configure a cadeia de proxies para preservar o endereço real do visitante; caso contrário vários visitantes podem compartilhar a mesma cota. [Regras de ingress e validação](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)

No Linux, após os testes, coloque configuração e credenciais no diretório protegido previsto pela TI. Instale com `sudo cloudflared --config /etc/cloudflared/config.yml service install` e confira `systemctl status cloudflared`. No Windows, instale com `cloudflared.exe service install`, prepare a configuração para a conta de serviço e confira o caminho do executável/configuração e o estado em `Get-Service cloudflared`. Depois do reboot, verifique a URL HTTPS a partir de outra rede e as sondas apenas na LAN. [Serviço Linux](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/linux/) · [Serviço Windows](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/as-a-service/windows/)
