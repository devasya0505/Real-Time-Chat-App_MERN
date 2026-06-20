require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const roomRoutes = require('./src/routes/roomRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const userRoutes = require('./src/routes/userRoutes');
const initializeSocket = require('./src/sockets/socketHandler');

// Connect to Database
connectDB();

const app = express();

// Allowed Origins for CORS (Development + Production Vercel App)
const allowedOrigins = [
  'http://localhost:5173',
  'https://devvconnectt.vercel.app',
  'https://devvconnectt.vercel.app/'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes(origin + '/')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

// Middlewares
app.use(cors(corsOptions));
app.use(express.json());

// Create HTTP Server
const server = http.createServer(app);

// Initialize Socket.io Server
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes(origin + '/')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Bind Socket.io to Express requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// REST Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Base route
app.get('/', (req, res) => {
  res.json({ message: 'Real-Time Chat Application API is running...' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

/*
 * =========================================================================
 * SCALABILITY & REAL-TIME SYSTEMS ENGINEERING AWARENESS:
 * =========================================================================
 * For production environments with multiple application server instances
 * behind a load balancer, local memory presence and event broadcasting will fail.
 *
 * To scale horizontally, we integrate the Redis Adapter. It passes events
 * between nodes using Redis Pub/Sub.
 *
 * Implementation outline (Uncomment in multi-node scaled systems):
 * -------------------------------------------------------------------------
 * const { createClient } = require('redis');
 * const { createAdapter } = require('@socket.io/redis-adapter');
 *
 * const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
 * const subClient = pubClient.duplicate();
 *
 * Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
 *   io.adapter(createAdapter(pubClient, subClient));
 *   console.log('Socket.io scaled horizontally via Redis Adapter.');
 * });
 * =========================================================================
 */

// Initialize our socket event logic
initializeSocket(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in production/development mode on port ${PORT}`);
});
