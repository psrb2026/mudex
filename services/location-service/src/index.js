const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
app.use(express.json());

// Serve o mapa da pasta public
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on('connection', (socket) => {
  console.log(`📱 Conectado: ${socket.id}`);
  socket.on('location:update', (data) => {
    socket.emit('location:confirmed', { status: 'ok' });
  });
});

// Porta 8080 para o GitHub Codespaces
httpServer.listen(8080, '0.0.0.0', () => {
  console.log('🚀 MUDEX RODANDO NA PORTA 8080');
});
