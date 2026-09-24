'use strict';
const {createLogger} = require('./observability');
const modern = require('./gcp/process-order');

function decodePubSubEvent(event) {
  return modern.decodePubSubEvent(event);
}

async function legacyProcessOrderEvent(event, logger = createLogger()) {
  const correlationId = event?.message?.attributes?.correlationId ?? null;
  const order = decodePubSubEvent(event);
  logger.info('order_processed', {metricName: 'orders_processed', orderId: order.orderId, correlationId, result: 'success'});
  return {status: 'processed', orderId: order.orderId, correlationId};
}

async function handler(event) {
  const logger = createLogger(); const startedAt = Date.now();
  logger.info('order_processing_started', {metricName: 'orders_started', correlationId: event?.message?.attributes?.correlationId ?? null});
  try { const result = await legacyProcessOrderEvent(event, logger); logger.info('order_processing_finished', {metricName: 'orders_succeeded', orderId: result.orderId, durationMs: Date.now() - startedAt}); return result; }
  catch (error) { logger.error('order_processing_failed', {metricName: 'orders_failed', errorType: error.name, errorMessage: error.message, durationMs: Date.now() - startedAt}); throw error; }
}

module.exports = {decodePubSubEvent, handler, processOrderEvent: modern.processOrderEvent};
