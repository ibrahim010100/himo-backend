// ============================================
// HIMO.WATCHES — database.js
// Connexion PostgreSQL (Supabase)
// ============================================

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host:     process.env.DB_HOST,
        port:     parseInt(process.env.DB_PORT) || 5432,
        user:     process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'postgres',
        ssl: { rejectUnauthorized: false },
      }
);

// Helper — execute avec ? placeholders comme mysql2
pool.execute = async (sql, params) => {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  const res = await pool.query(pgSql, params || []);
  return [res.rows];
};

pool.getConnection = async () => {
  const client = await pool.connect();
  client.execute = async (sql, params) => {
    let i = 0;
    const pgSql = sql.replace(/\?/g, () => `$${++i}`);
    const res = await client.query(pgSql, params || []);
    return [res.rows];
  };
  const origRelease = client.release.bind(client);
  client.release = origRelease;
  return client;
};

async function initDatabase() {
  const client = await pool.connect();
  try {
    console.log('📦 Création des tables PostgreSQL...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id         SERIAL PRIMARY KEY,
        email      VARCHAR(255) UNIQUE NOT NULL,
        password   VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id         SERIAL PRIMARY KEY,
        brand      VARCHAR(100) NOT NULL,
        model      VARCHAR(255) NOT NULL,
        price      DECIMAL(10,2) NOT NULL,
        category   VARCHAR(1) NOT NULL DEFAULT 'H',
        emoji      VARCHAR(10) DEFAULT '⌚',
        badge      VARCHAR(100) DEFAULT '',
        image_url  VARCHAR(500) DEFAULT '',
        stock      INT DEFAULT 0,
        active     SMALLINT DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id            VARCHAR(50) PRIMARY KEY,
        client_nom    VARCHAR(100) NOT NULL,
        client_prenom VARCHAR(100) NOT NULL,
        client_tel    VARCHAR(20) NOT NULL,
        client_email  VARCHAR(255) DEFAULT '',
        client_addr   VARCHAR(500) NOT NULL,
        client_ville  VARCHAR(100) NOT NULL,
        payment       VARCHAR(100) NOT NULL,
        total         DECIMAL(10,2) NOT NULL,
        status        VARCHAR(50) DEFAULT 'En attente',
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id         SERIAL PRIMARY KEY,
        order_id   VARCHAR(50) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id INT NOT NULL,
        brand      VARCHAR(100) NOT NULL,
        model      VARCHAR(255) NOT NULL,
        price      DECIMAL(10,2) NOT NULL,
        quantity   INT NOT NULL DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id          SERIAL PRIMARY KEY,
        product_id  INT NOT NULL,
        client_name VARCHAR(100) NOT NULL,
        note        SMALLINT NOT NULL CHECK (note BETWEEN 1 AND 5),
        comment     VARCHAR(1000) NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS promos (
        id         SERIAL PRIMARY KEY,
        product_id INT NOT NULL,
        discount   INT NOT NULL,
        label      VARCHAR(20) NOT NULL,
        code       VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS packs (
        id          SERIAL PRIMARY KEY,
        name        VARCHAR(255) NOT NULL,
        description TEXT,
        type        VARCHAR(10) NOT NULL DEFAULT 'cadeau',
        price       DECIMAL(10,2) NOT NULL,
        old_price   DECIMAL(10,2) DEFAULT NULL,
        image_url   VARCHAR(500) DEFAULT '',
        badge       VARCHAR(100) DEFAULT '',
        active      SMALLINT DEFAULT 1,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tables créées!');
    await seedAdmin(client);
    await seedProducts(client);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function seedAdmin(client) {
  const bcrypt = require('bcryptjs');
  const { rows } = await client.query('SELECT id FROM admins LIMIT 1');
  if (rows.length > 0) return;
  const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'himo2024', 12);
  await client.query('INSERT INTO admins (email, password) VALUES ($1, $2)',
    [process.env.ADMIN_EMAIL || 'admin@himo.watches', hashed]);
  console.log('👤 Admin créé');
}

async function seedProducts(client) {
  const { rows } = await client.query('SELECT id FROM products LIMIT 1');
  if (rows.length > 0) return;
  const prods = [
    ['Rolex','Submariner Date',45000,'H','⌚','Prestige',5],
    ['Festina','Chronograph Sport',3800,'F','⌚','Nouveau',10],
    ['Casio','G-Shock Black Edition',1200,'H','⌚','Best Seller',15],
    ['Swatch','Irony Silver Lady',950,'F','⌚','',8],
    ['Casio','Edifice Premium EFR',2100,'H','⌚','',12],
    ['Rolex','Datejust 41 Jubilé',52000,'H','⌚','Exclusif',3],
    ['Rolex','Day-Date Gold President',78000,'H','⌚','Ultra Rare',2],
    ['Festina','Classic Elegance Lady',2900,'F','⌚','',7],
    ['Casio','Pro Trek Adventure PRW',1800,'H','⌚','',9],
    ['Rolex','Oyster Perpetual 36',38000,'F','⌚','Classique',4],
  ];
  for (const p of prods) {
    await client.query(
      'INSERT INTO products (brand,model,price,category,emoji,badge,stock) VALUES ($1,$2,$3,$4,$5,$6,$7)', p);
  }
  console.log('📦 10 produits insérés');
}

module.exports = { pool, initDatabase };
