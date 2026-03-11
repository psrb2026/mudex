/**
 * User Service - Mudex
 * Gerencia perfis de clientes e motoristas, documentos, avaliações
 */

require('dotenv').config(); // ✅ ESSENCIAL

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const winston = require('winston');

// Configuração de Logs
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/user-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/user-combined.log' })
  ]
});

const app = express();
app.use(express.json());

/**
 * 🔥 VALIDAÇÃO DAS VARIÁVEIS
 */
const requiredEnvVars = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_DIALECT'];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    console.error(`❌ Variável obrigatória ausente: ${envVar}`);
    process.exit(1);
  }
});

/**
 * ✅ Conexão com PostgreSQL
 */
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    dialect: process.env.DB_DIALECT,
    logging: msg => logger.debug(msg)
  }
);

/**
 * 👤 MODELO DE USUÁRIO (Tabela 'users')
 */
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

/**
 * 🚀 ROTA DE REGISTRO
 */
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Verifica se usuário já existe
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    // Cria o usuário
    const user = await User.create({ name, email, password });
    
    logger.info(`✅ Novo usuário registrado: ${email}`);
    
    // Retorna o usuário (idealmente sem a senha)
    const userResponse = user.toJSON();
    delete userResponse.password;
    
    res.status(201).json(userResponse);
  } catch (error) {
    logger.error('❌ Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno ao salvar usuário.' });
  }
});

/**
 * 🏥 ROTA DE HEALTH CHECK
 */
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ 
      status: 'OK', 
      service: 'user-service', 
      database: 'connected' 
    });
  } catch (error) {
    res.status(500).json({ status: 'Error', database: 'disconnected' });
  }
});

/**
 * 🏁 INICIALIZAÇÃO
 */
const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    // Sincroniza o banco de dados (cria as tabelas se não existirem)
    await sequelize.sync();
    logger.info('📦 Banco de dados sincronizado!');
    
    app.listen(PORT, () => {
      logger.info(`👤 User Service rodando na porta ${PORT}`);
      console.log(`🚀 Mudex User Service: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('❌ Falha ao iniciar o servidor:', error);
  }
}

startServer();
