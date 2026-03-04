// ============================================
// HIMO.WATCHES — database.js
// Connexion MySQL + Création des tables
// ============================================

const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de connexions
const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  port:     parseInt(process.env.DB_PORT) || 33006,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'himo_watches',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset: 'utf8mb4'
});

// ============================================
// CRÉATION DES TABLES
// ============================================
async function initDatabase() {
  const conn = await pool.getConnection();
  try {
    console.log('📦 Création des tables MySQL...');

    // Table admins
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        email      VARCHAR(255) UNIQUE NOT NULL,
        password   VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Table produits
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        brand      VARCHAR(100) NOT NULL,
        model      VARCHAR(255) NOT NULL,
        price      DECIMAL(10,2) NOT NULL,
        category   ENUM('H','F') NOT NULL DEFAULT 'H',
        emoji      VARCHAR(10) DEFAULT '⌚',
        badge      VARCHAR(100) DEFAULT '',
        image_url  VARCHAR(500) DEFAULT '',
        stock      INT DEFAULT 0,
        active     TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Table commandes
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id           VARCHAR(50) PRIMARY KEY,
        client_nom   VARCHAR(100) NOT NULL,
        client_prenom VARCHAR(100) NOT NULL,
        client_tel   VARCHAR(20) NOT NULL,
        client_email VARCHAR(255) DEFAULT '',
        client_addr  VARCHAR(500) NOT NULL,
        client_ville VARCHAR(100) NOT NULL,
        payment      VARCHAR(100) NOT NULL,
        total        DECIMAL(10,2) NOT NULL,
        status       ENUM('En attente','Confirmé','En livraison','Livré','Annulé') DEFAULT 'En attente',
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Table items de commande
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        order_id   VARCHAR(50) NOT NULL,
        product_id INT NOT NULL,
        brand      VARCHAR(100) NOT NULL,
        model      VARCHAR(255) NOT NULL,
        price      DECIMAL(10,2) NOT NULL,
        quantity   INT NOT NULL DEFAULT 1,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Table avis clients
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS reviews (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        client_name VARCHAR(100) NOT NULL,
        note       TINYINT NOT NULL CHECK (note BETWEEN 1 AND 5),
        comment    VARCHAR(1000) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Table promos
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS promos (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        product_id  INT NOT NULL,
        discount    INT NOT NULL,
        label       VARCHAR(20) NOT NULL,
        code        VARCHAR(50) NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅ Tables créées avec succès!');

    // Insérer admin par défaut
    await seedAdmin(conn);

    // Insérer produits par défaut
    await seedProducts(conn);

  } catch (err) {
    console.error('❌ Erreur création tables:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

// ============================================
// DONNÉES PAR DÉFAUT
// ============================================
async function seedAdmin(conn) {
  const bcrypt = require('bcryptjs');
  const [rows] = await conn.execute('SELECT id FROM admins LIMIT 1');
  if (rows.length > 0) return;

  const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'himo2024', 12);
  await conn.execute(
    'INSERT INTO admins (email, password) VALUES (?, ?)',
    [process.env.ADMIN_EMAIL || 'admin@himo.watches', hashed]
  );
  console.log('👤 Admin créé:', process.env.ADMIN_EMAIL);
}

async function seedProducts(conn) {
  const [rows] = await conn.execute('SELECT id FROM products LIMIT 1');
  if (rows.length > 0) return;

  const defaultProducts = [
    ['Rolex',   'Submariner Date',         45000, 'H', '⌚', 'Prestige',    5],
    ['Festina', 'Chronograph Sport',       3800,  'F', '⌚', 'Nouveau',     10],
    ['Casio',   'G-Shock Black Edition',   1200,  'H', '⌚', 'Best Seller', 15],
    ['Swatch',  'Irony Silver Lady',       950,   'F', '⌚', '',            8],
    ['Casio',   'Edifice Premium EFR',     2100,  'H', '⌚', '',            12],
    ['Rolex',   'Datejust 41 Jubilé',      52000, 'H', '⌚', 'Exclusif',    3],
    ['Rolex',   'Day-Date Gold President', 78000, 'H', '⌚', 'Ultra Rare',  2],
    ['Festina', 'Classic Elegance Lady',   2900,  'F', '⌚', '',            7],
    ['Casio',   'Pro Trek Adventure PRW',  1800,  'H', '⌚', '',            9],
    ['Rolex',   'Oyster Perpetual 36',     38000, 'F', '⌚', 'Classique',   4],
  ];

  for (const p of defaultProducts) {
    await conn.execute(
      'INSERT INTO products (brand, model, price, category, emoji, badge, stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
      p
    );
  }
  console.log('📦 10 produits insérés par défaut');
}

module.exports = { pool, initDatabase };
