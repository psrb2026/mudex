/**
 * API Gateway - Mudex (VERSÃO COMPLETA E INTEGRADA PARA DOCKER/CODESPACES)
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
// O Gateway lê a porta do .env ou usa a 3000 por padrão
const PORT = process.env.PORT || 3000;

// Middleware de segurança e performance
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev')); 
app.use(express.json());

/**
 * CONFIGURAÇÃO DE PROXIES (Usando variáveis de ambiente do seu .env)
 */

// 1. AUTH SERVICE
app.use('/api/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://mudex-auth-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Auth Service offline' })
}));

// 2. USER SERVICE
app.use(['/api/user', '/api/users'], createProxyMiddleware({
  target: process.env.USER_SERVICE_URL || 'http://mudex-user-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/user': '', '^/api/users': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'User Service offline' })
}));

// 3. RIDE SERVICE
app.use('/api/rides', createProxyMiddleware({
  target: process.env.RIDE_SERVICE_URL || 'http://mudex-ride-service:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/rides': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Ride Service offline' })
}));

// 4. DISPATCH SERVICE
app.use('/api/dispatch', createProxyMiddleware({
  target: process.env.DISPATCH_SERVICE_URL || 'http://mudex-dispatch-service:3004',
  changeOrigin: true,
  pathRewrite: { '^/api/dispatch': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Dispatch Service offline' })
}));

// 5. LOCATION SERVICE
app.use('/api/location', createProxyMiddleware({
  target: process.env.LOCATION_SERVICE_URL || 'http://mudex-location-service:3005',
  changeOrigin: true,
  pathRewrite: { '^/api/location': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Location Service offline' })
}));

// 6. PAYMENT SERVICE
app.use('/api/payments', createProxyMiddleware({
  target: process.env.PAYMENT_SERVICE_URL || 'http://mudex-payment-service:3006',
  changeOrigin: true,
  pathRewrite: { '^/api/payments': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Payment Service offline' })
}));

// 7. NOTIFICATION SERVICE
app.use('/api/notifications', createProxyMiddleware({
  target: process.env.NOTIFICATION_SERVICE_URL || 'http://mudex-notification-service:3007',
  changeOrigin: true,
  pathRewrite: { '^/api/notifications': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Notification Service offline' })
}));

// 8. ANALYTICS SERVICE
app.use('/api/analytics', createProxyMiddleware({
  target: process.env.ANALYTICS_SERVICE_URL || 'http://mudex-analytics-service:3008',
  changeOrigin: true,
  pathRewrite: { '^/api/analytics': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Analytics Service offline' })
}));

/**
 * ROTAS INTERNAS DO GATEWAY
 */

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'api-gateway',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send('🚀 Mudex API Gateway está Online e Roteando via Docker!');
});

app.listen(PORT, () => {
  console.log(`\x1b[32m%s\x1b[0m`, `🚀 Gateway Mudex rodando na porta ${PORT}`);
  console.log(`📡 Roteamento configurado para os microsserviços.`);
});
