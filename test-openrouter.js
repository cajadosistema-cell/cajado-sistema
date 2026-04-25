const https = require('https');

const data = JSON.stringify({
  model: 'openai/gpt-4o-mini',
  messages: [{ role: 'user', content: 'Bom dia' }],
  max_tokens: 10
});

const req = https.request('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer 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',
    'Content-Type': 'application/json'
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
  console.error(`Problem: ${e.message}`);
});

req.write(data);
req.end();
