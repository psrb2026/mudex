module.exports = {
  apps: [
    { 
      name: 'gateway', 
      script: './api-gateway/src/index.js' // Caminho corrigido para a pasta src
    },
    { 
      name: 'auth-service', 
      script: './services/auth-service/index.js' 
    },
    { 
      name: 'location-service', 
      script: './services/location-service/index.js' 
    }
  ]
};