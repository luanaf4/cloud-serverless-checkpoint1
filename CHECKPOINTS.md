# Evolução dos Checkpoints 1–5

## Checkpoint 1 — HTTP

A primeira versão expunha uma função AWS Lambda chamada por uma requisição HTTP direta. O código permanece preservado em `checkpoint-1/`.

## Checkpoint 2 — Event-driven

O segundo checkpoint substituiu a chamada HTTP por um evento do Amazon SNS:

```text
Produtor -> Amazon SNS (orders) -> AWS Lambda -> CloudWatch Logs
```

O handler em `index.js` valida mensagens SNS, processa múltiplos registros e produz logs estruturados.

## Checkpoint 3 — Orquestração

O terceiro checkpoint adiciona AWS Step Functions para controlar todo o fluxo:

```text
Entrada -> validação -> regra de idempotência -> Lambda
                                      |          |
                                      |          +-> retry
                                      +--------------> SNS dead-letter destination
```

### Mudanças implementadas

- State Machine Standard definida como código;
- validação de `orderId` e `idempotencyKey`;
- idempotência por nome de execução Standard igual ao `orderId`;
- chamada da Lambda do Checkpoint 2 em ordem controlada;
- retry com backoff exponencial para falhas transitórias;
- `Catch` para falhas definitivas;
- publicação de falhas em tópico SNS dedicado;
- validador estrutural e testes automatizados;
- nenhuma credencial ou identificação real da conta no template público.

## Checkpoint 4 — Observabilidade e migração para Google Cloud

O quarto checkpoint migra o fluxo serverless para serviços gerenciados do Google Cloud, preservando os artefatos AWS dos checkpoints anteriores:

```text
Entrada -> Google Cloud Workflows -> Pub/Sub -> Cloud Run Function (Gen 2)
                                      |                 |
                                      +-> DLQ            +-> Cloud Logging / Monitoring
```

### Mudanças implementadas

- Workflow do Google Cloud com validação, idempotência, retry e DLQ;
- tópicos Pub/Sub `orders-gcp` e `orders-gcp-dlq`;
- função Gen 2 `checkpoint4-order-processor`;
- logs estruturados e métricas `orders_started`, `orders_processed` e `orders_failed`;
- evidências visuais preservadas em `docs/evidence/`;
- código e testes do GCP isolados em `gcp/`, sem remover os artefatos dos Checkpoints 1–3.

## Checkpoint 5 — CI/CD para deploy automático

O quinto checkpoint automatiza a validação e o deploy da função Google Cloud por GitHub Actions. A branch `checkpoint5-ci-cd` contém a implementação para revisão; após o merge, cada push em `main` pode executar o deploy automático.

### Pipeline

```text
Pull request / push
        |
        v
npm ci -> validate -> test -> auditoria de arquivos sensíveis
        |
        +-> push em main -> OIDC/WIF -> deploy Gen 2 -> verificação ACTIVE
```

O workflow está em `.github/workflows/ci-cd-gcp.yml` e executa:

- instalação com `npm ci`;
- validação estrutural com `npm run validate`;
- testes automatizados com `npm test`;
- bloqueio de arquivos sensíveis rastreados;
- autenticação no Google Cloud por Workload Identity Federation;
- deploy da função Gen 2 com gatilho Pub/Sub, retry e limite de instâncias;
- verificação do estado final da função.

### Segurança e evidências

- nenhum arquivo `.env`, token, chave JSON ou credencial é versionado;
- os secrets `GCP_WORKLOAD_IDENTITY_PROVIDER` e `GCP_SERVICE_ACCOUNT` ficam somente no GitHub Actions;
- as variáveis públicas de projeto, região, função e tópico ficam configuradas no GitHub Actions;
- o provedor OIDC é restrito ao repositório e à branch `main`;
- as execuções ficam disponíveis em [GitHub Actions — CI/CD Google Cloud](https://github.com/luanaf4/cloud-serverless-checkpoint1/actions/workflows/ci-cd-gcp.yml).

## Projeto Final — Vertex AI e evento de saída

O Projeto Final mantém todos os diretórios anteriores e adiciona:

- `gcp/ai.js`: contrato da resposta e adaptadores Vertex AI/teste;
- `gcp/event-contracts.js`: envelope versionado dos eventos;
- `gcp/pubsub.js`: publicação autenticada do evento enriquecido;
- integração no consumidor `gcp/process-order.js`;
- testes de contrato, Vertex e publicação Pub/Sub;
- documentação do diagrama, decisões, segurança, custos e roteiro no `README.md`.

O caminho implantado exige `AI_PROVIDER=vertex`. O token de acesso é temporário e obtido pela identidade da função; nenhum segredo é versionado. O mock é exclusivo dos testes locais.
