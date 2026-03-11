cat <<EOF > /workspaces/mudex/api-gateway/index.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

app.get('/', (req, res) => {
  res.send('<h1 style="color:green; text-align:center; margin-top:100px;">🚀 MUDEX: GATEWAY ONLINE!</h1>');
});

// Redireciona para o Auth Service na porta 3000 interna do container
app.use('/api/auth', createProxyMiddleware({
  target: 'http://mudex-auth-service:3000', 
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  onError: (err, req, res) => {
    res.status(502).json({ error: 'Auth Service indisponível no momento' });
  }
}));

// Redireciona para o User Service na porta 3000 interna do container
app.use('/api/user', createProxyMiddleware({
  target: 'http://mudex-user-service:3000',
  changeOrigin: true,
  pathRewrite: { '^/api/user': '' },
  onError: (err, req, res) => {
    res.status(502).json({ error: 'User Service indisponível no momento' });
  }
}));

const PORT = 3000;
app.listen(PORT, () => {
  console.log(\`✅ Gateway Mudex sintonizado na porta \${PORT}\`);
});
EOF
