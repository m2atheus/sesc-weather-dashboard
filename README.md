<div align="center">

  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/estacao-meteorologica.png" width="110">
    <img src="docs/imagens/parceria-ufrpe-uast-sesc.png" alt="Estação Meteorológica — parceria SESC e UFRPE/UAST" width="300">
  </picture>

  <h1>Estação Meteorológica | SESC e UFRPE/UAST</h1>

  <p><strong>O tempo na estação, medição por medição.</strong></p>
  <p>Consulte temperatura, chuva, vento e outros dados do local. Veja quando cada leitura foi feita e como as condições mudaram ao longo do dia.</p>

  <p>
    <a href="#validacao"><img src="https://img.shields.io/badge/verifica%C3%A7%C3%A3o-testes%20locais-335e46" alt="Como testar o painel no computador"></a>
    <a href="#licenca"><img src="https://img.shields.io/badge/licen%C3%A7a-n%C3%A3o%20definida-lightgrey" alt="Licença do projeto ainda não definida"></a>
    <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-painel-176483" alt="Painel web feito com React"></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-consulta-176b54" alt="Serviço de consulta feito com FastAPI"></a>
    <a href="https://sqlite.org/"><img src="https://img.shields.io/badge/SQLite-medi%C3%A7%C3%B5es-416785" alt="Medições guardadas em SQLite"></a>
  </p>

  <p>
    <a href="#instalacao">Começar agora</a> ·
    <a href="#regras-de-negocio">Como interpretar os dados</a> ·
    <a href="docs/FRONTEND_INTEGRATION.md">Guia de integração</a>
  </p>

</div>

## O problema

Se o painel mostra **28 °C**, como saber se essa temperatura é de agora ou de ontem? A estação pode passar algumas horas sem transmitir e o computador ainda guardar a última medição. Para interpretar o número, é preciso conhecer a hora da leitura.

A chuva também pede atenção. Se a estação mostra **4 mm** às 10h e continua mostrando **4 mm** às 11h, o acumulado do dia continua em 4 mm. Somar as duas leituras contaria a mesma chuva duas vezes.

<a id="solucao"></a>

## A solução

O painel mostra **o que a estação mediu, quando mediu e quais registros estão disponíveis**. Na aba **Visão geral**, comece pela temperatura e pela hora logo abaixo dela. Para comparar dias ou baixar os dados em uma planilha, abra **Histórico**. A aba **Sobre** apresenta o equipamento e as instituições do projeto.

| Frente | Responsabilidade | Tecnologias |
| --- | --- | --- |
| **Estação** | Os sensores medem as condições no local. O console, o aparelho que reúne essas leituras, envia os registros ao computador. | Ambient Weather WS-2000 |
| **Coleta e consulta** | Um programa recebe e guarda as medições. Outro, chamado **leitor público** ou **API**, entrega os registros quando o painel pede. | Python, FastAPI e SQLite, que guarda os dados em um arquivo |
| **Painel** | Organiza as leituras em cartões, gráficos e tabelas que você abre pelo navegador. | React, TypeScript, Vite, Tailwind CSS e Recharts |

**Onde estão os arquivos?** Esta pasta, `sesc-weather-dashboard`, contém o painel. A coleta, o leitor público e o banco de medições pertencem ao projeto separado `projeto-sesc-API`.

```text
src/pages/        As três telas que você visita
src/components/   Cartões, gráficos, menus e avisos
src/data/         Consultas ao leitor e dados de demonstração
src/utils/        Apresentação dos números, datas e horários
public/           Símbolo da estação e imagens do painel
docs/             Guias de integração e de instalação no SESC
tests/            Verificações automáticas do funcionamento
```

## Sumário

- [O problema](#o-problema)
- [A solução](#solucao)
- [Instalação](#instalacao)
  - [Pré-requisitos](#pré-requisitos)
  - [API de leitura](#api-de-leitura)
  - [Painel meteorológico](#painel-meteorológico)
  - [Acesso pelo celular](#aplicativo-movel)
  - [Validação e documentação](#validacao)
- [Funcionalidades e regras de negócio](#regras-de-negocio)
- [Contribuidores e licença](#contribuidores-licenca)

<a id="instalacao"></a>

## Instalação

**Se você recebeu um link da equipe**, basta abri-lo no navegador. A instalação abaixo é para quem vai preparar o painel no próprio computador. O projeto está em fase de testes locais. Para conhecer as telas **sem estação e sem banco de dados**, vá direto a [Painel meteorológico](#painel-meteorológico) e use a demonstração.

### Pré-requisitos

- **Para abrir um painel já instalado:** um navegador, como Chrome, Edge ou Firefox.
- **Para instalar o painel no computador:** a pasta `sesc-weather-dashboard` e o **Node.js 22.16 ou superior**, que já inclui o **npm**, a ferramenta que instala as peças usadas pelo painel. [Instalador do Node.js](https://nodejs.org/pt/download)
- **Para consultar os registros da estação:** também é preciso ter a pasta `projeto-sesc-API` e o **Python 3.12 ou superior**. A primeira instalação das ferramentas precisa de internet. [Instalador do Python](https://www.python.org/downloads/)

No Windows, o **PowerShell** é a janela onde você digita os comandos abaixo. Para abri-lo na pasta certa, abra a pasta no Explorador de Arquivos, clique na barra de endereço, escreva `powershell` e pressione **Enter**. Cole uma linha por vez e pressione **Enter** de novo.

```powershell
node --version
npm.cmd --version
```

Cada comando deve mostrar um número de versão. Se aparecer “não é reconhecido”, instale o Node.js e abra **uma nova janela** do PowerShell antes de repetir. Para preparar também o leitor, confira o Python com `python --version`.

### API de leitura

**1. Abra o PowerShell dentro da pasta `projeto-sesc-API`.** Na primeira instalação local, rode:

```powershell
python scripts/install.py dev
```

O instalador prepara o Python e o banco de desenvolvimento nesse computador. Se o leitor já foi instalado, siga para o próximo passo.

**2. Ligue o leitor e deixe essa janela aberta.**

```powershell
.\.venv\Scripts\python.exe -m app.serve public
```

**3. Confira se ele respondeu.** Abra a [lista de estações deste computador](http://127.0.0.1:8080/api/v1/stations). Uma lista com nomes indica que há estações cadastradas. Se aparecer apenas `[]`, o leitor respondeu e o cadastro está vazio. Se o navegador disser que a conexão foi recusada, confira se a janela do passo 2 continua aberta.

**4. Saiba o que está ligado.** Os números no fim dos endereços são **portas**. Neste projeto, cada uma atende um programa diferente:

| Porta | Para que serve |
| --- | --- |
| **5173** | Abre o painel que você vê no navegador. |
| **8080** | Entrega ao painel as medições já guardadas. |
| **8001** | Recebe novas transmissões da estação, quando o serviço de coleta está ligado e o console está configurado. |
| **8000** | Abre a documentação interativa da API, chamada Swagger, quando o serviço de desenvolvimento está ligado. |

Por isso, fechar o programa da porta **8000** pode deixar o leitor da **8080** funcionando. Para parar um serviço iniciado por este guia, volte à janela em que o ligou e pressione **Ctrl+C**. Para receber novas transmissões de um console, a equipe também precisa configurar a coleta. [Guia de implantação no SESC](docs/DEPLOY_SESC.md)

<details>
<summary>Alternativa para Linux/macOS</summary>

Na pasta `projeto-sesc-API`, prepare o leitor e inicie a consulta pública:

```bash
python3 scripts/install.py dev
bash scripts/start.sh public
```

Em um segundo terminal, na pasta `sesc-weather-dashboard`, prepare e inicie o painel:

```bash
npm ci
test -f .env.local || cp .env.example .env.local
npm run dev -- --port 5173 --strictPort
```

Abra o [painel local](http://localhost:5173). Mantenha os dois terminais abertos durante a consulta.

</details>

### Painel meteorológico

Abra **outra janela** do PowerShell, desta vez dentro da pasta **`sesc-weather-dashboard`**.

```powershell
npm.cmd ci
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
npm.cmd run dev -- --port 5173 --strictPort
```

A primeira linha instala as peças do painel. A segunda prepara as configurações de teste na primeira execução e preserva as escolhas que já estiverem salvas. A terceira liga o painel. Nas próximas vezes, basta executar a terceira linha. Abra o [painel no navegador deste computador](http://localhost:5173).

**Primeira visita:** clique na linha de estado da estação, logo abaixo do menu verde. Ali você encontra a fonte dos dados e os detalhes da última comunicação. Para explorar as telas sem equipamento, escolha **Abrir demonstração**. A indicação **Demonstração** aparece na barra. Para consultar o leitor de novo, abra os detalhes e escolha **Voltar à API**.

<details>
<summary>Configurações para quem prepara o computador</summary>

O arquivo `.env.local` guarda escolhas locais. Após editar, pare o painel com **Ctrl+C** e ligue-o novamente. Os valores com o prefixo `VITE_` chegam ao navegador e são públicos.

| Configuração | Valor inicial ou finalidade |
| --- | --- |
| `VITE_API_BASE_URL` | Nos testes, `http://127.0.0.1:8080/api/v1`. Na publicação prevista, `/api/v1` no endereço do próprio painel. |
| `VITE_OBSERVATORY_NAME` | Nome mostrado no cabeçalho, no rodapé e na aba do navegador. |
| `VITE_DEMO_MODE` | `false`. Use `true` para abrir diretamente a demonstração durante o desenvolvimento. |
| `VITE_POLL_SECONDS` | `60`. Intervalo, em segundos, entre consultas de atualização das medições com a aba visível. |
| `VITE_STALE_SECONDS` | `180`. Idade, em segundos, a partir da qual o painel destaca a leitura como antiga. |
| `VITE_MAX_PERIOD_DAYS` | `31`. Maior intervalo de consulta em dias. Deve acompanhar o limite configurado no leitor. |

O leitor de desenvolvimento autoriza por padrão o painel em `http://localhost:5173`. Se mudar o endereço ou a porta do painel, ajuste também a lista de endereços permitidos no leitor (`CORS_ORIGINS`). Na publicação, a equipe de TI deve definir a base `/api/v1` antes de gerar os arquivos finais e encaminhar as consultas desse caminho ao leitor.

</details>

<a id="aplicativo-movel"></a>

### Acesso pelo celular

O painel se adapta à tela do celular. Quando a equipe disponibilizar um endereço para visitas, abra **esse link no navegador do aparelho**. Toque na linha da estação para ver os detalhes e em **Explorar histórico completo** para escolher um período.

Nos testes locais, `localhost` significa **o aparelho que está abrindo a página**. Digitar `localhost:5173` no celular faz o telefone procurar o painel no próprio telefone. Para testar pelo celular, peça à equipe um endereço de rede que permita acessar tanto o painel quanto o leitor.

<a id="validacao"></a>

### Validação e documentação

**Para conferir pela tela**, abra a demonstração, observe a temperatura e a hora da leitura, entre em **Histórico** e alterne entre gráfico e tabela. O botão de lua ou sol no cabeçalho muda o tema. O navegador guarda essa preferência para a próxima visita.

**Para conferir os arquivos do projeto**, abra o PowerShell na pasta do painel e execute:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

O primeiro comando verifica exemplos de funcionamento, inclusive falhas de conexão. O segundo confere o código e gera a pasta `dist`, que contém o painel pronto para publicação. O terceiro abre uma prévia dessa versão no endereço indicado no terminal, normalmente `http://localhost:4173`. Para consultar a API nessa prévia, o leitor precisa autorizar esse endereço. A demonstração local fica disponível na versão de desenvolvimento.

| Assunto | Referência |
| --- | --- |
| Que informações o painel pede ao leitor | [Consumo da API](docs/API_CONSUMPTION.md) |
| Formato das respostas, unidades e limites | [Guia de integração do painel](docs/FRONTEND_INTEGRATION.md) |
| Preparação do computador, da rede e da coleta no SESC | [Guia de implantação](docs/DEPLOY_SESC.md) |
| Configurações de exemplo para o painel | [Arquivo de exemplo](.env.example) |

<a id="regras-de-negocio"></a>

## Funcionalidades e regras de negócio

| Regra | O que significa para quem usa |
| --- | --- |
| **Hora da leitura** | “Última leitura há 3 dias” informa a idade da medição. Pressionar **Atualizar** pede os registros disponíveis ao leitor. O horário exibido continua sendo aquele em que a estação mediu, no fuso de Recife. |
| **API e estação** | **API disponível** indica que o painel conseguiu consultar o leitor. **Sem comunicação** indica que a estação deixou de transmitir. Os dois avisos podem aparecer juntos. Se a API cair depois de uma consulta bem-sucedida, o painel pode manter a última leitura na tela, identificada como **Leitura em cache**, ou seja, uma cópia da leitura já recebida. |
| **Zero e sensor sem leitura** | **0 mm** é uma medição de chuva igual a zero. **—** indica que o valor está ausente. A mesma regra vale para temperatura, vento e os demais sensores. |
| **Temperatura** | A máxima e a mínima correspondem ao dia da leitura em Recife. Quando a leitura é antiga, o painel indica a data. A sensação térmica fica com travessão enquanto o equipamento não fornecer esse dado ao painel. |
| **Chuva e outras medidas** | A chuva é mostrada em milímetros (mm), a temperatura em graus Celsius (°C), a umidade em porcentagem (%), o vento em metros por segundo (m/s), a pressão em hectopascais (hPa) e a radiação solar em watts por metro quadrado (W/m²). O índice UV é um número sem unidade. |
| **Gráfico recente** | Com registros recentes, o painel mostra as últimas 24 horas. Quando só há leituras antigas, **Exibindo último período ativo** identifica as 24 horas que terminam na última medição conhecida. Uma interrupção de mais de 30 minutos entre amostras deixa uma quebra no traçado. |
| **Histórico e planilha** | Escolha 24 horas, 7 dias, 30 dias ou um intervalo personalizado. O resumo considera o período todo. O gráfico e a tabela do histórico mostram a página selecionada. **Exportar CSV** baixa um arquivo que pode ser aberto no Excel ou no LibreOffice. O limite padrão é de 5.000 registros por exportação. |
| **Origem dos dados** | **Simulador** identifica uma estação de teste cadastrada no leitor. **Demonstração** identifica exemplos gerados no próprio painel. Uma falha de conexão não ativa os exemplos automaticamente. |

<a id="contribuidores-licenca"></a>

## Contribuidores e licença

### Contribuidores

O painel integra o projeto da **Estação Meteorológica SESC e UFRPE/UAST**. Para relatar um problema, conte qual aba abriu, o que fez e o que apareceu. Por exemplo: “Abri Histórico no celular, escolhi 7 dias e a tabela ficou vazia”. Se o problema envolver uma medição, inclua a data e a hora que aparecem no painel.

Quem alterar o código pode conferir o resultado pelas verificações da seção [Validação e documentação](#validacao).

<a id="licenca"></a>

### Licença

Este repositório ainda não traz uma licença geral para o código do painel. A fonte usada nas telas tem condições próprias, disponíveis nos [avisos de licença dos recursos visuais](public/licencas-visuais.txt).

O modelo de documentação fornecido para este leia-me foi inspirado no [README do Downshift](https://github.com/downshift-js/downshift#readme).
