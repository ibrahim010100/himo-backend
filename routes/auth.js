// ============================================
// HIMO.WATCHES — routes/auth.js
// Login Admin avec JWT
// ============================================

const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const { pool } = require('../database');

// ============================================
// Middleware — Vérifier JWT
// ============================================
function verifyToken(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ error: 'Token manquant' });

  const token = auth.split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: 'Token invalide' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expiré ou invalide' });
  }
}

// ============================================
// POST /api/auth/login
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    // Chercher l'admin
    const [rows] = await pool.execute(
      'SELECT * FROM admins WHERE email = ?',
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const admin = rows[0];

    // Vérifier le mot de passe
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer le token JWT (expire en 24h)
    const token = jwt.sign(
      { id: admin.id, email: admin.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      admin: { id: admin.id, email: admin.email }
    });

  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// POST /api/auth/change-password
// ============================================
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const [rows] = await pool.execute('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    if (!rows.length) return res.status(404).json({ error: 'Admin non trouvé' });

    const valid = await bcrypt.compare(oldPassword, rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Ancien mot de passe incorrect' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await pool.execute('UPDATE admins SET password = ? WHERE id = ?', [hashed, req.admin.id]);

    res.json({ success: true, message: 'Mot de passe changé avec succès' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/auth/verify
// ============================================
router.get('/verify', verifyToken, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

module.exports = { router, verifyToken };
