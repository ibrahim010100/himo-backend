// ============================================
// HIMO.WATCHES — routes/orders.js
// Commandes + Notifications Email
// ============================================

const express      = require('express');
const router       = express.Router();
const nodemailer   = require('nodemailer');
const { pool }     = require('../database');
const { verifyToken } = require('./auth');

// ============================================
// Config Email (Gmail)
// ============================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS  // App Password Gmail
  }
});

// ============================================
// Envoyer notification email
// ============================================
async function sendOrderNotification(order, items) {
  if (!process.env.EMAIL_USER || process.env.EMAIL_USER.includes('ton_email')) return;

  try {
    const itemsList = items.map(i =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #2a2a2a">${i.brand} ${i.model}</td>
        <td style="padding:8px;border-bottom:1px solid #2a2a2a;text-align:center">${i.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #2a2a2a;text-align:right;color:#C9A96E">${(i.price*i.quantity).toLocaleString('fr-MA')} MAD</td>
      </tr>`
    ).join('');

    // Email à l'admin
    await transporter.sendMail({
      from: `"HIMO.WATCHES" <${process.env.EMAIL_USER}>`,
      to:   process.env.EMAIL_USER,
      subject: `🔔 Nouvelle Commande — ${order.id}`,
      html: `
        <div style="background:#0F0F0F;color:#F5F0E8;font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px">
          <h1 style="color:#C9A96E;font-size:28px;letter-spacing:4px">HIMO.WATCHES</h1>
          <h2 style="font-size:20px;margin:24px 0 8px">🔔 Nouvelle Commande!</h2>
          <p style="color:#C9A96E;letter-spacing:2px;font-size:12px">${order.id}</p>

          <div style="background:#161616;padding:20px;margin:24px 0;border:1px solid #2a2a2a">
            <h3 style="color:#C9A96E;font-size:12px;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px">Informations Client</h3>
            <p><strong>Nom:</strong> ${order.client_prenom} ${order.client_nom}</p>
            <p><strong>Téléphone:</strong> ${order.client_tel}</p>
            <p><strong>Ville:</strong> ${order.client_ville}</p>
            <p><strong>Adresse:</strong> ${order.client_addr}</p>
            <p><strong>Paiement:</strong> ${order.payment}</p>
          </div>

          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <thead>
              <tr style="background:#1E1E1E">
                <th style="padding:10px;text-align:left;font-size:10px;letter-spacing:2px;color:#C9A96E">PRODUIT</th>
                <th style="padding:10px;text-align:center;font-size:10px;letter-spacing:2px;color:#C9A96E">QTÉ</th>
                <th style="padding:10px;text-align:right;font-size:10px;letter-spacing:2px;color:#C9A96E">PRIX</th>
              </tr>
            </thead>
            <tbody>${itemsList}</tbody>
          </table>

          <div style="text-align:right;padding:16px 0;border-top:1px solid #C9A96E">
            <span style="font-size:14px;letter-spacing:2px">TOTAL: </span>
            <span style="font-size:28px;color:#C9A96E;font-weight:bold">${order.total.toLocaleString('fr-MA')} MAD</span>
          </div>

          <p style="color:#777;font-size:11px;margin-top:24px">Connectez-vous au Dashboard Admin pour traiter cette commande.</p>
        </div>
      `
    });

    // Email au client (si email dispo)
    if (order.client_email) {
      await transporter.sendMail({
        from: `"HIMO.WATCHES" <${process.env.EMAIL_USER}>`,
        to:   order.client_email,
        subject: `✓ Commande Confirmée — HIMO.WATCHES`,
        html: `
          <div style="background:#0F0F0F;color:#F5F0E8;font-family:Georgia,serif;max-width:600px;margin:0 auto;padding:40px">
            <h1 style="color:#C9A96E;font-size:28px;letter-spacing:4px">HIMO.WATCHES</h1>
            <h2 style="font-size:20px;margin:24px 0 8px">✓ Merci pour votre commande!</h2>
            <p style="color:#AAA">Votre commande <strong style="color:#C9A96E">${order.id}</strong> a été reçue avec succès.</p>
            <p style="color:#AAA;margin-top:16px">Nous vous contacterons au <strong>${order.client_tel}</strong> pour confirmer la livraison.</p>
            <div style="margin-top:32px;padding:20px;background:#161616;border-left:3px solid #C9A96E">
              <p style="color:#C9A96E;font-size:12px;letter-spacing:2px">TOTAL: <strong style="font-size:22px">${order.total.toLocaleString('fr-MA')} MAD</strong></p>
            </div>
            <p style="color:#777;font-size:11px;margin-top:24px">© 2024 HIMO.WATCHES · Maroc</p>
          </div>
        `
      });
    }

    console.log('📧 Notifications email envoyées');
  } catch (err) {
    console.error('⚠️  Email non envoyé:', err.message);
    // Ne pas bloquer la commande si email échoue
  }
}

// ============================================
// POST /api/orders — Créer une commande
// ============================================
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { client, items, total } = req.body;

    if (!client || !items || !items.length) {
      return res.status(400).json({ error: 'Données manquantes' });
    }

    // Validation
    if (!client.nom || !client.tel || !client.addr || !client.ville || !client.pay) {
      return res.status(400).json({ error: 'Tous les champs client sont requis' });
    }
    client.prenom = client.prenom || '';

    const orderId = 'CMD-' + Date.now();

    // Insérer la commande
    await conn.execute(
      `INSERT INTO orders (id, client_nom, client_prenom, client_tel, client_email, client_addr, client_ville, payment, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, client.nom, client.prenom, client.tel, client.email||'', client.addr, client.ville, client.pay, total]
    );

    // Insérer les articles
    for (const item of items) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, brand, model, price, quantity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.id||0, item.brand, item.model, item.price, item.qty||item.quantity||1]
      );
    }

    await conn.commit();

    const order = { id:orderId, ...client, client_nom:client.nom, client_prenom:client.prenom,
                    client_tel:client.tel, client_email:client.email, client_addr:client.addr,
                    client_ville:client.ville, payment:client.pay, total };

    // Envoyer notifications (async - ne bloque pas)
    sendOrderNotification(order, items);

    // Notification real-time SSE -> admin panel
    if (global.sendNotification) {
      global.sendNotification({
        type:    'new_order',
        orderId: orderId,
        client:  `${client.prenom || ''} ${client.nom}`.trim(),
        tel:     client.tel,
        ville:   client.ville,
        total:   total,
        time:    new Date().toLocaleTimeString('fr-MA'),
      });
    }

    res.json({ success:true, order:{ id:orderId }, message:'Commande confirmée!' });

  } catch (err) {
    await conn.rollback();
    console.error('Erreur commande:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  } finally {
    conn.release();
  }
});

// ============================================
// GET /api/orders — Toutes les commandes (Admin)
// ============================================
router.get('/', verifyToken, async (req, res) => {
  try {
    const [orders] = await pool.execute(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );

    // Récupérer les articles pour chaque commande
    for (const order of orders) {
      const [items] = await pool.execute(
        'SELECT * FROM order_items WHERE order_id = ?',
        [order.id]
      );
      order.items = items;
    }

    res.json({ success:true, orders });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// PUT /api/orders/:id/status — Changer statut (Admin)
// ============================================
router.put('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['En attente','Confirmé','En livraison','Livré','Annulé'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    await pool.execute(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    res.json({ success:true, message:`Statut → ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ============================================
// GET /api/orders/pending-count — Nb en attente (Admin)
// ============================================
router.get('/pending-count', verifyToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT COUNT(*) as count FROM orders WHERE status = 'En attente'"
    );
    res.json({ success:true, count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
