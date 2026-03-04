/**
 * API Gateway - Mudex (VERSÃO FINAL - COPIAR E COLAR)
 */

// 1. CARREGA AS VARIÁVEIS DO .ENV (ESSENCIAL)
require('dotenv').config();

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
app.use(morgan('dev')); 
app.use(express.json());

/**
 * CONFIGURAÇÃO DE PROXIES
 * Ajustado para os nomes reais dos seus serviços no Docker
 */

// 1. AUTH SERVICE
app.use('/api/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Auth Service offline' })
}));

// 2. USER SERVICE
app.use(['/api/user', '/api/users'], createProxyMiddleware({
  target: process.env.USER_SERVICE_URL || 'http://user-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/user': '', '^/api/users': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'User Service offline' })
}));

// 3. RIDE SERVICE
app.use('/api/rides', createProxyMiddleware({
  target: process.env.RIDE_SERVICE_URL || 'http://ride-service:3003',
  changeOrigin: true,
  pathRewrite: { '^/api/rides': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Ride Service offline' })
}));

// 4. DISPATCH SERVICE
app.use('/api/dispatch', createProxyMiddleware({
  target: process.env.DISPATCH_SERVICE_URL || 'http://dispatch-service:3004',
  changeOrigin: true,
  pathRewrite: { '^/api/dispatch': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Dispatch Service offline' })
}));

// 5. LOCATION SERVICE (Confirmado como 'location-service' no seu Docker)
app.use('/api/location', createProxyMiddleware({
  target: process.env.LOCATION_SERVICE_URL || 'http://location-service:3005',
  changeOrigin: true,
  pathRewrite: { '^/api/location': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Location Service offline' })
}));

// 6. PAYMENT SERVICE
app.use('/api/payments', createProxyMiddleware({
  target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006',
  changeOrigin: true,
  pathRewrite: { '^/api/payments': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Payment Service offline' })
}));

// 7. NOTIFICATION SERVICE
app.use('/api/notifications', createProxyMiddleware({
  target: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007',
  changeOrigin: true,
  pathRewrite: { '^/api/notifications': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Notification Service offline' })
}));

// 8. ANALYTICS SERVICE
app.use('/api/analytics', createProxyMiddleware({
  target: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3008',
  changeOrigin: true,
  pathRewrite: { '^/api/analytics': '' },
  onError: (err, req, res) => res.status(503).json({ error: 'Analytics Service offline' })
}));

/**
 * ROTAS INTERNAS
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
