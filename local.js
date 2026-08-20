const http = require('node:http');
const {handler} = require('./index');

const port = Number(process.env.PORT || 8080);

const server = http.createServer(async (_req, res) => {
  const response = await handler();
  res.writeHead(response.statusCode, response.headers);
  res.end(response.body);
});

server.listen(port, () => {
  console.log(`Function available at http://localhost:${port}`);
});
