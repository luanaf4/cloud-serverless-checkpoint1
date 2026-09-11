'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {decodePubSubEvent, processOrderEvent} = require('./process-order');
const {createLogger} = require('./observability');

function eventFor(order, attributes = {}) {
  return {
    message: {
      data: Buffer.from(JSON.stringify(order)).toString('base64'),
      attributes,
    },
  };
}

test('decodes a Pub/Sub order event', () => {
  assert.deepEqual(decodePubSubEvent(eventFor({orderId: 'order-001'})), {
    orderId: 'order-001',
  });
});

test('rejects malformed or invalid Pub/Sub messages', () => {
  assert.throws(() => decodePubSubEvent({}), /message.data/);
  assert.throws(() => decodePubSubEvent(eventFor({})), /orderId/);
});

test('emits structured observability data and returns a processed order', async () => {
  const lines = [];
  const logger = createLogger({write: (line) => lines.push(JSON.parse(line))});
  const result = await processOrderEvent(
    eventFor({orderId: 'order-002'}, {correlationId: 'corr-002'}),
    logger,
  );

  assert.equal(result.status, 'processed');
  assert.equal(lines[0].event, 'order_processed');
  assert.equal(lines[0].severity, 'INFO');
  assert.equal(lines[0].correlationId, 'corr-002');
  assert.equal(logger.metrics().orders_processed, 1);
});

test('keeps the GCP workflow free of real endpoints and credentials', () => {
  const workflow = fs.readFileSync(path.join(__dirname, 'workflow.yaml'), 'utf8');

  assert.match(workflow, /ORDERS_TOPIC/);
  assert.match(workflow, /DEAD_LETTER_TOPIC/);
  assert.doesNotMatch(workflow, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(workflow, /-----BEGIN .*PRIVATE KEY-----/);
});
