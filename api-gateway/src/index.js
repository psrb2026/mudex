/**
 * API Gateway - Mudex (VERSÃO COMPLETA E INTEGRADA)
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware de segurança e performance
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev')); // Log de requisições no terminal
app.use(express.json());

/**
 * CONFIGURAÇÃO DE PROXIES (Encaminhamento de chamadas)
 * Cada bloco abaixo "escuta" uma rota e manda para o serviço correto.
 */

// 1. AUTH SERVICE (Porta 3001)
app.use('/api/auth', createProxyMiddleware({
  target: 'http://localhost:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Auth Service offline' })
}));

// 2. USER SERVICE (Porta 3002)
app.use(['/api/user', '/api/users'], createProxyMiddleware({
  target: 'http://localhost:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/user': '', '^/api/users': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'User Service offline' })
}));

// 3. RIDE SERVICE (Porta 3003)
app.use('/api/rides', createProxyMiddleware({
  target: 'http://localhost:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/rides': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Ride Service offline' })
}));

// 4. DISPATCH SERVICE (Porta 3004)
app.use('/api/dispatch', createProxyMiddleware({
  target: 'http://localhost:3004',
  changeOrigin: true,
  pathRewrite: { '^/api/dispatch': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Dispatch Service offline' })
}));

// 5. LOCATION SERVICE (Porta 3005)
app.use('/api/location', createProxyMiddleware({
  target: 'http://localhost:3005',
  changeOrigin: true,
  pathRewrite: { '^/api/location': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Location Service offline' })
}));

// 6. PAYMENT SERVICE (Porta 3006)
app.use('/api/payments', createProxyMiddleware({
  target: 'http://localhost:3006',
  changeOrigin: true,
  pathRewrite: { '^/api/payments': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Payment Service offline' })
}));

// 7. NOTIFICATION SERVICE (Porta 3007)
app.use('/api/notifications', createProxyMiddleware({
  target: 'http://localhost:3007',
  changeOrigin: true,
  pathRewrite: { '^/api/notifications': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Notification Service offline' })
}));

// 8. ANALYTICS SERVICE (Porta 3008)
app.use('/api/analytics', createProxyMiddleware({
  target: 'http://localhost:3008',
  changeOrigin: true,
  pathRewrite: { '^/api/analytics': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Analytics Service offline' })
}));

/**
 * ROTAS INTERNAS DO GATEWAY
 */

// Health check para monitoramento
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

// Rota raiz para teste rápido
app.get('/', (req, res) => {
  res.send('🚀 Mudex API Gateway está Online e Roteando!');
});

app.listen(PORT, () => {
  console.log(`\x1b[32m%s\x1b[0m`, `🚀 Gateway Mudex rodando em http://localhost:${PORT}`);
  console.log(`📡 Roteamento ativo para todos os microsserviços.`);
});