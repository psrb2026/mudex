/**
 * Ride Service - Mudex
 * Gerencia o ciclo de vida completo das corridas
 */

require('dotenv').config(); // ✅ ESSENCIAL PARA LER O .ENV

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const { Sequelize } = require('sequelize');

const app = express();
const PORT = process.env.PORT || 3003;

/**
 * Middleware de segurança e performance
 */
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());

/**
 * Validação obrigatória de variáveis de ambiente
 */
const requiredEnvVars = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'DB_DIALECT'
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Variável de ambiente obrigatória ausente: ${envVar}`);
    process.exit(1);
  }
});

/**
 * Configuração do Sequelize
 */
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    dialect: process.env.DB_DIALECT,
    logging: false
  }
);

/**
 * Teste de conexão com o banco
 */
async function connectDatabase() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao PostgreSQL com sucesso.');
  } catch (error) {
    console.error('❌ Erro ao conectar no PostgreSQL:', error.message);
    process.exit(1);
  }
}

/**
 * Rotas internas
 */
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({
      status: 'OK',
      service: 'ride-service',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      service: 'ride-service',
      database: 'disconnected'
    });
  }
});

app.get('/', (req, res) => {
  res.send('🚗 Ride Service Mudex está Online!');
});

/**
 * Inicialização do servidor
 */
async function startServer() {
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`🚗 Ride Service rodando na porta ${PORT}`);
  });
}

startServer();
