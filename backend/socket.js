const { Server } = require('socket.io');

const db = require('./database');

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: function (origin, callback) {
        // Allow requests with no origin
        if (!origin) return callback(null, true);

        const allowedOrigins = [
          'http://localhost:5173',  // Vite dev server
          'http://localhost:3000',  // Alternative dev port
          'https://smart-service2.vercel.app',  // Production Vercel URL
          'https://smart-service2.onrender.com',  // Render backend
          /^https:\/\/smart-service2-.*\.vercel\.app$/  // Vercel preview deployments
        ];

        const isAllowed = allowedOrigins.some(allowed => {
          if (typeof allowed === 'string') {
            return allowed === origin;
          }
          return allowed.test(origin);
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          console.warn('🚫 Socket CORS BLOCKED - Origin not allowed:', origin);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  const activeUsers = new Map();

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // User stores their socket id mapped to their user ID
    socket.on('register_user', (userId) => {
      activeUsers.set(userId, socket.id);
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    // Handle sending a private message
    socket.on('send_message', (data) => {
      const { senderId, receiverId, content } = data;
      
      // Save this message to the SQLite database
      db.run(
        `INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
        [senderId, receiverId, content],
        function(err) {
            if (err) console.error("WebSocket DB Insertion Error:", err);
        }
      );
      
      const receiverSocketId = activeUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receive_message', { senderId, content, timestamp: new Date() });
      }
    });

    // Handle real-time booking notification
    socket.on('notify_provider', (data) => {
      const { providerId, message } = data;
      const providerSocketId = activeUsers.get(providerId);
      if (providerSocketId) {
        io.to(providerSocketId).emit('booking_notification', { message, timestamp: new Date() });
      }
    });

    socket.on('update_location', (payload) => {
      if (!payload || typeof payload.provider_id === 'undefined') return;
      io.emit('provider_location', {
        provider_id: payload.provider_id,
        booking_id: payload.booking_id || null,
        lat: Number(payload.lat),
        lng: Number(payload.lng),
        status: payload.status || 'On the way',
        updatedAt: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      // Remove from active map (inefficient for large scale, but fine for demo)
      for (const [userId, sockId] of activeUsers.entries()) {
        if (sockId === socket.id) {
          activeUsers.delete(userId);
          break;
        }
      }
    });
  });

  return io;
}

module.exports = initSocket;
