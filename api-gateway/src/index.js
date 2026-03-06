const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = 3000;

// ROTA DO FOGUETINHO (Se essa abrir, a porta 3000 está VIVA!)
app.get('/', (req, res) => {
  res.send('<h1 style="color:green; text-align:center; margin-top:100px; font-family:sans-serif;">🚀 MUDEX: O FOGUETINHO DA VITÓRIA ESTÁ ONLINE!</h1>');
});

/**
 * CONFIGURAÇÃO DE PROXY
 * Usando os nomes EXATOS do seu docker-compose.yml
 */
const proxyOptions = (target) => ({
  target: target,
  changeOrigin: true,
  pathRewrite: { 
    '^/api/auth': '', 
    '^/api/user': '' 
  },
  onError: (err, req, res) => {
    console.error(`❌ Erro ao conectar em ${target}:`, err.message);
    res.status(502).json({ 
      error: 'Serviço Offline', 
      service: target,
      message: 'O Gateway não conseguiu falar com o microserviço.' 
    });
  }
});

// 1. Conecta com o container 'mudex-auth-service' na porta 3001
app.use('/api/auth', createProxyMiddleware(proxyOptions('http://mudex-auth-service:3001')));

// 2. Conecta com o container 'mudex-user-service' na porta 3002
app.use('/api/user', createProxyMiddleware(proxyOptions('http://mudex-user-service:3002')));

app.listen(PORT, () => {
  console.log(`✅ Gateway Mudex pronto na porta ${PORT}`);
  console.log(`🔗 Redirecionando /api/auth para mudex-auth-service:3001`);
  console.log(`🔗 Redirecionando /api/user para mudex-user-service:3002`);
});
