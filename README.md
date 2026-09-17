# Checkpoint 5 - CI/CD, Observabilidade e Migração Serverless

Este projeto preserva integralmente os Checkpoints 1, 2, 3 e 4 e adiciona o Checkpoint 5, que automatiza a validação e o deploy da função serverless. Os artefatos AWS e GCP continuam versionados para manter o histórico acadêmico, enquanto o pipeline de CI/CD controla a integração e a implantação no Google Cloud.

A implementação do Checkpoint 4 usa Google Cloud Workflows, Pub/Sub, Cloud Run Functions, Cloud Logging e Cloud Monitoring. O Checkpoint 5 adiciona GitHub Actions e Workload Identity Federation, sem chaves JSON de service account. A solução mantém os requisitos funcionais de validação, idempotência, retries, destino de mensagens mortas e observabilidade.

## Evolução dos checkpoints

| Checkpoint | Arquitetura | Objetivo |
| --- | --- | --- |
| 1 | Cliente → Lambda HTTP | Executar uma função por requisição direta |
| 2 | SNS `orders` → Lambda → CloudWatch | Processar pedidos de forma assíncrona e orientada a eventos |
| 3 | Step Functions → Lambda / SNS DLQ | Orquestrar, validar, aplicar idempotência e tratar falhas |
| 4 | Workflows → Cloud Run Function / Pub/Sub DLQ | Instrumentar logs, métricas e analisar performance/custo |
| 5 | GitHub Actions → Workload Identity Federation → Cloud Run Function | Automatizar testes, validações e deploy seguro |

O código HTTP original permanece em `checkpoint-1/`. O handler orientado a eventos do Checkpoint 2 permanece em `index.js`. A definição do Checkpoint 3 está em `workflow/state-machine.template.json`. O Checkpoint 4 está isolado em `gcp/`, sem remover ou substituir esses artefatos.

## Provedor utilizado

- Amazon Web Services (AWS)
- AWS Step Functions
- AWS Lambda
- Amazon SNS
- Amazon CloudWatch
- Google Cloud Workflows
- Google Cloud Pub/Sub
- Cloud Run Functions (Gen2)
- Cloud Logging e Cloud Monitoring
- GitHub Actions
- Workload Identity Federation
- Node.js 20 ou superior

## Arquitetura anterior — AWS (Checkpoints 2 e 3)

```text
Pedido
  |
  v
AWS Step Functions (Standard)
  |
  +--> valida orderId e idempotencyKey
  |
  +--> AWS Lambda serverless-checkpoint2
  |      +--> retry com backoff exponencial
  |
  +--> sucesso: OrderProcessed
  |
  +--> falha: tópico SNS checkpoint3-orders-dlq
```

## Migração para Google Cloud — Checkpoint 4

```text
Entrada do pedido
      |
      v
Google Cloud Workflows
      | valida orderId/idempotencyKey
      +--> Pub/Sub orders-gcp --> Cloud Run Function
      |                             |
      |                             +--> logs JSON + métricas
      |                             +--> sucesso
      |
      +--> entrada inválida --> Pub/Sub orders-gcp-dlq
```

O fluxo equivalente foi reimplementado com serviços gerenciados do Google Cloud. O Workflows publica mensagens no Pub/Sub, a função Gen2 processa o evento e o Cloud Logging recebe os registros JSON. A DLQ separa falhas de validação e mensagens que não devem continuar em retry.

## Idempotência

O `orderId` é utilizado como chave de idempotência. O corpo de entrada deve conter `orderId` e `idempotencyKey` com o mesmo valor.

A State Machine é do tipo **Standard**. Ao iniciar uma execução na AWS, use também o `orderId` como nome da execução. A AWS rejeita outra execução Standard com o mesmo nome durante o período de retenção, evitando o processamento duplicado do pedido.

Exemplo:

```json
{
  "orderId": "order-checkpoint3-001",
  "idempotencyKey": "order-checkpoint3-001",
  "product": "Notebook",
  "quantity": 1
}
```

## Retry e destino de mensagens mortas

A chamada da Lambda repete falhas transitórias até três vezes, com intervalo inicial de dois segundos e `BackoffRate` igual a `2`.

Depois de esgotar as tentativas, o bloco `Catch` encaminha o evento e os detalhes do erro ao tópico SNS dedicado `checkpoint3-orders-dlq`. Entradas inválidas seguem diretamente para o mesmo destino. O tópico funciona como dead-letter destination do pipeline e não possui exposição HTTP pública.

## Estrutura

```text
.
├── .github/workflows/
│   └── ci-cd-gcp.yml
├── checkpoint-1/
├── workflow/
│   ├── example-input.json
│   ├── state-machine.template.json
│   ├── state-machine.test.js
│   └── validate-state-machine.js
├── gcp/
│   ├── gcp.test.js
│   ├── observability.js
│   ├── process-order.js
│   └── workflow.yaml
├── docs/evidence/
│   ├── checkpoint4-logs-started.png
│   ├── checkpoint4-logs-failed.png
│   ├── checkpoint4-log-metrics.png
│   ├── checkpoint4-function-status.png
│   ├── checkpoint4-function-metrics.png
│   ├── checkpoint4-workflow-success-summary.png
│   ├── checkpoint4-workflow-success-steps.png
│   ├── checkpoint4-workflow-invalid.png
│   ├── checkpoint4-workflow-source.png
│   └── checkpoint4-pubsub-dlq.png
├── CHECKPOINTS.md
├── index.js
├── index.test.js
├── local.js
├── package-lock.json
├── package.json
└── README.md
```

## Como rodar localmente

### Pré-requisitos

- Node.js 20 ou superior
- npm
- terminal de comandos aberto

### Passo a passo

1. Clone o repositório:

   ```bash
   git clone https://github.com/luanaf4/cloud-serverless-checkpoint1.git
   ```

2. Entre na pasta:

   ```bash
   cd cloud-serverless-checkpoint1
   ```

3. Instale as dependências:

   ```bash
   npm install
   ```

4. Valide localmente a definição da State Machine:

   ```bash
   npm start
   ```

5. Execute todos os testes:

   ```bash
   npm test
   ```

O validador local verifica `StartAt`, destinos `Next`, blocos `Catch` e a presença de estados terminais. Os testes também verificam idempotência, retry e encaminhamento de falhas.

## Implementação Google Cloud — Checkpoint 4

Arquitetura-alvo:

```text
Entrada → Google Cloud Workflows → Cloud Run Function → sucesso
                                      └→ Pub/Sub dead-letter topic
```

Arquivos em `gcp/`:

- `workflow.yaml`: template do Workflows com validação, publicação no Pub/Sub, retry com backoff e publicação de entradas inválidas no dead-letter topic.
- `process-order.js`: handler HTTP/event-driven compatível com Cloud Run Functions para mensagens Pub/Sub.
- `observability.js`: logs JSON com `severity`, evento, correlação, duração e contadores de métricas.
- `gcp.test.js`: testes de decodificação Pub/Sub, processamento, logs e ausência de credenciais reais.

Os valores `ORDERS_TOPIC` e `DEAD_LETTER_TOPIC` são injetados por variáveis de ambiente no Workflows. URLs reais, tokens, chaves e dados da conta devem ser configurados somente no ambiente de implantação e nunca versionados.

### Observabilidade

O Cloud Run coleta automaticamente os registros JSON enviados para stdout no Cloud Logging. Os eventos instrumentados incluem início, sucesso, falha e duração do processamento. Os campos `metricName` permitem criar métricas baseadas em logs no Cloud Monitoring sem armazenar credenciais no código.

Métricas implementadas:

- `orders_started`;
- `orders_processed`;
- `orders_failed`;

Os campos `event`, `metricName`, `orderId`, `correlationId`, `durationMs` e `severity` permitem filtrar os eventos e investigar uma execução sem expor dados sensíveis.

## Evidências do Checkpoint 4

As evidências visuais ficam em [`docs/evidence/`](docs/evidence/):

| Evidência | Arquivo | O que comprova |
| --- | --- | --- |
| Função ativa e íntegra | [`checkpoint4-function-status.png`](docs/evidence/checkpoint4-function-status.png) | Serviço `checkpoint4-order-processor` ativo, com tráfego e status operacional normal. |
| Métricas da função | [`checkpoint4-function-metrics.png`](docs/evidence/checkpoint4-function-metrics.png) | Gráficos de CPU, memória, instâncias, latência e solicitações do Cloud Run. |
| Métricas baseadas em logs | [`checkpoint4-log-metrics.png`](docs/evidence/checkpoint4-log-metrics.png) | Métricas `orders_started`, `orders_processed` e `orders_failed` criadas no Cloud Monitoring. |
| Log de processamento iniciado | [`checkpoint4-logs-started.png`](docs/evidence/checkpoint4-logs-started.png) | Registro estruturado do início do processamento, com evento, pedido e métrica associada. |
| Log estruturado de falha | [`checkpoint4-logs-failed.png`](docs/evidence/checkpoint4-logs-failed.png) | Falha validada no Cloud Logging, incluindo mensagem de erro, severidade e `metricName`. |
| Workflow concluído | [`checkpoint4-workflow-success-summary.png`](docs/evidence/checkpoint4-workflow-success-summary.png) | Execução válida concluída com status de sucesso e saída publicada. |
| Workflow concluído e etapas | [`checkpoint4-workflow-success-steps.png`](docs/evidence/checkpoint4-workflow-success-steps.png) | Etapas percorridas pelo Workflow, incluindo validação, retry e publicação. |
| Entrada inválida e rota `invalid_input` | [`checkpoint4-workflow-invalid.png`](docs/evidence/checkpoint4-workflow-invalid.png) | Tratamento de entrada sem campos obrigatórios e encaminhamento para a rota de falha. |
| Código/diagrama do Workflow | [`checkpoint4-workflow-source.png`](docs/evidence/checkpoint4-workflow-source.png) | Definição visual do fluxo, das condições, do retry e da publicação na DLQ. |
| Assinatura Pub/Sub da DLQ | [`checkpoint4-pubsub-dlq.png`](docs/evidence/checkpoint4-pubsub-dlq.png) | Assinatura `orders-gcp-dlq-sub` criada e ativa para receber mensagens de falha. |

O print da assinatura demonstra que a DLQ está ativa; o print da execução inválida demonstra a decisão de encaminhamento.

### Implantação GCP — roteiro seguro

1. Selecione o projeto autorizado no Google Cloud Console.
2. Confirme uma conta de faturamento de teste ou outra conta autorizada.
3. Ative as APIs de Workflows, Pub/Sub, Cloud Run Admin, Cloud Build e Artifact Registry conforme a necessidade da implantação.
4. Crie os tópicos `orders-gcp` e `orders-gcp-dlq`.
5. Publique `gcp/deploy/index.js` como a Cloud Run Function `checkpoint4-order-processor`, com retry e limite de instâncias documentados.
6. Implante `gcp/workflow.yaml` como `checkpoint4-order-orchestration`, injetando os nomes dos tópicos por variáveis de ambiente.
7. Conceda ao Workflows somente as permissões necessárias para invocar o serviço e publicar no tópico de falhas.
8. Execute os cenários de sucesso, idempotência, retry e falha definitiva.
9. Capture evidências do Cloud Logging, Cloud Monitoring, Workflows e Pub/Sub.

Estado do ambiente de demonstração: APIs habilitadas, tópicos criados, Workflow ativo em `us-central1`, função Gen2 ativa com retry e três métricas baseadas em logs (`orders_started`, `orders_processed` e `orders_failed`). Não versionar identificadores de conta, URLs de runtime, tokens ou chaves.

## Análise crítica e otimizações propostas

As seguintes otimizações são fundamentadas na arquitetura e devem ser validadas continuamente pelas métricas de latência, CPU, memória, erros e mensagens não confirmadas:

1. **Idempotência e deduplicação durável:** persistir `orderId`/`idempotencyKey` em um armazenamento apropriado antes do processamento. Isso evita efeitos duplicados quando o Pub/Sub reentrega uma mensagem, com o trade-off de uma chamada adicional e custo de armazenamento.
2. **Retry seletivo e DLQ:** classificar erros transitórios e permanentes, aplicando backoff apenas aos transitórios e encaminhando os demais imediatamente à DLQ. Isso reduz retry storms, latência e custo de execução.
3. **Ajuste de recursos e retenção:** usar escala mínima zero quando não houver tráfego, revisar memória/concorrência a partir das métricas de CPU e latência e manter somente logs necessários pelo período exigido. Isso reduz custo, mas pode aumentar cold start ou diminuir a capacidade de pico se os limites forem agressivos.

O ambiente de demonstração usa uma função Gen2 com 256 MiB e limite de uma instância para manter o experimento controlado. Esses valores não são conclusões universais: devem ser recalibrados com carga real.

## Checkpoint 5 — CI/CD para deploy automático

O workflow [`ci-cd-gcp.yml`](.github/workflows/ci-cd-gcp.yml) automatiza a validação e o deploy da função Gen2. Em pull requests e pushes para outras branches, o pipeline executa somente a fase de verificação. Após um merge na `main`, a fase de deploy autentica no Google Cloud por Workload Identity Federation e publica `gcp/deploy/` com `gcloud functions deploy`.

### Etapas automatizadas

1. `npm ci` instala as dependências a partir do lockfile.
2. `npm run validate` verifica a definição do workflow.
3. `npm test` executa os testes dos Checkpoints 2, 3 e 4.
4. Uma checagem falha se arquivos sensíveis conhecidos estiverem rastreados.
5. O job de deploy publica a função Cloud Run Functions (Gen 2), configura o gatilho Pub/Sub, retry e limite de instâncias e verifica o estado final.

### Configuração segura do GitHub Actions

Nenhuma credencial é armazenada no repositório. Configure no GitHub, fora do código:

- Secrets: `GCP_WORKLOAD_IDENTITY_PROVIDER` e `GCP_SERVICE_ACCOUNT`.
- Variables: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_FUNCTION_NAME` e `GCP_PUBSUB_TOPIC`.

O provedor de identidade deve restringir o repositório e a branch `main`, e a conta de serviço deve ter somente as permissões necessárias para o deploy da função. Não use chave JSON de service account, token, `.env` ou URL privada como alternativa.

### Fluxo de integração e publicação

O workflow é executado em pull requests e em pushes para `main`. Pull requests executam a validação, os testes e a auditoria de arquivos sensíveis. O deploy é executado somente depois de um push em `main`, normalmente após o merge da alteração do Checkpoint 5.

Assim, a branch `checkpoint5-ci-cd` serve para revisar o workflow, enquanto `main` é a branch de integração e publicação automática. Os Checkpoints 1–4 permanecem preservados durante o merge.

### Evidência do pipeline

As execuções do pipeline ficam disponíveis em [Actions — CI/CD Google Cloud](https://github.com/luanaf4/cloud-serverless-checkpoint1/actions/workflows/ci-cd-gcp.yml). A execução bem-sucedida deve apresentar os jobs `Validate and test` e `Deploy function` concluídos sem erros, comprovando as etapas de instalação, validação, testes, autenticação OIDC, deploy e verificação da função.

O link direto para a execução específica e seu log textual devem ser utilizados na entrega do Canvas após o primeiro deploy automático bem-sucedido. A execução deve mostrar os passos `Validate and test`, `Deploy Cloud Run function (Gen 2)` e `Verify deployed function`, com o estado final `ACTIVE`. Nenhum log deve incluir secrets, tokens, chaves ou dados privados.

## Implantação na AWS

Esta seção preserva a documentação da arquitetura AWS do Checkpoint 3.

1. Crie uma State Machine **Standard** no AWS Step Functions.
2. Substitua os marcadores do arquivo `workflow/state-machine.template.json` pelos recursos da conta:
   - `${PROCESS_ORDER_FUNCTION_ARN}`: ARN da Lambda do Checkpoint 2;
   - `${ORDERS_TOPIC_ARN}`: ARN do tópico de pedidos;
   - `${DEAD_LETTER_TOPIC_ARN}`: ARN do destino de mensagens mortas.
3. Configure uma role que permita `lambda:InvokeFunction` na Lambda indicada e `sns:Publish` somente no tópico de mensagens mortas.
4. Crie a State Machine.
5. Inicie a execução usando o mesmo valor de `orderId` como nome da execução e como `idempotencyKey`.

Os ARNs reais e o identificador da conta não são armazenados no repositório público.

## Teste na nuvem

### Google Cloud — Checkpoint 4

Com o Workflow `checkpoint4-order-orchestration` ativo, foram validados:

- entrada válida, com publicação em `orders-gcp` e processamento pela função;
- logs `order_processing_started` e `order_processed`;
- métricas `orders_started`, `orders_processed` e `orders_failed`;
- entrada inválida, com falha em `invalid_input` e publicação em `orders-gcp-dlq`.

### AWS — Checkpoint 3

Use o conteúdo de `workflow/example-input.json` e defina o nome da execução como `order-checkpoint3-001`.

Confirme no histórico da execução:

- `ValidateInput` e `ValidateIdempotencyKey` concluídos;
- `ProcessOrder` concluído;
- estado terminal `OrderProcessed`;
- log estruturado da Lambda no CloudWatch.

Para validar a rota de falha, envie uma entrada sem `orderId`. A execução deve passar por `InvalidInput`, publicar no tópico de mensagens mortas e terminar em `OrderFailed`.

## Segurança

- Nenhuma credencial, chave, token, `.env` ou arquivo confidencial deve ser versionado.
- Os identificadores reais da conta são substituídos por marcadores no template.
- O pipeline não possui URL HTTP pública.
- A role da State Machine deve aplicar privilégio mínimo para Lambda e SNS.
- Logs e screenshots não devem revelar credenciais ou tokens de sessão.

## Licença

Projeto desenvolvido para fins educacionais.
