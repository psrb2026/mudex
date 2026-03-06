const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// O FOGUETINHO DA VITÓRIA
app.get('/', (req, res) => {
  res.send('<h1>🚀 Mudex API Gateway: O FOGUETINHO DA VITÓRIA ESTÁ ONLINE!</h1>');
});

// TESTE DE CONEXÃO
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Porteiro está de pé!' });
});

// REDIRECIONAMENTO (O segredo é o nome 'mudex-auth-service')
app.use('/api/auth', createProxyMiddleware({
  target: 'http://mudex-auth-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  onError: (err, req, res) => res.status(502).json({ error: 'Quase lá! O porteiro ligou mas o Auth Service não atendeu.' })
}));

app.listen(3000, () => {
  console.log('✅ Porteiro pronto na porta 3000');
});
