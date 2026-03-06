const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// ROTA DO FOGUETINHO (pra saber que o gateway está vivo)
app.get('/', (req, res) => {
  res.send('<h1 style="color:green; text-align:center; margin-top:100px; font-family:sans-serif;">🚀 MUDEX: O FOGUETINHO DA VITÓRIA ESTÁ ONLINE!</h1>');
});

// Configuração comum para os proxies
const createProxy = (target, prefix) => createProxyMiddleware({
  target: target,
  changeOrigin: true,
  logLevel: 'debug',           // ajuda muito a ver o que está acontecendo nos logs
  pathRewrite: (path) => {
    // Remove o prefixo (/api/auth ou /api/user)
    return path.replace(new RegExp(`^${prefix}`), '');
  },
  onProxyReq: (proxyReq, req) => {
    console.log(`→ Proxy: ${req.method} ${req.url} → ${target}${proxyReq.path}`);
  },
  onError: (err, req, res) => {
    console.error(`❌ ERRO NO PROXY para ${target}:`, err.message || err);
    res.status(502).json({
      error: 'Serviço temporariamente indisponível',
      service: target,
      message: 'Tente novamente em alguns instantes'
    });
  }
});

// Rotas dos microserviços
app.use('/api/auth', createProxy('http://mudex-auth-service:3001', '/api/auth'));
app.use('/api/user',  createProxy('http://mudex-user-service:3002', '/api/user'));

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`✅ Gateway Mudex rodando na porta ${PORT}`);
  console.log(`   → /api/auth  → mudex-auth-service:3001`);
  console.log(`   → /api/user   → mudex-user-service:3002`);
});
