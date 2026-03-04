const API_CONFIG = {
  development: {
    baseURL: 'http://192.168.15.6:3000', // Seu IP + Gateway
    wsURL: 'ws://192.168.15.6:3005',      // WebSocket Location Service
  },
  production: {
    baseURL: 'https://api.mudex.com',
    wsURL: 'wss://api.mudex.com/ws',
  },
};

const ENV = 'development';

export default API_CONFIG[ENV];