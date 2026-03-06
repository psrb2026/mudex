const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// ROTA DO FOGUETINHO (Teste Principal)
app.get('/', (req, res) => {
  res.send('<h1 style="color:green; text-align:center; margin-top:100px;">🚀 MUDEX: O FOGUETINHO DA VITÓRIA ESTÁ ONLINE!</h1>');
});

// Configuração de Redirecionamento
const proxy = (target) => createProxyMiddleware({
  target: target,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '', '^/api/user': '' },
  onError: (err, req, res) => {
    res.status(502).json({ error: 'Serviço ainda carregando ou offline', service: target });
  }
});

// Ligando os serviços (Nomes do Docker Compose)
app.use('/api/auth', proxy('http://mudex-auth-service:3001'));
app.use('/api/user', proxy('http://mudex-user-service:3002'));

app.listen(3000, () => {
  console.log("✅ Gateway Mudex ativo na porta 3000");
});
