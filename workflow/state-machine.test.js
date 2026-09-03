'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {validateStateMachine} = require('./validate-state-machine');

const definition = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'state-machine.template.json'), 'utf8'),
);

test('defines a valid start state and terminal states', () => {
  assert.deepEqual(validateStateMachine(definition), []);
  assert.equal(definition.StartAt, 'ValidateInput');
  assert.equal(definition.States.OrderProcessed.Type, 'Succeed');
  assert.equal(definition.States.OrderFailed.Type, 'Fail');
});

test('enforces the order id as the idempotency key', () => {
  const state = definition.States.ValidateIdempotencyKey;

  assert.equal(state.Choices[0].Variable, '$.idempotencyKey');
  assert.equal(state.Choices[0].StringEqualsPath, '$.orderId');
  assert.equal(state.Choices[0].Next, 'ProcessOrder');
});

test('retries transient Lambda failures and routes final failure to the DLQ', () => {
  const state = definition.States.ProcessOrder;

  assert.equal(state.Retry[0].MaxAttempts, 3);
  assert.equal(state.Retry[0].BackoffRate, 2);
  assert.equal(state.Catch[0].Next, 'PublishDeadLetter');
  assert.equal(
    definition.States.PublishDeadLetter.Resource,
    'arn:aws:states:::sns:publish',
  );
});

test('detects the empty workflow error shown by AWS', () => {
  const errors = validateStateMachine({StartAt: '', States: {}});

  assert.match(errors.join(' '), /StartAt must not be empty/);
  assert.match(errors.join(' '), /States must not be empty/);
});
