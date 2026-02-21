/**
 * Outbound Webhook Emitter
 * Fires async POST requests to all active subscribers when an event occurs.
 */
const crypto = require('crypto');
const pool = require('../db');

/**
 * Emit a webhook event to all matching subscribers.
 * Non-blocking — errors are caught and logged, never thrown.
 *
 * @param {string} event  e.g. "vehicle.update", "maintenance.create"
 * @param {object} data   The payload to send
 */
async function emit(event, data) {
  try {
    const r = await pool.query(
      `SELECT * FROM webhook_subscriptions
       WHERE active = true
         AND ($1 = ANY(events) OR '*' = ANY(events))`,
      [event]
    );

    if (r.rows.length === 0) return;

    const payload = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data,
    });

    await Promise.allSettled(r.rows.map(sub => fireOne(sub, payload)));
  } catch (err) {
    console.error('[webhook] emit error:', err.message);
  }
}

async function fireOne(sub, payloadStr) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Fleet-Event': JSON.parse(payloadStr).event,
    'X-Fleet-Delivery': crypto.randomUUID(),
  };

  // HMAC signature if secret is set
  if (sub.secret) {
    const sig = crypto.createHmac('sha256', sub.secret).update(payloadStr).digest('hex');
    headers['X-Fleet-Signature'] = `sha256=${sig}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(sub.url, {
      method: 'POST',
      headers,
      body: payloadStr,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    // Update last_triggered_at + last_status
    await pool.query(
      `UPDATE webhook_subscriptions SET last_triggered_at=NOW(), last_status=$1 WHERE id=$2`,
      [res.status, sub.id]
    ).catch(() => {});

    console.log(`[webhook] ${sub.name} → ${sub.url} → ${res.status}`);
  } catch (err) {
    console.error(`[webhook] ${sub.name} → ${sub.url} → ERROR: ${err.message}`);
    await pool.query(
      `UPDATE webhook_subscriptions SET last_triggered_at=NOW(), last_status=0 WHERE id=$1`,
      [sub.id]
    ).catch(() => {});
  }
}

module.exports = { emit };
