/**
 * Analytics Service - Mudex
 * Coleta métricas em tempo real, gera heatmaps e previsão de demanda.
 */

require('dotenv').config();

const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const redis = require('redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'analytics-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/analytics-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/analytics-combined.log' })
  ]
});

const app = express();
app.use(express.json());

// Variáveis globais
let redisClient;
let sequelize;
let Metric;
let HourlyAggregate;

// Lógica de inicialização com Retry (Para não travar se o Docker estiver subindo)
const initSystems = async () => {
  try {
    // 1. Conexão Redis
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    redisClient.on('error', (err) => logger.error('Erro no Redis Client:', err));
    await redisClient.connect();
    logger.info('Redis conectado com sucesso');

    // 2. Conexão PostgreSQL (usando DB_NAME_PREFIX do seu .env ou DB_NAME)
    const dbName = process.env.DB_NAME || `${process.env.DB_NAME_PREFIX}_analytics` || 'mudex_analytics';
    
    sequelize = new Sequelize(
      dbName,
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || '',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        retry: { max: 10 } // Tenta reconectar 10 vezes antes de falhar
      }
    );

    await sequelize.authenticate();
    logger.info(`PostgreSQL conectado ao banco: ${dbName}`);

    // Definição de Modelos
    defineModels();

    // Sincroniza Tabelas
    await sequelize.sync();
    logger.info('Modelos sincronizados com o banco de dados');

    startServer();

  } catch (err) {
    logger.error('Falha na inicialização. Tentando novamente em 5 segundos...', err);
    setTimeout(initSystems, 5000);
  }
};

function defineModels() {
  Metric = sequelize.define('Metric', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    metric_type: {
      type: DataTypes.ENUM('ride_requested', 'ride_completed', 'ride_cancelled', 'driver_online', 'driver_offline', 'revenue', 'surge_applied'),
      allowNull: false
    },
    value: { type: DataTypes.DECIMAL(15, 2), defaultValue: 1 },
    geohash: { type: DataTypes.STRING(12), index: true },
    metadata: { type: DataTypes.JSONB },
    timestamp: { type: DataTypes.DATE, defaultValue: Sequelize.NOW, index: true }
  }, { tableName: 'metrics', timestamps: false });

  HourlyAggregate = sequelize.define('HourlyAggregate', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    hour: { type: DataTypes.DATE, allowNull: false },
    geohash: { type: DataTypes.STRING(6), allowNull: false },
    total_rides: { type: DataTypes.INTEGER, defaultValue: 0 },
    completed_rides: { type: DataTypes.INTEGER, defaultValue: 0 },
    cancelled_rides: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_revenue: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    drivers_online: { type: DataTypes.INTEGER, defaultValue: 0 }
  }, { 
    tableName: 'hourly_aggregates', 
    indexes: [{ unique: true, fields: ['hour', 'geohash'] }] 
  });
}

// Funções Auxiliares
function encodeGeohash(latitude, longitude, precision = 5) {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let idx = 0, bit = 0, evenBit = true, geohash = '';
  let latRange = [-90.0, 90.0], lonRange = [-180.0, 180.0];
  while (geohash.length < precision) {
    const val = evenBit ? longitude : latitude;
    const range = evenBit ? lonRange : latRange;
    const mid = (range[0] + range[1]) / 2;
    if (val >= mid) { idx = (idx << 1) + 1; range[0] = mid; } 
    else { idx = idx << 1; range[1] = mid; }
    evenBit = !evenBit;
    if (bit < 4) { bit++; } 
    else { geohash += BASE32[idx]; bit = 0; idx = 0; }
  }
  return geohash;
}

function startServer() {
  // Endpoints
  app.get('/dashboard/realtime', async (req, res) => {
    try {
      const stats = {
        active_rides: await redisClient.get('stats:active_rides') || 0,
        online_drivers: await redisClient.sCard('drivers:active') || 0,
        today_revenue: await redisClient.get('stats:today_revenue') || 0
      };
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/health', (req, res) => {
    res.json({ 
      status: 'OK', 
      service: 'analytics-service',
      db: sequelize ? 'connected' : 'error',
      redis: redisClient?.isReady ? 'connected' : 'error'
    });
  });

  const PORT = process.env.ANALYTICS_PORT || 3008;
  app.listen(PORT, () => {
    logger.info(`Analytics Service rodando na porta ${PORT}`);
  });
}

// Iniciar o sistema
initSystems();