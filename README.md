# Checkpoint 3 - Orquestração Serverless de Pedidos

Este projeto evolui os Checkpoints 1 e 2 para uma orquestração completa de serviços. O fluxo utiliza AWS Step Functions para validar pedidos, chamar a função Lambda na ordem definida, repetir falhas transitórias e encaminhar falhas definitivas para um destino de mensagens mortas.

## Evolução dos checkpoints

| Checkpoint | Arquitetura | Objetivo |
| --- | --- | --- |
| 1 | Cliente → Lambda HTTP | Executar uma função por requisição direta |
| 2 | SNS `orders` → Lambda → CloudWatch | Processar pedidos de forma assíncrona e orientada a eventos |
| 3 | Step Functions → Lambda / SNS DLQ | Orquestrar, validar, aplicar idempotência e tratar falhas |

O código HTTP original permanece em `checkpoint-1/`. O handler orientado a eventos do Checkpoint 2 permanece em `index.js`. A definição do Checkpoint 3 está em `workflow/state-machine.template.json`.

## Provedor utilizado

- Amazon Web Services (AWS)
- AWS Step Functions
- AWS Lambda
- Amazon SNS
- Amazon CloudWatch
- Node.js 20 ou superior

## Arquitetura

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
├── checkpoint-1/
├── workflow/
│   ├── example-input.json
│   ├── state-machine.template.json
│   ├── state-machine.test.js
│   └── validate-state-machine.js
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

## Implantação na AWS

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
