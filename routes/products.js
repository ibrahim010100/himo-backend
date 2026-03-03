// ============================================
// HIMO.WATCHES — routes/products.js
// CRUD Produits
// ============================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../database');
const { verifyToken } = require('./auth');

// ============================================
// GET /api/products — Tous les produits
// ============================================
router.get('/', async (req, res) => {
  try {
    const { cat } = req.query;
    let sql    = 'SELECT * FROM products WHERE active = 1';
    let params = [];

    if (cat && ['H','F'].includes(cat)) {
      sql += ' AND category = ?';
      params.push(cat);
    }
    sql += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, products: rows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/products/:id — Un produit
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM products WHERE id = ? AND active = 1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json({ success: true, product: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/products — Ajouter (Admin)
// ============================================
router.post('/', verifyToken, async (req, res) => {
  try {
    const { brand, model, price, category, emoji, badge, image_url, stock } = req.body;

    if (!brand || !model || !price) {
      return res.status(400).json({ error: 'Brand, modèle et prix requis' });
    }

    const [result] = await pool.execute(
      `INSERT INTO products (brand, model, price, category, emoji, badge, image_url, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [brand, model, price, category||'H', emoji||'⌚', badge||'', image_url||'', stock||0]
    );

    const [newP] = await pool.execute('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.json({ success: true, product: newP[0], message: 'Produit ajouté!' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /api/products/:id — Modifier (Admin)
// ============================================
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { brand, model, price, category, emoji, badge, image_url, stock } = req.body;
    const { id } = req.params;

    await pool.execute(
      `UPDATE products SET brand=?, model=?, price=?, category=?, emoji=?, badge=?, image_url=?, stock=?
       WHERE id = ?`,
      [brand, model, price, category, emoji||'⌚', badge||'', image_url||'', stock||0, id]
    );

    const [updated] = await pool.execute('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ success: true, product: updated[0], message: 'Produit modifié!' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// DELETE /api/products/:id — Supprimer (Admin)
// ============================================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    // Soft delete
    await pool.execute('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Produit supprimé!' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
