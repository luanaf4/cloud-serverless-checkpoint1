'use strict';
function createEvent(eventType, data, {eventId = `evt-${Date.now()}`, correlationId, idempotencyKey} = {}) {
  return {eventId, eventType, schemaVersion: '1.0', occurredAt: new Date().toISOString(), source: 'orders.gcp', correlationId: correlationId || idempotencyKey || null, idempotencyKey: idempotencyKey || null, data};
}
function validateEvent(event) {
  if (!event || typeof event !== 'object') throw new Error('Evento inválido.');
  for (const field of ['eventId', 'eventType', 'schemaVersion', 'source', 'data']) if (!event[field]) throw new Error(`Evento sem ${field}.`);
  return event;
}
module.exports = {createEvent, validateEvent};
