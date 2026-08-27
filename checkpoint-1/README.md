# HTTP Serverless Function

Exemplo de uma funcao serverless HTTP desenvolvida em Node.js e preparada para implantacao no AWS Lambda.

## Tecnologias

- Node.js 18 ou superior
- AWS Lambda
- AWS Lambda Function URL

## Estrutura

```text
.
├── index.js
├── index.test.js
├── local.js
├── package.json
└── README.md
```

## Pre-requisitos

- Node.js 18 ou superior
- npm

## Execucao local

Instale as dependencias:

```bash
npm install
```

Inicie a funcao:

```bash
npm start
```

O endpoint local fica disponivel em:

```text
http://localhost:8080
```

Exemplo de requisicao:

```bash
curl http://localhost:8080
```

Exemplo de resposta:

```json
{
  "message": "Serverless function is running.",
  "status": "ok"
}
```

## Testes

```bash
npm test
```

## Configuracao no AWS Lambda

- Runtime: Node.js 24.x
- Handler: `index.handler`
- Function URL: acesso publico

O endereco da funcao implantada nao e armazenado neste repositorio.

## Endpoint

| Metodo | Caminho | Descricao |
| --- | --- | --- |
| `GET` | `/` | Retorna uma mensagem em formato JSON. |

## Licenca

Projeto desenvolvido para fins educacionais.
