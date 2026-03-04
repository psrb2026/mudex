module.exports = {
  apps: [
    {
      name: 'gateway',
      script: './api-gateway/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      }
    },
    {
      name: 'auth-service',
      script: './services/auth-service/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      }
    },
    {
      name: 'user-service',
      script: './services/user-service/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3002
      }
    },
    {
      name: 'ride-service',
      script: './services/ride-service/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3003
      }
    },
    {
      name: 'dispatch-service',
      script: './services/dispatch-service/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3004
      }
    },
    {
      name: 'location-service',
      script: './services/location-service/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3005
      }
    },
    {
      name: 'payment-service',
      script: './services/payment-service/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3006
      }
    },
    {
      name: 'notification-service',
      script: './services/notification-service/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3007
      }
    },
    {
      name: 'analytics-service',
      script: './services/analytics-service/src/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 3008
      }
    }
  ]
};