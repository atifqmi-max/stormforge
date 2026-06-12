const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { initDB, read, write } = require('./database/db');

// Init database with defaults
initDB();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use('/assets', express.static(path.join(__dirname, 'frontend/assets')));
app.use(express.static(path.join(__dirname, 'frontend')));

// API Routes
app.use('/api/auth', require('./backend/routes/auth'));
app.use('/api/products', require('./backend/routes/products'));
app.use('/api/categories', require('./backend/routes/categories'));
app.use('/api/reviews', require('./backend/routes/reviews'));
app.use('/api/offers', require('./backend/routes/offers'));
app.use('/api/chats', require('./backend/routes/chats'));
app.use('/api/settings', require('./backend/routes/settings'));

// Socket.IO for live chat
io.on('connection', (socket) => {
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
  });
  socket.on('user_message', ({ chatId, message }) => {
    const chats = read('chats');
    const idx = chats.findIndex(c => c.id === chatId);
    if (idx !== -1 && chats[idx].status !== 'closed') {
      const msg = { from: 'user', text: message, time: new Date().toISOString() };
      chats[idx].messages.push(msg);
      write('chats', chats);
      io.to(chatId).emit('new_message', msg);
      io.to('admin_room').emit('chat_updated', chats[idx]);
    }
  });
  socket.on('admin_reply', ({ chatId, message, adminName }) => {
    const chats = read('chats');
    const idx = chats.findIndex(c => c.id === chatId);
    if (idx !== -1) {
      const msg = { from: 'admin', text: message, time: new Date().toISOString(), admin_name: adminName };
      chats[idx].messages.push(msg);
      write('chats', chats);
      io.to(chatId).emit('new_message', msg);
      io.to('admin_room').emit('chat_updated', chats[idx]);
    }
  });
  socket.on('join_admin', () => {
    socket.join('admin_room');
  });
});

// All HTML routes — serve frontend
const pages = ['/', '/shop', '/category', '/offers', '/reviews', '/about', '/contact', '/rules', '/social', '/support', '/login', '/admin'];
pages.forEach(page => {
  const file = page === '/' ? 'index' : page.slice(1);
  app.get(page, (req, res) => {
    res.sendFile(path.join(__dirname, `frontend/${file === 'shop' ? 'index' : file}.html`));
  });
});

app.get('/category/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/category.html'));
});

// 404
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n⚡ StormForge Server running on http://localhost:${PORT}`);
  console.log(`📦 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🔑 Login: admin@stormforge.fun / stormforge-admin-381\n`);
});
