cat <<EOF > /workspaces/mudex/api-gateway/index.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.get('/', (req, res) => {
  res.send('<h1 style="color:green; text-align:center; margin-top:100px;">🚀 MUDEX: GATEWAY ONLINE!</h1>');
});

// User Service - Ajustado para garantir a barra inicial
app.use('/api/user', createProxyMiddleware({
  target: 'http://mudex-user-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/user': '/' }, // Note a barra aqui!
  logLevel: 'debug'
}));

// Auth Service
app.use('/api/auth', createProxyMiddleware({
  target: 'http://mudex-auth-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/' },
  logLevel: 'debug'
}));

app.listen(3000, () => console.log("✅ Gateway corrigido na porta 3000!"));
EOF
