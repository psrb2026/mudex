const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Rota de Teste (O Foguetinho)
app.get('/', (req, res) => {
  res.send('<h1>🚀 Mudex API Gateway: O FOGUETINHO DA VITÓRIA ESTÁ ONLINE!</h1>');
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Sistema pronto' });
});

// Ligação com o Auth Service (Usando o nome mudex-auth-service)
app.use('/api/auth', createProxyMiddleware({
  target: 'http://mudex-auth-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  onError: (err, req, res) => res.status(502).json({ error: 'Erro: O serviço ainda está ligando...' })
}));

app.listen(3000, () => {
  console.log('✅ Gateway Ligado!');
});
