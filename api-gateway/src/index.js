const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Rota de Teste Direto (Se essa abrir, o Gateway está vivo)
app.get('/', (req, res) => {
  res.send('<h1 style="color:green">🚀 MUDEX GATEWAY ONLINE!</h1><p>Se as outras rotas dão 502, o problema está nos microserviços, não aqui.</p>');
});

const proxyOptions = (target) => ({
  target: target,
  changeOrigin: true,
  timeout: 10000,
  proxyTimeout: 10000,
  onError: (err, req, res) => {
    console.error(`❌ Erro ao conectar em ${target}:`, err.message);
    res.status(502).json({ error: 'Serviço Offline', target });
  }
});

// Use os nomes EXATOS que aparecem no seu 'docker ps'
app.use('/api/auth', createProxyMiddleware(proxyOptions('http://mudex-auth-service:3001')));
app.use('/api/user', createProxyMiddleware(proxyOptions('http://mudex-user-service:3002')));
app.use('/api/ride', createProxyMiddleware(proxyOptions('http://mudex-ride-service:3003')));

app.listen(3000, () => console.log("✅ Gateway na porta 3000"));
