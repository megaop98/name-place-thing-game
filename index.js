const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  socket.on('joinRoom', (data) => {
    socket.join(data.room);
    io.to(data.room).emit('roomUpdate', data);
  });

  socket.on('sendMessage', (data) => {
    io.to(data.room).emit('message', data);
  });

  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 7860;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
