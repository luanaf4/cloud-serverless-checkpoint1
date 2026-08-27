'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {decodeOrder, handler, processSnsEvent} = require('./index');

function createSnsRecord(payload, overrides = {}) {
  return {
    EventSource: 'aws:sns',
    EventSubscriptionArn: 'arn:aws:sns:us-east-1:000000000000:orders:subscription',
    Sns: {
      Message: JSON.stringify(payload),
      MessageId: 'message-123',
      TopicArn: 'arn:aws:sns:us-east-1:000000000000:orders',
      Timestamp: '2026-08-27T12:00:00.000Z',
      ...overrides,
    },
  };
}

test('decodifica um pedido publicado no SNS', () => {
  const record = createSnsRecord({
    orderId: 'order-001',
    product: 'Notebook',
    quantity: 1,
  });

  assert.deepEqual(decodeOrder(record), {
    orderId: 'order-001',
    product: 'Notebook',
    quantity: 1,
  });
});

test('processa os registros e gera logs estruturados', async () => {
  const logs = [];
  const logger = {log: (entry) => logs.push(JSON.parse(entry))};
  const event = {
    Records: [
      createSnsRecord({orderId: 'order-002'}),
      createSnsRecord({orderId: 'order-003'}, {MessageId: 'message-456'}),
    ],
  };

  const result = await processSnsEvent(event, logger);

  assert.equal(result.status, 'processed');
  assert.equal(result.processedRecords, 2);
  assert.deepEqual(result.orders.map((order) => order.orderId), [
    'order-002',
    'order-003',
  ]);
  assert.equal(logs.length, 2);
  assert.equal(logs[0].severity, 'INFO');
  assert.equal(logs[0].orderId, 'order-002');
  assert.equal(logs[1].messageId, 'message-456');
});

test('exporta o handler esperado pela AWS Lambda', async () => {
  const result = await handler({
    Records: [createSnsRecord({orderId: 'order-handler'})],
  });

  assert.equal(result.processedRecords, 1);
  assert.equal(result.orders[0].orderId, 'order-handler');
});

test('rejeita um evento sem registros do SNS', async () => {
  await assert.rejects(() => processSnsEvent({}), /nao contem registros do SNS/);
});

test('rejeita um pedido sem orderId', () => {
  const record = createSnsRecord({product: 'Mouse'});

  assert.throws(() => decodeOrder(record), /orderId valido/);
});

test('rejeita conteudo que nao seja JSON valido', () => {
  const record = createSnsRecord(
    {orderId: 'ignored'},
    {Message: 'not-json'},
  );

  assert.throws(() => decodeOrder(record), /JSON valido/);
});

test('rejeita registros que nao sejam do SNS', () => {
  assert.throws(() => decodeOrder({EventSource: 'aws:sqs'}), /Amazon SNS/);
});
