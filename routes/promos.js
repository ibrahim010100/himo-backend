// ============================================
// HIMO.WATCHES — routes/promos.js
// ============================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../database');
const jwt = require('jsonwebtoken');

// Middleware admin auth
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Non autorisé' });
  try {
    const token = auth.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET || 'himo_secret');
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
}

// GET /api/promos — public (pour le frontend)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.*, pr.brand, pr.model, pr.price, pr.image_url, pr.emoji
      FROM promos p
      JOIN products pr ON p.product_id = pr.id
      ORDER BY p.created_at DESC
    `);
    res.json({ success: true, promos: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/promos — admin only
router.post('/', adminAuth, async (req, res) => {
  const { product_id, discount, code } = req.body;
  if (!product_id || !discount || !code) {
    return res.status(400).json({ error: 'Champs manquants' });
  }
  try {
    // Check ila product deja 3ndha promo
    const [existing] = await pool.execute('SELECT id FROM promos WHERE product_id = ?', [product_id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Ce produit a déjà une promotion' });
    }
    const label = `-${discount}%`;
    await pool.execute(
      'INSERT INTO promos (product_id, discount, label, code) VALUES (?, ?, ?, ?)',
      [product_id, discount, label, code.toUpperCase()]
    );
    res.json({ success: true, message: 'Promotion ajoutée!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/promos/:id — admin only
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    await pool.execute('DELETE FROM promos WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
