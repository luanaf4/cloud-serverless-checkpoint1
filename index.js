function buildResponse() {
  return {
    message: 'Serverless function is running.',
    status: 'ok',
  };
}

async function handler() {
  return {
    statusCode: 200,
    headers: {'content-type': 'application/json'},
    body: JSON.stringify(buildResponse()),
  };
}

module.exports = {buildResponse, handler};
