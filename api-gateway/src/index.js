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

function createServiceProxy(route, target, name) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: { [`^${route}`]: '' },
    onError: (err, req, res) => {
      console.error(`❌ ${name} error:`, err.message);
      res.status(502).json({ error: `${name} offline`, details: err.message });
    }
  });
}

// AUTH SERVICE
app.use('/api/auth',
  createServiceProxy('/api/auth', process.env.AUTH_SERVICE_URL, 'Auth Service')
);

// USER SERVICE
app.use(['/api/user', '/api/users'],
  createServiceProxy('/api/user', process.env.USER_SERVICE_URL, 'User Service')
);

// RIDE SERVICE
app.use('/api/rides',
  createServiceProxy('/api/rides', process.env.RIDE_SERVICE_URL, 'Ride Service')
);

// DISPATCH SERVICE
app.use('/api/dispatch',
  createServiceProxy('/api/dispatch', process.env.DISPATCH_SERVICE_URL, 'Dispatch Service')
);

// LOCATION SERVICE
app.use('/api/location',
  createServiceProxy('/api/location', process.env.LOCATION_SERVICE_URL, 'Location Service')
);

// PAYMENT SERVICE
app.use('/api/payments',
  createServiceProxy('/api/payments', process.env.PAYMENT_SERVICE_URL, 'Payment Service')
);

// NOTIFICATION SERVICE
app.use('/api/notifications',
  createServiceProxy('/api/notifications', process.env.NOTIFICATION_SERVICE_URL, 'Notification Service')
);

// ANALYTICS SERVICE
app.use('/api/analytics',
  createServiceProxy('/api/analytics', process.env.ANALYTICS_SERVICE_URL, 'Analytics Service')
);

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
  console.log(`🚀 Gateway Mudex rodando na porta ${PORT}`);
});
