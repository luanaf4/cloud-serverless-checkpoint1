'use strict';

/**
 * Decodifica e valida o pedido transportado por um registro do Amazon SNS.
 *
 * @param {object} record Registro recebido pela funcao Lambda.
 * @returns {object} Pedido decodificado.
 */
function decodeOrder(record) {
  if (record?.EventSource !== 'aws:sns' || !record.Sns) {
    throw new Error('O evento deve conter um registro valido do Amazon SNS.');
  }

  const message = record.Sns.Message;

  if (typeof message !== 'string' || message.trim() === '') {
    throw new Error('A mensagem do SNS nao contem o campo Message.');
  }

  let order;

  try {
    order = JSON.parse(message);
  } catch (error) {
    throw new Error('O campo Message do SNS deve conter um JSON valido.', {
      cause: error,
    });
  }

  if (!order || typeof order !== 'object' || Array.isArray(order)) {
    throw new Error('O pedido deve ser um objeto JSON.');
  }

  if (typeof order.orderId !== 'string' || order.orderId.trim() === '') {
    throw new Error('O pedido deve conter um orderId valido.');
  }

  return order;
}

/**
 * Processa um pedido publicado no topico SNS "orders".
 *
 * @param {object} record Registro gerado pelo SNS.
 * @param {Console} logger Logger injetavel para facilitar os testes.
 * @returns {Promise<object>} Resumo do processamento.
 */
async function processOrder(record, logger = console) {
  const order = decodeOrder(record);

  const result = {
    status: 'processed',
    orderId: order.orderId,
    messageId: record.Sns.MessageId ?? null,
  };

  logger.log(
    JSON.stringify({
      severity: 'INFO',
      message: 'Order processed successfully.',
      ...result,
    }),
  );

  return result;
}

/**
 * Processa todos os registros SNS entregues em uma invocacao.
 *
 * @param {object} event Evento da AWS Lambda.
 * @param {Console} logger Logger injetavel para facilitar os testes.
 * @returns {Promise<object>} Resumo da invocacao.
 */
async function processSnsEvent(event, logger = console) {
  if (!Array.isArray(event?.Records) || event.Records.length === 0) {
    throw new Error('O evento da Lambda nao contem registros do SNS.');
  }

  const orders = [];

  for (const record of event.Records) {
    orders.push(await processOrder(record, logger));
  }

  return {
    status: 'processed',
    processedRecords: orders.length,
    orders,
  };
}

/**
 * Ponto de entrada configurado na AWS Lambda como index.handler.
 *
 * @param {object} event Evento entregue pelo Amazon SNS.
 * @returns {Promise<object>} Resumo da invocacao (ignorado pelo SNS).
 */
async function handler(event) {
  return processSnsEvent(event);
}

module.exports = {decodeOrder, handler, processOrder, processSnsEvent};
