const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// Função para criar proxies robustos
const setupProxy = (path, target) => {
  return createProxyMiddleware({
    target: target,
    changeOrigin: true,
    pathRewrite: { [`^${path}`]: '' },
    onError: (err, req, res) => {
      console.error(`❌ Erro no Proxy para ${target}:`, err.message);
      res.status(502).json({ error: 'Serviço temporariamente indisponível no backend.' });
    }
  });
};

// ROTAS (Conectando aos Aliases do Docker)
app.use('/api/auth', setupProxy('/api/auth', process.env.AUTH_SERVICE_URL || 'http://auth-service:3001'));
app.use('/api/user', setupProxy('/api/user', process.env.USER_SERVICE_URL || 'http://user-service:3002'));

// ROTA DO FOGUETINHO (Para teste direto no navegador)
app.get('/', (req, res) => {
  res.send('<h1>🚀 Mudex API Gateway: SISTEMA ONLINE E INTEGRADO!</h1>');
});

app.listen(PORT, () => {
  console.log(`✅ Gateway rodando na porta ${PORT}`);
});
