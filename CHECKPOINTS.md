# Evolução dos checkpoints

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
