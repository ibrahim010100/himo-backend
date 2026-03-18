// ============================================
// HIMO.WATCHES — server.js
// Serveur Principal Express
// ============================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { initDatabase } = require('./database');

const app  = express();
const PORT = process.env.PORT || 3001;

// SSE — Clients connectés (admin panels)
const sseClients = new Set();
global.sseClients = sseClients;
global.sendNotification = function(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.write(msg); } catch(e) { sseClients.delete(client); }
  });
};

// ============================================
// MIDDLEWARES
// ============================================
app.use(cors({
  origin: [
    'https://himo.watch',
    'https://www.himo.watch',
    'https://ibrahim010100.github.io',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true
}));
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended:true }));

// Log des requêtes
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString('fr-MA')}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// SSE — Notifications Real-Time
// ============================================
app.get('/api/notifications/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Keep-alive
  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch(e) { clearInterval(keepAlive); }
  }, 25000);

  sseClients.add(res);
  console.log(`🔔 Admin connecté aux notifications (${sseClients.size} clients)`);

  req.on('close', () => {
    sseClients.delete(res);
    clearInterval(keepAlive);
    console.log(`🔕 Admin déconnecté (${sseClients.size} clients)`);
  });
});

// ============================================
// ROUTES
// ============================================
app.use('/api/auth',     require('./routes/auth').router);
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/stats',    require('./routes/stats'));
app.use('/api/reviews',  require('./routes/reviews'));
app.use('/api/promos',   require('./routes/promos'));
app.use('/api/packs',    require('./routes/packs'));

// Route de test
app.get('/', (req, res) => {
  res.json({
    message: '🕐 HIMO.WATCHES API — En ligne!',
    version: '1.0.0',
    endpoints: {
      auth:     '/api/auth/login',
      products: '/api/products',
      orders:   '/api/orders',
      stats:    '/api/stats',
      reviews:  '/api/reviews/:productId',
    }
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ============================================
// DÉMARRAGE
// ============================================
async function start() {
  try {
    // Init base de données
    await initDatabase();
    console.log('✅ MySQL connecté et tables créées');

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log('');
      console.log('╔════════════════════════════════════╗');
      console.log('║   🕐  HIMO.WATCHES API              ║');
      console.log(`║   ✅  En ligne → http://localhost:${PORT}  ║`);
      console.log('╚════════════════════════════════════╝');
      console.log('');
    });

  } catch (err) {
    console.error('❌ Erreur démarrage FULL:', err);
    console.error('❌ Erreur message:', err.message);
    console.error('❌ Erreur code:', err.code);
    console.error('DB_HOST:', process.env.DB_HOST);
    console.error('DB_PORT:', process.env.DB_PORT);
    console.error('DB_USER:', process.env.DB_USER);
    console.error('DB_NAME:', process.env.DB_NAME);
    console.error('👉 Vérifiez votre fichier .env (DB_PASSWORD, etc.)');
    process.exit(1);
  }
}

start();
