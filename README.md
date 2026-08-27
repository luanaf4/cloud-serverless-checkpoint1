# Checkpoint 2 - Função Serverless Orientada a Eventos

Este projeto evolui a função HTTP do Checkpoint 1 para uma arquitetura orientada a eventos. A função AWS Lambda `serverless-checkpoint2` é executada automaticamente quando uma nova mensagem é publicada no tópico Amazon SNS `orders`.

> **Mapeamento para o enunciado:** o enunciado apresenta Google Cloud Pub/Sub como exemplo. Nesta entrega foi utilizada a alternativa AWS permitida na atividade: **Amazon SNS** como serviço de publicação/assinatura, com Lambda como consumidor e CloudWatch como observabilidade.

## Diferenca entre os checkpoints

| Checkpoint 1 | Checkpoint 2 |
| --- | --- |
| Lambda acionada diretamente por uma requisicao HTTP | Lambda acionada por um evento do Amazon SNS |
| Entrada e resposta HTTP | Mensagem publicada no topico `orders` |
| Endpoint publico | Gatilho privado, sem Function URL |
| Processamento sob demanda do cliente | Processamento assíncrono orientado a eventos |

O Checkpoint 2 mantém a funcao serverless, mas troca o modelo request/response por publisher/subscriber: um produtor publica um pedido no SNS e a Lambda reage automaticamente.

## Provedor utilizado

- Amazon Web Services (AWS)
- AWS Lambda
- Amazon Simple Notification Service (SNS)
- Amazon CloudWatch Logs
- Node.js 20 ou superior (o laboratório utilizou Node.js 24.x)

## Arquitetura

```text
Produtor -> topico SNS "orders" -> AWS Lambda -> CloudWatch Logs
```

A funcao possui um gatilho privado gerenciado pela AWS. Ela nao expoe uma Function URL publica e nao recebe pedidos por HTTP.

## Estrutura

```text
.
├── .gitignore
├── index.js
├── index.test.js
├── local.js
├── package-lock.json
├── package.json
└── README.md
```

## Como rodar localmente

### Pre-requisitos

- Node.js 20 ou superior
- npm
- Terminal de comandos aberto

### Passo a passo

1. Clone o repositorio:

   ```bash
   git clone https://github.com/luanaf4/cloud-serverless-checkpoint1.git
   ```

2. Entre na pasta do projeto:

   ```bash
   cd cloud-serverless-checkpoint1
   ```

3. Instale as dependencias:

   ```bash
   npm install
   ```

4. Simule localmente um evento do Amazon SNS:

   ```bash
   npm start
   ```

O terminal exibira um log estruturado contendo o `orderId`, o `messageId` e o status do processamento. O arquivo `local.js` cria somente um evento de exemplo em memoria; ele nao acessa a AWS.

## Testes automatizados

Execute:

```bash
npm test
```

Os testes validam a leitura do evento SNS, o processamento de varios registros, o handler da Lambda e a rejeicao de mensagens invalidas.

## Implantacao na AWS

Os passos abaixo utilizam a regiao `us-east-1`, a mesma adotada no Checkpoint 1.

1. No Amazon SNS, crie um topico do tipo **Standard** com o nome `orders`.

2. No AWS Lambda, crie uma funcao com estas configuracoes:

   - Nome: `serverless-checkpoint2`
   - Runtime: Node.js 20 ou superior
   - Arquitetura: `x86_64`
   - Funcao de execucao: uma role permitida pelo laboratorio AWS Academy

3. Envie o arquivo `index.js` pelo editor da Lambda ou por um pacote `.zip`.

4. Confirme o handler do pacote local:

   ```text
   index.handler
   ```

   No pacote implantado pelo laboratório, o arquivo pode aparecer como `index.mjs`; nesse caso, mantenha o mesmo ponto de entrada `index.handler`.

5. Adicione o Amazon SNS como gatilho e selecione o topico `orders`.

6. Nao crie uma Function URL. A invocacao deve acontecer exclusivamente pelo topico SNS.

## Teste na nuvem

No topico `orders`, escolha **Publish message** e use este conteudo no corpo da mensagem:

```json
{
  "orderId": "order-001",
  "product": "Notebook",
  "quantity": 1
}
```

Depois, abra os logs da funcao no CloudWatch e confirme uma entrada com:

```json
{
  "severity": "INFO",
  "message": "Order processed successfully.",
  "status": "processed",
  "orderId": "order-001"
}
```

## Seguranca

- Nenhuma credencial, chave de servico ou arquivo confidencial deve ser versionado.
- O arquivo `.gitignore` bloqueia formatos comuns de credenciais e pacotes de implantacao.
- A funcao e acionada pelo SNS e nao aceita chamadas HTTP publicas.
- O ARN, o identificador da conta e o endereco da funcao implantada nao sao armazenados neste repositorio.
- Qualquer identificacao ou endereco da funcao solicitada na entrega deve ser enviado somente nos comentarios do Canvas.

## Entrega no Canvas

- Campo de URL: link do repositório público do GitHub, contendo este README e o código-fonte.
- Comentários/caixa de texto: URL ou identificação privada da função ativa na nuvem, conforme solicitado pelo professor.
- Anexos opcionais: evidência do CloudWatch, resultado do teste da Lambda e transcript em texto.

Não publicar no README a URL pública de invocação da função. Esta implementação não possui Function URL; a invocação ocorre pelo tópico privado `orders`.

## Licenca

Projeto desenvolvido para fins educacionais.
