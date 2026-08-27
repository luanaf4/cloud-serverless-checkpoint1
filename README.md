# Checkpoint 2 - Evolução de Função Serverless com AWS Lambda e Amazon SNS

## Descrição

Este repositório apresenta a evolução de uma função serverless desenvolvida em Node.js e implantada na Amazon Web Services (AWS).

No **Checkpoint 1**, a solução consistia em uma função AWS Lambda acionada diretamente por uma requisição HTTP. O cliente enviava a requisição para um endpoint público e recebia uma resposta no mesmo fluxo.

No **Checkpoint 2**, a solução foi evoluída para uma arquitetura orientada a eventos. Um produtor publica uma mensagem JSON no tópico Amazon SNS `orders`, o SNS aciona a função AWS Lambda `serverless-checkpoint2` e o resultado do processamento é registrado no Amazon CloudWatch Logs.

## Evolução do Checkpoint 1 para o Checkpoint 2

| Checkpoint 1 | Checkpoint 2 |
| --- | --- |
| Função acionada por requisição HTTP | Função acionada por evento do Amazon SNS |
| Comunicação síncrona no modelo requisição/resposta | Comunicação assíncrona no modelo publicação/assinatura |
| Endpoint HTTP público | Gatilho privado do SNS, sem Function URL pública |
| Processamento iniciado diretamente pelo cliente | Processamento iniciado pela publicação de uma mensagem |

O código do Checkpoint 1 foi preservado no diretório `checkpoint-1/`. Os arquivos localizados na raiz do repositório correspondem à implementação do Checkpoint 2.

## Provedor Utilizado

- Amazon Web Services (AWS)
- AWS Lambda
- Amazon Simple Notification Service (Amazon SNS)
- Amazon CloudWatch Logs

## Arquitetura do Checkpoint 2

```text
Produtor -> Amazon SNS (tópico "orders") -> AWS Lambda -> CloudWatch Logs
```

A função Lambda utiliza o handler `index.handler`, processa eventos recebidos do SNS, valida a presença do campo `orderId` e gera logs estruturados com o resultado. A solução não expõe uma Function URL pública.

## Estrutura do Repositório

```text
.
├── checkpoint-1/        # implementação HTTP do Checkpoint 1
├── CHECKPOINTS.md       # resumo da evolução entre os checkpoints
├── index.js             # handler SNS do Checkpoint 2
├── index.test.js        # testes automatizados
├── local.js             # simulação local de um evento SNS
├── package-lock.json
├── package.json
└── README.md
```

## Como Rodar Localmente

### Pré-requisitos

- Node.js instalado, versão 20 ou superior
- npm
- Terminal de comandos aberto

### Passo a Passo

1. Clone o repositório para sua máquina:

   ```bash
   git clone https://github.com/luanaf4/cloud-serverless-checkpoint1.git
   ```

2. Entre na pasta do projeto:

   ```bash
   cd cloud-serverless-checkpoint1
   ```

3. Instale as dependências do projeto:

   ```bash
   npm install
   ```

4. Execute a simulação local do evento SNS:

   ```bash
   npm start
   ```

O comando cria um evento SNS de exemplo somente em memória e chama o mesmo handler utilizado pela AWS Lambda. Nenhum recurso da AWS é acessado durante a execução local.

### Resultado Esperado

O terminal apresenta um log estruturado com o identificador do pedido, o identificador da mensagem e o status do processamento:

```json
{
  "severity": "INFO",
  "message": "Order processed successfully.",
  "status": "processed",
  "orderId": "order-local-001",
  "messageId": "local-message-001"
}
```

## Testes Automatizados

Execute os testes com:

```bash
npm test
```

Os testes verificam:

- leitura e validação do evento do Amazon SNS;
- processamento de um ou vários registros;
- exportação do handler esperado pela AWS Lambda;
- geração de logs estruturados;
- rejeição de eventos e mensagens inválidas.

## Configuração na AWS

A solução do Checkpoint 2 utiliza a seguinte configuração:

- função Lambda: `serverless-checkpoint2`;
- runtime: Node.js 24.x;
- arquitetura: `x86_64`;
- handler: `index.handler`;
- tópico SNS: `orders`;
- região: `us-east-1`;
- gatilho: Amazon SNS;
- Function URL pública: não configurada.

## Validação na Nuvem

Para validar a solução implantada, publique uma mensagem no tópico SNS `orders` com um corpo JSON semelhante ao exemplo:

```json
{
  "orderId": "order-001",
  "product": "Notebook",
  "quantity": 1
}
```

O SNS entrega o evento à Lambda. O resultado do processamento pode ser verificado nos logs da função no Amazon CloudWatch.

## Segurança

Este repositório não contém:

- credenciais ou chaves de acesso da AWS;
- ARN ou identificador real da conta AWS;
- arquivos confidenciais do laboratório;
- Function URL ou outro endpoint público da função implantada.

Os identificadores presentes no simulador e nos testes são fictícios e utilizados exclusivamente para representar o formato de um evento SNS.

## Licença

Projeto desenvolvido para fins educacionais.
