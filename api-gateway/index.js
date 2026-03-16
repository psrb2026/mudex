const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

app.get('/', (req, res) => {
  res.send('<h1 style="color:green; text-align:center; margin-top:50px;">🚀 MUDEX: GATEWAY ONLINE!</h1>');
});

app.use('/api/user', createProxyMiddleware({
  target: 'http://user-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/user': '' },
  onError: (err, req, res) => {
    res.status(502).json({ error: 'Gateway não conectou ao User Service na 3002' });
  }
}));

app.use('/api/location', createProxyMiddleware({
  target: 'http://location-service:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/location': '' },
  onError: (err, req, res) => {
    res.status(502).json({ error: 'Gateway não conectou ao Location Service na 3003' });
  }
}));

app.listen(3000, '0.0.0.0', () => console.log('✅ Gateway na 3000'));
