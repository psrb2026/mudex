/**
 * API Gateway - Mudex (VERSÃO CORRIGIDA PARA DOCKER COMPOSE)
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());

// Função auxiliar para criar o proxy com o nome correto do container
function createMudexProxy(route, envUrl, fallbackUrl, serviceName) {
  return createProxyMiddleware({
    target: envUrl || fallbackUrl,
    changeOrigin: true,
    pathRewrite: { [`^${route}`]: '' },
    onError: (err, req, res) => {
      console.error(`❌ ${serviceName} offline:`, err.message);
      res.status(502).json({ error: `${serviceName} inacessível via Gateway` });
    }
  });
}

// CONFIGURAÇÃO DE PROXIES (Usando os nomes definidos no container_name)
app.use('/api/auth', createMudexProxy('/api/auth', process.env.AUTH_SERVICE_URL, 'http://mudex-auth-service:3001', 'Auth Service'));
app.use(['/api/user', '/api/users'], createMudexProxy('/api/user', process.env.USER_SERVICE_URL, 'http://mudex-user-service:3002', 'User Service'));
app.use('/api/rides', createMudexProxy('/api/rides', process.env.RIDE_SERVICE_URL, 'http://mudex-ride-service:3003', 'Ride Service'));
app.use('/api/dispatch', createMudexProxy('/api/dispatch', process.env.DISPATCH_SERVICE_URL, 'http://mudex-dispatch-service:3004', 'Dispatch Service'));
app.use('/api/location', createMudexProxy('/api/location', process.env.LOCATION_SERVICE_URL, 'http://mudex-location-service:3005', 'Location Service'));
app.use('/api/payments', createMudexProxy('/api/payments', process.env.PAYMENT_SERVICE_URL, 'http://mudex-payment-service:3006', 'Payment Service'));
app.use('/api/notifications', createMudexProxy('/api/notifications', process.env.NOTIFICATION_SERVICE_URL, 'http://mudex-notification-service:3007', 'Notification Service'));
app.use('/api/analytics', createMudexProxy('/api/analytics', process.env.ANALYTICS_SERVICE_URL, 'http://mudex-analytics-service:3008', 'Analytics Service'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'api-gateway', mode: 'docker-internal' });
});

app.get('/', (req, res) => {
  res.send('🚀 Mudex API Gateway está Online e Blindado!');
});

app.listen(PORT, () => {
  console.log(`🚀 Gateway Mudex rodando na porta ${PORT}`);
});
