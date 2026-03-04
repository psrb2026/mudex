require('dotenv').config();
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

// Função ajustada para Codespaces/Docker
function createServiceProxy(route, target, name) {
  return createProxyMiddleware({
    target: target || `http://mudex-${name.toLowerCase().replace(' ', '-')}:3001`, // Plano B
    changeOrigin: true,
    pathRewrite: { [`^${route}`]: '' },
    onProxyReq: (proxyReq, req, res) => {
        console.log(`✈️ Roteando: ${req.method} ${req.url} -> ${name}`);
    },
    onError: (err, req, res) => {
      console.error(`❌ ${name} error:`, err.message);
      res.status(502).json({ error: `${name} offline ou inacessível`, details: err.message });
    }
  });
}

// ROTEAMENTO COM URLS FIXAS DO DOCKER (Para evitar erro 502)
app.use('/api/auth', createServiceProxy('/api/auth', process.env.AUTH_SERVICE_URL || 'http://mudex-auth-service:3001', 'Auth Service'));
app.use(['/api/user', '/api/users'], createServiceProxy('/api/user', process.env.USER_SERVICE_URL || 'http://mudex-user-service:3002', 'User Service'));
app.use('/api/location', createServiceProxy('/api/location', process.env.LOCATION_SERVICE_URL || 'http://mudex-location-service:3005', 'Location Service'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'api-gateway', docker: 'active' });
});

app.get('/', (req, res) => {
  res.send('🚀 Mudex API Gateway está Online e Blindado!');
});

app.listen(PORT, () => {
  console.log(`🚀 Gateway Mudex rodando na porta ${PORT}`);
});
