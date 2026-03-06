const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Rota do Foguetinho (Sempre online)
app.get('/', (req, res) => {
  res.send('<h1>🚀 MUDEX: O FOGUETINHO DA VITÓRIA ESTÁ ONLINE!</h1>');
});

// Configuração dos Proxies com os nomes REAIS dos containers
const proxy = (path, target) => app.use(path, createProxyMiddleware({
  target: target,
  changeOrigin: true,
  pathRewrite: { [`^${path}`]: '' },
  onError: (err, req, res) => res.status(502).json({ error: 'Serviço Offline', target })
}));

// Use os nomes que aparecem na coluna NAMES do seu docker ps
proxy('/api/auth', 'http://mudex-auth-service:3001');
proxy('/api/user', 'http://mudex-user-service:3002');
proxy('/api/rides', 'http://mudex-ride-service:3003');

app.listen(3000, () => console.log("✅ Gateway na porta 3000"));
