// ============================================
// HIMO.WATCHES — routes/stats.js
// Dashboard Stats — CA, Ventes, Clients
// ============================================

const express = require('express');
const router  = express.Router();
const { pool } = require('../database');
const { verifyToken } = require('./auth');

// ============================================
// GET /api/stats — Stats globales (Admin)
// ============================================
router.get('/', verifyToken, async (req, res) => {
  try {

    // Total CA (commandes livrées)
    const [ca] = await pool.execute(`
      SELECT COALESCE(SUM(total), 0) as total_ca
      FROM orders WHERE status = 'Livré'
    `);

    // CA en attente
    const [caPending] = await pool.execute(`
      SELECT COALESCE(SUM(total), 0) as ca_pending
      FROM orders WHERE status IN ('En attente', 'Confirmé', 'En livraison')
    `);

    // Nombre commandes par statut
    const [ordersByStatus] = await pool.execute(`
      SELECT status, COUNT(*) as count FROM orders GROUP BY status
    `);

    // Total commandes
    const [totalOrders] = await pool.execute(`
      SELECT COUNT(*) as count FROM orders
    `);

    // Total clients uniques (par téléphone)
    const [clients] = await pool.execute(`
      SELECT COUNT(DISTINCT client_tel) as count FROM orders
    `);

    // Total produits actifs
    const [produits] = await pool.execute(`
      SELECT COUNT(*) as count FROM products WHERE active = 1
    `);

    // Total avis
    const [avis] = await pool.execute(`
      SELECT COUNT(*) as count, ROUND(AVG(note),1) as avg_note FROM reviews
    `);

    // Top 5 produits les plus vendus
    const [topProducts] = await pool.execute(`
      SELECT oi.brand, oi.model,
             SUM(oi.quantity) as total_qty,
             SUM(oi.price * oi.quantity) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'Annulé'
      GROUP BY oi.brand, oi.model
      ORDER BY total_qty DESC
      LIMIT 5
    `);

    // Ventes par mois (12 derniers mois)
    const [salesByMonth] = await pool.execute(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as nb_orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
        AND status != 'Annulé'
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);

    // Ventes par ville
    const [salesByCity] = await pool.execute(`
      SELECT client_ville as ville, COUNT(*) as count, SUM(total) as total
      FROM orders WHERE status != 'Annulé'
      GROUP BY client_ville
      ORDER BY count DESC
      LIMIT 8
    `);

    // Commandes récentes (5 dernières)
    const [recentOrders] = await pool.execute(`
      SELECT id, client_prenom, client_nom, client_ville, total, status, created_at
      FROM orders
      ORDER BY created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        ca:             parseFloat(ca[0].total_ca),
        ca_pending:     parseFloat(caPending[0].ca_pending),
        total_orders:   totalOrders[0].count,
        total_clients:  clients[0].count,
        total_products: produits[0].count,
        total_reviews:  avis[0].count,
        avg_note:       avis[0].avg_note || 0,
        orders_by_status: ordersByStatus,
        top_products:     topProducts,
        sales_by_month:   salesByMonth,
        sales_by_city:    salesByCity,
        recent_orders:    recentOrders,
      }
    });

  } catch (err) {
    console.error('Erreur stats:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
