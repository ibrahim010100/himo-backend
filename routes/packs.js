// ============================================
// HIMO.WATCHES — routes/packs.js
// ============================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../database');
const { verifyToken } = require('./auth');

// GET /api/packs — tous les packs actifs
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM packs WHERE active = 1 ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/packs/all — admin: tous les packs
router.get('/all', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM packs ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/packs — ajouter un pack
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, type, price, old_price, image_url, badge } = req.body;
    if (!name || !price || !type) {
      return res.status(400).json({ error: 'name, price et type sont requis' });
    }
    const [result] = await pool.execute(
      'INSERT INTO packs (name, description, type, price, old_price, image_url, badge) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description || '', type, price, old_price || null, image_url || '', badge || '']
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/packs/:id — modifier un pack
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, description, type, price, old_price, image_url, badge, active } = req.body;
    await pool.execute(
      'UPDATE packs SET name=?, description=?, type=?, price=?, old_price=?, image_url=?, badge=?, active=? WHERE id=?',
      [name, description || '', type, price, old_price || null, image_url || '', badge || '', active ?? 1, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/packs/:id — supprimer un pack
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await pool.execute('DELETE FROM packs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
