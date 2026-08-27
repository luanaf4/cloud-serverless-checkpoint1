# Evolução dos checkpoints

## Checkpoint 1 — HTTP

A primeira versão era uma função AWS Lambda simples, chamada por uma requisição HTTP direta. O cliente precisava conhecer e acessar o endpoint para iniciar o processamento.

## Checkpoint 2 — Event-driven

Nesta versão, a Lambda `serverless-checkpoint2` não recebe chamadas HTTP. O fluxo agora é:

```text
Produtor -> Amazon SNS (orders) -> AWS Lambda -> CloudWatch Logs
```

Uma mensagem JSON com `orderId` é publicada no tópico `orders`. O SNS entrega o evento à Lambda, que valida o pedido, registra o processamento no CloudWatch e retorna o resumo da execução.

### Mudanças implementadas

- novo handler `index.handler` para eventos SNS;
- validação do envelope e da mensagem do SNS;
- processamento de múltiplos registros na mesma invocação;
- logs estruturados com `orderId` e `messageId`;
- gatilho privado SNS, sem Function URL pública;
- testes unitários e simulador local mantidos no repositório.

O código do Checkpoint 2 está nos arquivos `index.js`, `index.test.js` e `local.js`. Nenhuma credencial ou URL privada da AWS deve ser versionada.
