'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {decodePubSubEvent, processOrderEvent} = require('./process-order');
const {createLogger} = require('./observability');
const {createEvent, validateEvent} = require('./event-contracts');
const {createVertexAIProvider, mockEnrich, validateAIResult} = require('./ai');
const {createPublisher} = require('./pubsub');

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
    mockEnrich,
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

test('processes a valid order through the AI contract and emits an event', async () => {
  const logger = createLogger({write: () => {}});
  const aiProvider = async () => ({riskLevel: 'low', decision: 'approve', reason: 'ok', modelVersion: 'test-model'});
  const result = await processOrderEvent(eventFor({orderId: 'order-ai-001'}, {correlationId: 'corr-ai-001'}), logger, aiProvider);

  assert.equal(result.ai.decision, 'approve');
  assert.equal(result.outputEvent.eventType, 'OrderAIEnriched');
  assert.equal(result.outputEvent.data.ai.modelVersion, 'test-model');
  assert.doesNotThrow(() => validateEvent(result.outputEvent));
});

test('rejects an AI response outside the contract', () => {
  assert.throws(() => validateAIResult({decision: 'approve'}), /riskLevel/);
  assert.throws(() => validateAIResult({riskLevel: 'low', decision: 'approve'}), /justificativa/);
});

test('creates versioned event envelopes', () => {
  const event = createEvent('OrderReceived', {orderId: 'order-003'}, {idempotencyKey: 'order-003'});
  assert.equal(event.schemaVersion, '1.0');
  assert.equal(event.correlationId, 'order-003');
  assert.equal(event.source, 'orders.gcp');
});

test('Vertex provider calls the managed model without storing credentials', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({url, options});
    return {ok: true, status: 200, json: async () => ({candidates: [{content: {parts: [{text: '{"riskLevel":"low","decision":"approve","reason":"ok"}'}]}}]})};
  };
  const provider = createVertexAIProvider({fetchImpl, accessToken: 'runtime-token', projectId: 'demo-project'});
  const result = await provider({orderId: 'order-vertex-001', quantity: 1});

  assert.equal(result.decision, 'approve');
  assert.match(calls[0].url, /aiplatform\.googleapis\.com/);
  assert.equal(calls[0].options.headers.authorization, 'Bearer runtime-token');
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, 'ai.js'), 'utf8'), /AIza|BEGIN .*PRIVATE KEY/);
});

test('publishes the AI output event to Pub/Sub without a stored key', async () => {
  const calls = [];
  const publisher = createPublisher({
    projectId: 'demo-project',
    topic: 'orders-ai-output',
    tokenProvider: async () => 'runtime-token',
    fetchImpl: async (url, options) => {
      calls.push({url, options});
      return {ok: true, status: 200, json: async () => ({messageIds: ['1']})};
    },
  });
  const event = createEvent('OrderAIEnriched', {orderId: 'order-pub-001'}, {correlationId: 'corr-pub-001'});
  await publisher(event);
  assert.match(calls[0].url, /pubsub\.googleapis\.com/);
  assert.equal(calls[0].options.headers.authorization, 'Bearer runtime-token');
  assert.match(calls[0].options.body, /OrderAIEnriched/);
});
