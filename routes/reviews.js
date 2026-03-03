// ============================================
// HIMO.WATCHES — routes/reviews.js
// Avis Clients
// ============================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../database');
const { verifyToken } = require('./auth');

// GET /api/reviews/:productId
router.get('/:productId', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM reviews WHERE product_id = ? ORDER BY created_at DESC',
      [req.params.productId]
    );
    const [avg] = await pool.execute(
      'SELECT ROUND(AVG(note),1) as avg, COUNT(*) as count FROM reviews WHERE product_id = ?',
      [req.params.productId]
    );
    res.json({ success:true, reviews:rows, avg: avg[0].avg||0, count: avg[0].count });
  } catch(err) {
    res.status(500).json({ error:'Erreur serveur' });
  }
});

// POST /api/reviews — Ajouter un avis
router.post('/', async (req, res) => {
  try {
    const { product_id, client_name, note, comment } = req.body;
    if (!product_id || !client_name || !note || !comment) {
      return res.status(400).json({ error:'Tous les champs sont requis' });
    }
    if (note < 1 || note > 5) {
      return res.status(400).json({ error:'Note entre 1 et 5' });
    }
    await pool.execute(
      'INSERT INTO reviews (product_id, client_name, note, comment) VALUES (?,?,?,?)',
      [product_id, client_name, note, comment]
    );
    res.json({ success:true, message:'Avis publié!' });
  } catch(err) {
    res.status(500).json({ error:'Erreur serveur' });
  }
});

// POST /api/reviews/:productId — Accept product_id in URL
router.post('/:productId', async (req, res) => {
  try {
    const product_id = req.params.productId;
    const { client_name, note, comment } = req.body;
    if (!client_name || !note || !comment) {
      return res.status(400).json({ error:'Tous les champs sont requis' });
    }
    if (note < 1 || note > 5) {
      return res.status(400).json({ error:'Note entre 1 et 5' });
    }
    const [result] = await pool.execute(
      'INSERT INTO reviews (product_id, client_name, note, comment) VALUES (?,?,?,?)',
      [product_id, client_name, note, comment]
    );
    res.json({ success:true, review:{ id:result.insertId, product_id, client_name, note, comment }, message:'Avis publié!' });
  } catch(err) {
    res.status(500).json({ error:'Erreur serveur' });
  }
});

// DELETE /api/reviews/:id (Admin)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await pool.execute('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ success:true, message:'Avis supprimé' });
  } catch(err) {
    res.status(500).json({ error:'Erreur serveur' });
  }
});

module.exports = router;
