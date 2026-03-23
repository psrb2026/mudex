/**
 * Location Service - Mudex (Versão Corrigida para Postgres)
 * Local: services/location-service/src/index.js
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

const app = express();
app.use(express.json());

// Faz o Node encontrar a pasta public do mapa subindo um nível
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            res.send('<h1>📍 Mudex Online</h1><p>Motor rodando! Verifique a pasta public.</p>');
        }
    });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  console.log(`📱 Novo celular conectado ao Mudex: ${socket.id}`);
  
  socket.on('location:update', (data) => {
    socket.emit('location:confirmed', { timestamp: Date.now() });
  });

  socket.on('disconnect', () => {
    console.log('❌ Celular desconectado');
  });
});

// PORTA 8080 PARA O CODESPACES
const PORT = 8080; 
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 MUDEX NO AR NA PORTA ${PORT}`);
  console.log(`🔗 Link: https://congenial-guide-x5jwvx4p547rhvrv6-8080.app.github.dev/`);
});
