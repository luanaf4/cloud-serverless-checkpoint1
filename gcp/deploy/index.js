'use strict';

exports.handler = async (event) => {
  const startedAt = Date.now();
  const message = event?.data?.message ?? event?.message;
  const encoded = message?.data
    ?? (typeof event?.data === 'string' ? event.data : null);
  const correlationId = message?.attributes?.correlationId
    ?? null;
  let orderId = null;
  try {
    if (!encoded) throw new Error('Pub/Sub message.data is required.');
    const order = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    orderId = order?.orderId ?? null;
    const base = {orderId, correlationId};
    console.log(JSON.stringify({severity: 'INFO', event: 'order_processing_started', metricName: 'orders_started', ...base}));
    if (typeof orderId !== 'string' || !orderId.trim()) throw new Error('orderId is required.');
    console.log(JSON.stringify({severity: 'INFO', event: 'order_processed', metricName: 'orders_processed', result: 'success', durationMs: Date.now() - startedAt, ...base}));
    return {status: 'processed', ...base};
  } catch (error) {
    console.log(JSON.stringify({severity: 'ERROR', event: 'order_processing_failed', metricName: 'orders_failed', errorType: error.name, errorMessage: error.message, durationMs: Date.now() - startedAt, orderId, correlationId}));
    throw error;
  }
};
