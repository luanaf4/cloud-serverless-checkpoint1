const test = require('node:test');
const assert = require('node:assert/strict');

const {buildResponse, handler} = require('./index');

test('gera a resposta esperada', () => {
  assert.deepEqual(buildResponse(), {
    message: 'Serverless function is running.',
    status: 'ok',
  });
});

test('retorna uma resposta HTTP valida para o AWS Lambda', async () => {
  const response = await handler();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(response.body), buildResponse());
});
