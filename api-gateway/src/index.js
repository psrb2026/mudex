const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// TESTE DE VIDA (Se abrir isso, a porta 3000 está OK)
app.get('/', (req, res) => {
  res.send('<h1 style="color:green; text-align:center; margin-top:100px;">🚀 MUDEX: GATEWAY ONLINE NA PORTA 3000!</h1>');
});

// Redirecionamento usando os nomes que o seu Docker reconhece
app.use('/api/auth', createProxyMiddleware({
  target: 'http://mudex-auth-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  onError: (err, req, res) => res.status(502).json({ error: 'Auth Service ainda offline' })
}));

app.use('/api/user', createProxyMiddleware({
  target: 'http://mudex-user-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/user': '' },
  onError: (err, req, res) => res.status(502).json({ error: 'User Service ainda offline' })
}));

app.listen(3000, () => console.log("✅ Gateway rodando!"));
