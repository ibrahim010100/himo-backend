const express = require('express');
const router  = express.Router();
const { pool } = require('../database');
const { verifyToken } = require('./auth');

router.get('/', verifyToken, async (req, res) => {
  try {
    const [ca]           = await pool.execute(`SELECT COALESCE(SUM(total), 0) as total_ca FROM orders WHERE status = 'Livré'`);
    const [caPending]    = await pool.execute(`SELECT COALESCE(SUM(total), 0) as ca_pending FROM orders WHERE status IN ('En attente', 'Confirmé', 'En livraison')`);
    const [ordersByStatus] = await pool.execute(`SELECT status, COUNT(*) as count FROM orders GROUP BY status`);
    const [totalOrders]  = await pool.execute(`SELECT COUNT(*) as count FROM orders`);
    const [clients]      = await pool.execute(`SELECT COUNT(DISTINCT client_tel) as count FROM orders`);
    const [produits]     = await pool.execute(`SELECT COUNT(*) as count FROM products WHERE active = 1`);
    const [avis]         = await pool.execute(`SELECT COUNT(*) as count, ROUND(AVG(note),1) as avg_note FROM reviews`);

    const [topProducts]  = await pool.execute(`
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

    const [salesByMonth] = await pool.execute(`
      SELECT
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as nb_orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE created_at >= NOW() - INTERVAL '12 months'
        AND status != 'Annulé'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    const [salesByCity]  = await pool.execute(`
      SELECT client_ville as ville, COUNT(*) as count, SUM(total) as total
      FROM orders WHERE status != 'Annulé'
      GROUP BY client_ville
      ORDER BY count DESC
      LIMIT 8
    `);

    const [recentOrders] = await pool.execute(`
      SELECT id, client_prenom, client_nom, client_ville, total, status, created_at
      FROM orders ORDER BY created_at DESC LIMIT 5
    `);

    res.json({
      success: true,
      stats: {
        ca:             parseFloat(ca[0].total_ca),
        ca_pending:     parseFloat(caPending[0].ca_pending),
        total_orders:   parseInt(totalOrders[0].count),
        total_clients:  parseInt(clients[0].count),
        total_products: parseInt(produits[0].count),
        total_reviews:  parseInt(avis[0].count),
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
