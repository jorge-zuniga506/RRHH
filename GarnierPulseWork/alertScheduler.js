const cron = require('node-cron');
const db = require('./db');
const notifier = require('./notifier');

/**
 * Runs the sustained negative state monitor.
 * Checks all areas: if the average of the last 5 entries is < 3.0 for 3+ consecutive days,
 * it creates (or updates) a pulse_alert and sends a notification email.
 */
async function runAlertMonitor() {
  console.log('🔍 [AlertMonitor] Running sustained negative state check...');
  try {
    const pool = await db.getPool();

    // Get all distinct areas that have entries in the last 7 days
    const [areas] = await pool.query(`
      SELECT DISTINCT area
      FROM pulse_entries
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);

    for (const { area } of areas) {
      // Get daily averages for the last 7 days
      const [dailyAvgs] = await pool.query(`
        SELECT DATE(timestamp) as day, AVG(feeling_score) as avg_score, COUNT(*) as entries
        FROM pulse_entries
        WHERE area = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        GROUP BY DATE(timestamp)
        ORDER BY day DESC
        LIMIT 7
      `, [area]);

      if (dailyAvgs.length < 2) continue; // Need at least 2 days of data

      // Count consecutive negative days (avg < 3.0)
      let consecutiveNegDays = 0;
      for (const day of dailyAvgs) {
        if (parseFloat(day.avg_score) < 3.0) {
          consecutiveNegDays++;
        } else {
          break; // Stop at first non-negative day
        }
      }

      // Count consecutive "under observation" days (3.0 <= avg < 3.5)
      let consecutiveObsDays = 0;
      for (const day of dailyAvgs) {
        const avg = parseFloat(day.avg_score);
        if (avg >= 3.0 && avg < 3.5) {
          consecutiveObsDays++;
        } else {
          break;
        }
      }

      const recentAvg = parseFloat(dailyAvgs[0].avg_score);

      // ALERT: 3+ consecutive days below 3.0
      if (consecutiveNegDays >= 3) {
        const [existing] = await pool.query(
          `SELECT id FROM pulse_alerts WHERE area = ? AND status = 'unresolved' AND severity = 'en_alerta'`,
          [area]
        );

        if (existing.length === 0) {
          const msg = `El área "${area}" ha registrado ${consecutiveNegDays} días consecutivos con bienestar promedio bajo (${recentAvg.toFixed(2)}/5). Se requiere intervención inmediata del equipo de Bienestar RH.`;
          await pool.query(
            `INSERT INTO pulse_alerts (area, severity, message) VALUES (?, 'en_alerta', ?)`,
            [area, msg]
          );
          await notifier.sendWellnessAlertEmail(area, recentAvg, consecutiveNegDays, 'en_alerta');
          console.log(`🚨 [AlertMonitor] ALERT created for area: ${area} (${consecutiveNegDays} consecutive negative days)`);
        }

      // OBSERVATION: 3+ consecutive days between 3.0 and 3.5
      } else if (consecutiveObsDays >= 3) {
        const [existing] = await pool.query(
          `SELECT id FROM pulse_alerts WHERE area = ? AND status = 'unresolved' AND severity = 'en_observacion'`,
          [area]
        );

        if (existing.length === 0) {
          const msg = `El área "${area}" está en observación preventiva: ${consecutiveObsDays} días consecutivos con bienestar moderado (${recentAvg.toFixed(2)}/5). Se recomienda seguimiento proactivo.`;
          await pool.query(
            `INSERT INTO pulse_alerts (area, severity, message) VALUES (?, 'en_observacion', ?)`,
            [area, msg]
          );
          await notifier.sendWellnessAlertEmail(area, recentAvg, consecutiveObsDays, 'en_observacion');
          console.log(`⚠️ [AlertMonitor] OBSERVATION alert for area: ${area} (${consecutiveObsDays} consecutive moderate days)`);
        }
      }
    }

    console.log('✅ [AlertMonitor] Check complete.');
  } catch (err) {
    console.error('❌ [AlertMonitor] Error during check:', err.message);
  }
}

/**
 * Schedules the alert monitor to run every day at 8:00 PM (20:00)
 * and also runs an immediate check on startup.
 */
function startAlertScheduler() {
  // Run immediately on startup (after 5s delay to let DB init)
  setTimeout(() => runAlertMonitor(), 5000);

  // Schedule daily at 20:00
  cron.schedule('0 20 * * *', () => {
    runAlertMonitor();
  });

  console.log('⏰ [AlertMonitor] Scheduled daily at 20:00. Running initial check in 5s...');
}

module.exports = { startAlertScheduler, runAlertMonitor };
