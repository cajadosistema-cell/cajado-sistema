const http = require('http');

const data = JSON.stringify({
  prompt: 'Bom dia',
  context: '',
  systemInstruction: 'Você é um assistente.'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/openrouter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log(`Body: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
