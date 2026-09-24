'use strict';
const {createLogger} = require('./observability');
function decodePubSubEvent(event) {
  const encoded = event?.data?.message?.data ?? event?.message?.data;
  if (typeof encoded !== 'string' || encoded.length === 0) throw new Error('O evento Pub/Sub deve conter message.data em base64.');
  let order; try { order = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')); } catch (error) { throw new Error('A mensagem Pub/Sub deve conter JSON valido.', {cause: error}); }
  if (!order || typeof order !== 'object' || Array.isArray(order)) throw new Error('O pedido deve ser um objeto JSON.');
  if (typeof order.orderId !== 'string' || order.orderId.trim() === '') throw new Error('O pedido deve conter um orderId valido.');
  return order;
}
async function processOrderEvent(event, logger = createLogger()) {
  const correlationId = event?.message?.attributes?.correlationId ?? null;
  const order = decodePubSubEvent(event);
  logger.info('order_processed', {metricName: 'orders_processed', orderId: order.orderId, correlationId, result: 'success'});
  return {status: 'processed', orderId: order.orderId, correlationId};
}
async function handler(event) {
  const logger = createLogger(); const startedAt = Date.now();
  logger.info('order_processing_started', {metricName: 'orders_started', correlationId: event?.message?.attributes?.correlationId ?? null});
  try { const result = await processOrderEvent(event, logger); logger.info('order_processing_finished', {metricName: 'orders_succeeded', orderId: result.orderId, durationMs: Date.now() - startedAt}); return result; }
  catch (error) { logger.error('order_processing_failed', {metricName: 'orders_failed', errorType: error.name, errorMessage: error.message, durationMs: Date.now() - startedAt}); throw error; }
}
module.exports = {decodePubSubEvent, handler, processOrderEvent};
