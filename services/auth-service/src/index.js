/**
 * Auth Service - Mudex
 * Gerencia autenticação, registro, tokens JWT e refresh tokens
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');
const Joi = require('joi');
const winston = require('winston');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');

// Logger configurado
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'auth-service' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/auth-combined.log' })
  ]
});

const app = express();
app.use(express.json());

// Conexão com PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'mudex_auth',
  process.env.DB_USER || 'mudex',
  process.env.DB_PASSWORD || 'mudex123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: msg => logger.debug(msg),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

// Modelo de Usuário (tabela central de autenticação)
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: { isEmail: true }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  phone: {
    type: DataTypes.STRING(20),
    unique: true
  },
  user_type: {
    type: DataTypes.ENUM('customer', 'driver', 'admin'),
    allowNull: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  is_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  last_login: {
    type: DataTypes.DATE
  },
  failed_login_attempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  locked_until: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true
});

// Modelo de Refresh Token
const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  token: {
    type: DataTypes.TEXT,
    allowNull: false,
    unique: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  is_revoked: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  device_info: {
    type: DataTypes.JSONB
  }
}, {
  tableName: 'refresh_tokens',
  timestamps: true,
  underscored: true
});

// Redis client para blacklist de tokens
let redisClient;
(async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    redisClient.on('error', err => logger.error('Redis Client Error', err));
    await redisClient.connect();
    logger.info('Conectado ao Redis');
  } catch (err) {
    logger.error('Erro ao conectar Redis:', err);
  }
})();

// Schemas de validação Joi
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
    .messages({
      'string.pattern.base': 'Senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número'
    }),
  phone: Joi.string().pattern(/^\+?[\d\s-()]+$/).required(),
  user_type: Joi.string().valid('customer', 'driver').required(),
  first_name: Joi.string().min(2).max(100).required(),
  last_name: Joi.string().min(2).max(100).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  device_info: Joi.object({
    device_id: Joi.string(),
    platform: Joi.string().valid('ios', 'android', 'web'),
    app_version: Joi.string()
  }).optional()
});

// Helper para gerar tokens
const generateTokens = async (user, deviceInfo = {}) => {
  const payload = {
    userId: user.id,
    email: user.email,
    userType: user.user_type,
    jti: uuidv4() // JWT ID único para revogação
  };

  // Access token (curta duração: 15 minutos)
  const accessToken = jwt.sign(
    payload,
    process.env.JWT_SECRET || 'mudex-secret-key',
    { expiresIn: '15m' }
  );

  // Refresh token (longa duração: 7 dias)
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || 'mudex-refresh-secret',
    { expiresIn: '7d' }
  );

  // Salva refresh token no banco
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await RefreshToken.create({
    user_id: user.id,
    token: refreshToken,
    expires_at: expiresAt,
    device_info: deviceInfo
  });

  return { accessToken, refreshToken, expiresIn: 900 }; // 900 segundos = 15 min
};

// Registro de usuário
app.post('/register', async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, phone, user_type, first_name, last_name } = value;

    // Verifica se email já existe
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha (bcrypt com salt rounds 12)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Cria usuário em transação
    const result = await sequelize.transaction(async (t) => {
      const user = await User.create({
        email,
        password_hash: passwordHash,
        phone,
        user_type
      }, { transaction: t });

      // Publica evento para outros serviços criarem perfis específicos
      // (implementação real usaria RabbitMQ)
      logger.info(`Novo usuário criado: ${user.id}`, { userId: user.id, userType: user_type });

      return user;
    });

    // Gera tokens
    const tokens = await generateTokens(result);

    res.status(201).json({
      message: 'Usuário registrado com sucesso',
      user: {
        id: result.id,
        email: result.email,
        user_type: result.user_type
      },
      ...tokens
    });

  } catch (err) {
    logger.error('Erro no registro:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, device_info } = value;

    // Busca usuário
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verifica se conta está bloqueada
    if (user.locked_until && user.locked_until > new Date()) {
      return res.status(423).json({ 
        error: 'Conta temporariamente bloqueada',
        lockedUntil: user.locked_until
      });
    }

    // Verifica senha
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Incrementa tentativas falhas
      user.failed_login_attempts += 1;
      
      // Bloqueia após 5 tentativas falhas
      if (user.failed_login_attempts >= 5) {
        const lockTime = new Date();
        lockTime.setMinutes(lockTime.getMinutes() + 30);
        user.locked_until = lockTime;
        logger.warn(`Conta bloqueada por múltiplas tentativas: ${email}`);
      }
      
      await user.save();
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Verifica se usuário está ativo
    if (!user.is_active) {
      return res.status(403).json({ error: 'Conta desativada' });
    }

    // Reseta tentativas falhas e atualiza último login
    user.failed_login_attempts = 0;
    user.locked_until = null;
    user.last_login = new Date();
    await user.save();

    // Gera tokens
    const tokens = await generateTokens(user, device_info);

    logger.info(`Login bem-sucedido: ${user.id}`);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        user_type: user.user_type,
        is_verified: user.is_verified
      },
      ...tokens
    });

  } catch (err) {
    logger.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Refresh Token
app.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token necessário' });
    }

    // Verifica se token está na blacklist do Redis
    const isBlacklisted = await redisClient?.get(`blacklist:${refreshToken}`);
    if (isBlacklisted) {
      return res.status(403).json({ error: 'Token revogado' });
    }

    // Verifica no banco de dados
    const storedToken = await RefreshToken.findOne({
      where: { token: refreshToken, is_revoked: false }
    });

    if (!storedToken || storedToken.expires_at < new Date()) {
      return res.status(403).json({ error: 'Refresh token inválido ou expirado' });
    }

    // Verifica JWT
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'mudex-refresh-secret');
    
    // Busca usuário
    const user = await User.findByPk(decoded.userId);
    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Usuário não encontrado ou inativo' });
    }

    // Revoga token antigo
    storedToken.is_revoked = true;
    await storedToken.save();

    // Gera novos tokens
    const tokens = await generateTokens(user, storedToken.device_info);

    logger.info(`Token renovado: ${user.id}`);
    res.json(tokens);

  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Token inválido' });
    }
    logger.error('Erro no refresh:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Logout (revoga tokens)
app.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      // Adiciona à blacklist no Redis (expira em 7 dias)
      await redisClient?.setEx(`blacklist:${refreshToken}`, 604800, 'true');
      
      // Revoga no banco
      await RefreshToken.update(
        { is_revoked: true },
        { where: { token: refreshToken } }
      );
    }

    // Se houver access token no header, também adiciona à blacklist
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const accessToken = authHeader.split(' ')[1];
      // Decodifica para pegar o exp
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded && decoded.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redisClient?.setEx(`blacklist:${accessToken}`, ttl, 'true');
          }
        }
      } catch (e) {
        logger.warn('Erro ao decodificar token para blacklist:', e);
      }
    }

    res.json({ message: 'Logout realizado com sucesso' });

  } catch (err) {
    logger.error('Erro no logout:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Verificação de token (usado pelo API Gateway)
app.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token necessário' });
    }

    // Verifica blacklist
    const isBlacklisted = await redisClient?.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(403).json({ error: 'Token revogado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mudex-secret-key');
    
    // Verifica se usuário ainda existe e está ativo
    const user = await User.findByPk(decoded.userId, {
      attributes: ['id', 'email', 'user_type', 'is_active']
    });

    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Usuário inválido' });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        user_type: user.user_type
      },
      decoded
    });

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado', expired: true });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Token inválido' });
    }
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ 
      status: 'OK',
      service: 'auth-service',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({ 
      status: 'ERROR',
      service: 'auth-service',
      database: 'disconnected',
      error: err.message
    });
  }
});

// Sincroniza banco e inicia servidor
const PORT = process.env.PORT || 3001;

(async () => {
  try {
    await sequelize.sync({ alter: true });
    logger.info('Banco de dados sincronizado');
    
    app.listen(PORT, () => {
      logger.info(`Auth Service rodando na porta ${PORT}`);
      console.log(`🔐 Auth Service disponível em http://localhost:${PORT}`);
    });
  } catch (err) {
    logger.error('Erro ao iniciar serviço:', err);
    process.exit(1);
  }
})();