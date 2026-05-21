const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

const db = require('./db');
const sheetService = require('./sheetService');
const aiService = require('./aiService');
const notifier = require('./notifier');
const pdfService = require('./pdfService');
const performanceService = require('./performanceService');
const alertScheduler = require('./alertScheduler');
const { uploadPdfToDrive } = require('./driveService');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(bodyParser.json());


// Emojis score map
const FEELING_SCORE_MAP = {
  muy_bien: 5,
  bien: 4,
  neutral: 3,
  estresado: 2,
  desmotivado: 1
};

// Positive Quotes list for gamification modal
const POSITIVE_QUOTES = [
  { es: "¡Tu bienestar es nuestra prioridad! Gracias por compartir cómo te sientes hoy.", en: "Your well-being is our priority! Thank you for sharing how you feel today." },
  { es: "Cada día es una nueva oportunidad para brillar. ¡Que tengas un excelente día laboral!", en: "Every day is a new opportunity to shine. Have a wonderful workday!" },
  { es: "El éxito es la suma de pequeños esfuerzos repetidos día tras día. ¡Adelante equipo!", en: "Success is the sum of small efforts repeated day in and day out. Go team!" },
  { es: "Recordá tomar pausas activas hoy para cuidar de tu mente y cuerpo.", en: "Remember to take active breaks today to care for your mind and body." },
  { es: "Tu energía y dedicación hacen de Garnier un mejor lugar todos los días.", en: "Your energy and dedication make Garnier a better place every day." }
];

/**
 * 1. Submit a new micro-pulse daily registration
 */
app.post('/api/pulse/submit', async (req, res) => {
  const { email, feeling, influences, comment } = req.body;

  if (!email || !feeling || !Array.isArray(influences)) {
    return res.status(400).json({ error: 'Faltan campos obligatorios en el envío del pulso.' });
  }

  const score = FEELING_SCORE_MAP[feeling] || 3;

  try {
    const pool = await db.getPool();

    // Find the collaborator's area and identity
    const [colRows] = await pool.query('SELECT * FROM pulse_collaborators WHERE email = ?', [email]);
    if (colRows.length === 0) {
      return res.status(404).json({ error: 'Colaborador no encontrado en el sistema.' });
    }
    const collaborator = colRows[0];
    const area = collaborator.area;

    // AI Analysis (sentiment score and topics) on Q3 Comment
    let sentimentScore = 0.0;
    let sentimentLabel = 'neutral';
    let topics = [];

    if (comment && comment.trim().length > 0) {
      const aiAnalysis = await aiService.analyzeComment(comment);
      sentimentScore = aiAnalysis.sentimentScore;
      sentimentLabel = aiAnalysis.sentimentLabel;
      topics = aiAnalysis.topics;
    } else {
      // Basic estimated sentiment from emoji score
      if (score >= 4) {
        sentimentScore = 0.5;
        sentimentLabel = 'positivo';
      } else if (score <= 2) {
        sentimentScore = -0.5;
        sentimentLabel = 'negativo';
      }
    }

    // A. Insert anonymized entry into pulse_entries (NO reference to collaborator.id!)
    await pool.query(
      `INSERT INTO pulse_entries (area, feeling, feeling_score, influences, comment, sentiment_score, sentiment_label, topics)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [area, feeling, score, JSON.stringify(influences), comment || '', sentimentScore, sentimentLabel, JSON.stringify(topics)]
    );

    // B. Log record in Google Sheets 'RegistroDiario'
    await sheetService.appendEntryToSheet(area, score, comment || '');

    // C. Update Collaborator daily streaks and points for gamification
    const todayStr = new Date().toISOString().split('T')[0];
    const [streakRows] = await pool.query('SELECT * FROM pulse_streaks WHERE collaborator_id = ?', [collaborator.id]);

    let newStreak = 1;
    let addedPoints = 100;
    let currentPoints = 100;

    if (streakRows.length === 0) {
      // Create first streak record
      await pool.query(
        'INSERT INTO pulse_streaks (collaborator_id, streak_count, points, last_registration) VALUES (?, ?, ?, ?)',
        [collaborator.id, newStreak, addedPoints, todayStr]
      );
    } else {
      const streakInfo = streakRows[0];
      const lastReg = streakInfo.last_registration;
      currentPoints = streakInfo.points;

      if (lastReg) {
        const lastRegDate = new Date(lastReg);
        const todayDate = new Date(todayStr);
        const diffTime = Math.abs(todayDate - lastRegDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Consecutive registration
          newStreak = streakInfo.streak_count + 1;
          addedPoints = 100 * newStreak; // Extra points for streak
          currentPoints += addedPoints;
        } else if (diffDays === 0) {
          // Already registered today
          newStreak = streakInfo.streak_count;
          addedPoints = 0; // No extra points
        } else {
          // Streak broken
          newStreak = 1;
          addedPoints = 100;
          currentPoints += addedPoints;
        }
      }

      await pool.query(
        'UPDATE pulse_streaks SET streak_count = ?, points = ?, last_registration = ? WHERE collaborator_id = ?',
        [newStreak, currentPoints, todayStr, collaborator.id]
      );
    }

    // D. Wellness alert monitoring checks:
    // If the last 3 entries for this area have an average rating < 3.0, trigger an email alert!
    const [recentEntries] = await pool.query(
      `SELECT feeling_score FROM pulse_entries WHERE area = ? ORDER BY timestamp DESC LIMIT 3`,
      [area]
    );

    if (recentEntries.length >= 3) {
      const recentAvg = recentEntries.reduce((sum, e) => sum + e.feeling_score, 0) / 3;
      
      if (recentAvg < 3.0) {
        // High alert trigger
        const alertMessage = `El promedio reciente de bienestar del área ${area} ha caído críticamente a ${recentAvg.toFixed(2)} sobre 5. Se han detectado síntomas continuos de estrés y desmotivación.`;
        
        // Log to DB if no unresolved alert of high severity is active for this area
        const [activeAlerts] = await pool.query(
          `SELECT * FROM pulse_alerts WHERE area = ? AND status = 'unresolved' AND severity = 'en_alerta'`,
          [area]
        );
        if (activeAlerts.length === 0) {
          await pool.query(
            `INSERT INTO pulse_alerts (area, severity, message) VALUES (?, ?, ?)`,
            [area, 'en_alerta', alertMessage]
          );
          // Send Simulated Alert Email
          await notifier.sendWellnessAlertEmail(area, recentAvg, 3, 'en_alerta');
        }
      } else if (recentAvg < 3.5) {
        // Warning observation
        const obsMessage = `El promedio de bienestar del área ${area} está bajo observación en ${recentAvg.toFixed(2)} sobre 5.`;
        const [activeObs] = await pool.query(
          `SELECT * FROM pulse_alerts WHERE area = ? AND status = 'unresolved' AND severity = 'en_observacion'`,
          [area]
        );
        if (activeObs.length === 0) {
          await pool.query(
            `INSERT INTO pulse_alerts (area, severity, message) VALUES (?, ?, ?)`,
            [area, 'en_observacion', obsMessage]
          );
          await notifier.sendWellnessAlertEmail(area, recentAvg, 3, 'en_observacion');
        }
      }
    }

    // Pick a positive quote
    const randQuote = POSITIVE_QUOTES[Math.floor(Math.random() * POSITIVE_QUOTES.length)];

    return res.json({
      success: true,
      streak: newStreak,
      pointsAdded: addedPoints,
      totalPoints: currentPoints,
      quote: randQuote
    });

  } catch (error) {
    console.error('Error in pulse submit:', error.message);
    res.status(500).json({ error: 'Error del servidor al registrar el pulso emocional.' });
  }
});

/**
 * 2. Get anonymized dashboard metrics for manager view
 */
app.get('/api/pulse/dashboard', async (req, res) => {
  try {
    const pool = await db.getPool();

    // A. Overall wellness score
    const [overallRow] = await pool.query(`SELECT AVG(feeling_score) as avgScore, COUNT(*) as totalCount FROM pulse_entries`);
    const overallAvg = parseFloat(overallRow[0].avgScore) || 0.0;
    const totalRegistrations = overallRow[0].totalCount || 0;

    // B. Area averages comparisons
    const [areaRows] = await pool.query(`
      SELECT area, AVG(feeling_score) as score, COUNT(*) as count 
      FROM pulse_entries 
      GROUP BY area
    `);

    // Map areas wellness status classification dynamically
    const areaWellness = areaRows.map(row => {
      const score = parseFloat(row.score) || 0.0;
      let status = 'saludable';
      if (score < 3.0) status = 'en_alerta';
      else if (score < 3.8) status = 'en_observacion';

      return {
        area: row.area,
        score: score.toFixed(2),
        count: row.count,
        status
      };
    });

    // C. Emotional distribution (muy_bien, bien, neutral, estresado, desmotivado)
    const [distributionRows] = await pool.query(`
      SELECT feeling, COUNT(*) as count 
      FROM pulse_entries 
      GROUP BY feeling
    `);
    const distribution = {
      muy_bien: 0,
      bien: 0,
      neutral: 0,
      estresado: 0,
      desmotivado: 0
    };
    distributionRows.forEach(row => {
      if (distribution[row.feeling] !== undefined) {
        distribution[row.feeling] = row.count;
      }
    });

    // D. Keyword frequencies & recurring topics
    const [topicRows] = await pool.query(`SELECT topics FROM pulse_entries WHERE topics IS NOT NULL`);
    const topicsMap = {};
    topicRows.forEach(row => {
      try {
        const parsed = JSON.parse(row.topics);
        if (Array.isArray(parsed)) {
          parsed.forEach(t => {
            topicsMap[t] = (topicsMap[t] || 0) + 1;
          });
        }
      } catch (e) {
        // Suppress parse errors
      }
    });

    const recurringTopics = Object.keys(topicsMap).map(name => ({
      name,
      value: topicsMap[name]
    })).sort((a, b) => b.value - a.value).slice(0, 10);

    // E. Monthly and Weekly historical trend points
    // Let's aggregate average score by day of the last 30 days
    const [trendRows] = await pool.query(`
      SELECT DATE(timestamp) as dateStr, AVG(feeling_score) as avgScore 
      FROM pulse_entries 
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(timestamp)
      ORDER BY dateStr ASC
    `);

    // F. Active alerts log
    const [alertRows] = await pool.query(`
      SELECT * FROM pulse_alerts 
      WHERE status = 'unresolved' 
      ORDER BY created_at DESC
    `);

    // G. Active collaborators list and participation percentages
    const [colCountRow] = await pool.query('SELECT COUNT(*) as count FROM pulse_collaborators');
    const totalCollaborators = colCountRow[0].count || 1;
    const participationRate = Math.min(100, Math.round((totalRegistrations / (totalCollaborators * 30)) * 100)) || 85; // Est. 30 days scale

    res.json({
      overallAverage: overallAvg.toFixed(2),
      totalRegistrations,
      areaWellness,
      distribution,
      recurringTopics,
      trend: trendRows.map(row => ({
        date: new Date(row.dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        score: parseFloat(row.avgScore).toFixed(2)
      })),
      alerts: alertRows,
      participationRate
    });

  } catch (error) {
    console.error('Error fetching dashboard analytics:', error.message);
    res.status(500).json({ error: 'Error del servidor al recuperar datos del panel.' });
  }
});

/**
 * 3. Generate a customized climate report for an area using Gemini
 */
app.post('/api/pulse/generate-report', async (req, res) => {
  const { area, period } = req.body;

  if (!area || !period) {
    return res.status(400).json({ error: 'Debe especificar el área y el periodo del reporte.' });
  }

  try {
    const pool = await db.getPool();

    // Retrieve entries for the targeted area and period
    const interval = period === 'semana' ? '7 DAY' : '30 DAY';
    const [entries] = await pool.query(
      `SELECT * FROM pulse_entries 
       WHERE area = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ${interval})
       ORDER BY timestamp DESC`,
      [area]
    );

    const report = await aiService.generateClimateReport(area, period, entries);
    res.json(report);

  } catch (error) {
    console.error('Error generating AI climate report route:', error.message);
    res.status(500).json({ error: 'Error del servidor al generar el reporte del clima laboral.' });
  }
});

/**
 * 4. Trigger historical excel import from Google Drive
 */
app.post('/api/pulse/sync-historical', async (req, res) => {
  try {
    const result = await sheetService.importHistoricalBaseline();
    res.json({ success: true, message: `Se importaron exitosamente ${result.count} registros históricos de bienestar laboral.` });
  } catch (error) {
    console.error('Error syncing historical baseline:', error.message);
    res.status(500).json({ error: `Fallo al importar la plantilla de Excel: ${error.message}` });
  }
});

/**
 * 5. Fetch collaborators registry
 */
app.get('/api/pulse/collaborators', async (req, res) => {
  try {
    const pool = await db.getPool();
    const [rows] = await pool.query('SELECT * FROM pulse_collaborators ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al recuperar colaboradores.' });
  }
});

/**
 * 6. Get streak and points for active collaborator
 */
app.get('/api/pulse/streaks/:email', async (req, res) => {
  const { email } = req.params;
  try {
    const pool = await db.getPool();
    const [rows] = await pool.query(
      `SELECT s.*, c.name, c.area 
       FROM pulse_streaks s
       JOIN pulse_collaborators c ON s.collaborator_id = c.id
       WHERE c.email = ?`,
      [email]
    );

    if (rows.length === 0) {
      return res.json({ streak_count: 0, points: 0, last_registration: null });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al recuperar la racha del colaborador.' });
  }
});

/**
 * 7. Resolve an active wellness alert
 */
app.post('/api/pulse/alerts/:id/resolve', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await db.getPool();
    await pool.query("UPDATE pulse_alerts SET status = 'resolved' WHERE id = ?", [id]);
    res.json({ success: true, message: 'Alerta de bienestar laboral marcada como resuelta.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al resolver alerta.' });
  }
});

// ═══════════════════════════════════════════════════════
// 8. EXPORT CLIMATE REPORT AS PDF
// ═══════════════════════════════════════════════════════
app.post('/api/pulse/export-pdf', async (req, res) => {
  const { area, period } = req.body;
  if (!area || !period) {
    return res.status(400).json({ error: 'Área y período requeridos.' });
  }

  try {
    const pool = await db.getPool();
    const interval = period === 'semana' ? '7 DAY' : '30 DAY';
    const [entries] = await pool.query(
      `SELECT * FROM pulse_entries WHERE area = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL ${interval}) ORDER BY timestamp DESC`,
      [area]
    );

    // Get AI climate report
    const report = await aiService.generateClimateReport(area, period, entries);

    // Get dashboard data for charts
    const [overallRow] = await pool.query('SELECT AVG(feeling_score) as avgScore, COUNT(*) as totalCount FROM pulse_entries');
    const [areaRows] = await pool.query('SELECT area, AVG(feeling_score) as score, COUNT(*) as count FROM pulse_entries GROUP BY area');
    const [distRows] = await pool.query('SELECT feeling, COUNT(*) as count FROM pulse_entries GROUP BY feeling');
    const [alertRows] = await pool.query("SELECT * FROM pulse_alerts WHERE status = 'unresolved' ORDER BY created_at DESC");
    const [topicRows] = await pool.query('SELECT topics FROM pulse_entries WHERE topics IS NOT NULL');
    const [colCountRow] = await pool.query('SELECT COUNT(*) as count FROM pulse_collaborators');

    const distribution = { muy_bien: 0, bien: 0, neutral: 0, estresado: 0, desmotivado: 0 };
    distRows.forEach(r => { if (distribution[r.feeling] !== undefined) distribution[r.feeling] = r.count; });

    const topicsMap = {};
    topicRows.forEach(row => {
      try { JSON.parse(row.topics).forEach(t => { topicsMap[t] = (topicsMap[t] || 0) + 1; }); } catch(e) {}
    });
    const recurringTopics = Object.keys(topicsMap).map(name => ({ name, value: topicsMap[name] })).sort((a,b) => b.value - a.value).slice(0, 10);

    const totalCollaborators = colCountRow[0].count || 1;
    const totalRegistrations = overallRow[0].totalCount || 0;

    const dashboardData = {
      overallAverage: (parseFloat(overallRow[0].avgScore) || 0).toFixed(2),
      totalRegistrations,
      areaWellness: areaRows.map(r => ({
        area: r.area,
        score: parseFloat(r.score).toFixed(2),
        count: r.count,
        status: parseFloat(r.score) < 3.0 ? 'en_alerta' : parseFloat(r.score) < 3.8 ? 'en_observacion' : 'saludable'
      })),
      distribution,
      recurringTopics,
      alerts: alertRows,
      participationRate: Math.min(100, Math.round((totalRegistrations / (totalCollaborators * 30)) * 100)) || 85,
    };

    // Generate PDF buffer
    const pdfBuffer = await pdfService.generateClimatePDF({ area, period, report, dashboardData });

    const filename = `Reporte_Clima_${area.replace(/\s+/g, '_')}_${period}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Error generating PDF:', error.message);
    res.status(500).json({ error: 'Error al generar el reporte PDF.' });
  }
});

app.post('/api/pulse/export/publish', async (req, res) => {
  try {
    const { period } = req.body;
    const dashboard = await getDashboardData(period);
    const buffer = await pdfService.generateClimatePDF(dashboard);
    
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `garnier-pulse-report-${ts}.pdf`;
    const driveFile = await uploadPdfToDrive(buffer, filename);

    res.json({
      message: 'Reporte PDF exportado y publicado en Google Drive.',
      driveFile
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: `Error al publicar en Drive: ${e.message}` });
  }
});

// ═══════════════════════════════════════════════════════
// 9. CALENDAR — HIGH WORKLOAD DATES MANAGEMENT
// ═══════════════════════════════════════════════════════
app.get('/api/pulse/calendar', async (req, res) => {
  try {
    const pool = await db.getPool();

    // Get daily wellness averages for the last 60 days
    const [dailyAvgs] = await pool.query(`
      SELECT DATE(timestamp) as day,
             AVG(feeling_score) as avg_score,
             COUNT(*) as entries,
             SUM(CASE WHEN feeling_score <= 2 THEN 1 ELSE 0 END) as neg_count
      FROM pulse_entries
      WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 60 DAY)
      GROUP BY DATE(timestamp)
      ORDER BY day ASC
    `);

    // Get high workload dates
    const [workloadDates] = await pool.query(`
      SELECT * FROM pulse_workload_dates ORDER BY workload_date ASC
    `).catch(() => [[]]);

    res.json({
      dailyData: dailyAvgs.map(d => ({
        date: d.day,
        score: parseFloat(d.avg_score).toFixed(2),
        entries: d.entries,
        negCount: d.neg_count,
        status: parseFloat(d.avg_score) < 3.0 ? 'en_alerta' : parseFloat(d.avg_score) < 3.8 ? 'en_observacion' : 'saludable'
      })),
      workloadDates
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al recuperar datos del calendario.' });
  }
});

app.post('/api/pulse/calendar/workload', async (req, res) => {
  const { date, label, severity } = req.body;
  if (!date || !label) return res.status(400).json({ error: 'Fecha y etiqueta requeridas.' });

  try {
    const pool = await db.getPool();
    // Auto-create the workload table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pulse_workload_dates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        workload_date DATE NOT NULL,
        label VARCHAR(255) NOT NULL,
        severity VARCHAR(50) DEFAULT 'alta', -- 'alta', 'media', 'baja'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);
    await pool.query(
      'INSERT INTO pulse_workload_dates (workload_date, label, severity) VALUES (?, ?, ?)',
      [date, label, severity || 'alta']
    );
    res.json({ success: true, message: 'Fecha de alta carga registrada.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar la fecha de alta carga.' });
  }
});

app.delete('/api/pulse/calendar/workload/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await db.getPool();
    await pool.query('DELETE FROM pulse_workload_dates WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la fecha de alta carga.' });
  }
});

// ═══════════════════════════════════════════════════════
// 10. PERFORMANCE CROSS-REFERENCE (Proyecto 04 integration)
// ═══════════════════════════════════════════════════════
app.get('/api/pulse/performance-cross', async (req, res) => {
  try {
    const data = await performanceService.getCrossData();
    res.json(data);
  } catch (error) {
    console.error('Error in performance cross-reference:', error.message);
    res.status(500).json({ error: 'Error al cruzar datos de bienestar y desempeño.' });
  }
});

app.post('/api/pulse/performance-seed', async (req, res) => {
  try {
    const result = await performanceService.seedPerformanceTable();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error al sembrar datos de desempeño.' });
  }
});

// ═══════════════════════════════════════════════════════
// 11. GAMIFICATION — LEADERBOARD (anonymized by area)
// ═══════════════════════════════════════════════════════
app.get('/api/pulse/leaderboard', async (req, res) => {
  try {
    const pool = await db.getPool();

    // Area leaderboard: by average streak and total points among funcionarios
    const [areaBoard] = await pool.query(`
      SELECT c.area,
             AVG(s.streak_count) as avg_streak,
             SUM(s.points) as total_points,
             COUNT(s.collaborator_id) as active_members
      FROM pulse_streaks s
      JOIN pulse_collaborators c ON s.collaborator_id = c.id
      GROUP BY c.area
      ORDER BY total_points DESC
    `);

    // Individual leaderboard — show first name + initial only (partial anonymization)
    const [individualBoard] = await pool.query(`
      SELECT
        CONCAT(SUBSTRING_INDEX(c.name, ' ', 1), ' ', LEFT(SUBSTRING_INDEX(c.name, ' ', -1), 1), '.') as display_name,
        c.area,
        s.streak_count,
        s.points,
        s.last_registration
      FROM pulse_streaks s
      JOIN pulse_collaborators c ON s.collaborator_id = c.id
      WHERE c.role = 'funcionario'
      ORDER BY s.points DESC
      LIMIT 10
    `);

    // Level system
    const getLevelInfo = (points) => {
      if (points >= 5000) return { level: 10, title: '🏆 Embajador Wellness', color: '#f59e0b' };
      if (points >= 3000) return { level: 8, title: '💎 Campeón del Bienestar', color: '#8b5cf6' };
      if (points >= 2000) return { level: 6, title: '🥇 Guardián de Salud', color: '#10b981' };
      if (points >= 1000) return { level: 4, title: '🥈 Colaborador Activo', color: '#6366f1' };
      if (points >= 500)  return { level: 3, title: '🥉 Participante Consistente', color: '#06b6d4' };
      if (points >= 200)  return { level: 2, title: '⭐ Nuevo Explorador', color: '#64748b' };
      return { level: 1, title: '🌱 Comenzando', color: '#475569' };
    };

    // Badges system
    const getBadges = (streak, points) => {
      const badges = [];
      if (streak >= 7)  badges.push({ icon: '🔥', label: 'Semana perfecta', color: '#f97316' });
      if (streak >= 14) badges.push({ icon: '⚡', label: '2 semanas seguidas', color: '#f59e0b' });
      if (streak >= 30) badges.push({ icon: '🌟', label: 'Mes completo', color: '#8b5cf6' });
      if (points >= 1000) badges.push({ icon: '💯', label: '1K puntos', color: '#10b981' });
      if (points >= 5000) badges.push({ icon: '🏆', label: 'Élite Wellness', color: '#f59e0b' });
      return badges;
    };

    res.json({
      areaLeaderboard: areaBoard.map(a => ({
        area: a.area,
        avgStreak: parseFloat(a.avg_streak).toFixed(1),
        totalPoints: a.total_points,
        activeMembers: a.active_members,
      })),
      individualLeaderboard: individualBoard.map((p, idx) => ({
        rank: idx + 1,
        displayName: p.display_name,
        area: p.area,
        streak: p.streak_count,
        points: p.points,
        lastRegistration: p.last_registration,
        levelInfo: getLevelInfo(p.points),
        badges: getBadges(p.streak_count, p.points),
      })),
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error.message);
    res.status(500).json({ error: 'Error al obtener el leaderboard.' });
  }
});

// ═══════════════════════════════════════════════════════
// 12. MANUAL ALERT CHECK TRIGGER
// ═══════════════════════════════════════════════════════
app.post('/api/pulse/run-alert-check', async (req, res) => {
  try {
    await alertScheduler.runAlertMonitor();
    res.json({ success: true, message: 'Verificación de alertas ejecutada exitosamente.' });
  } catch (error) {
    res.status(500).json({ error: 'Error al ejecutar la verificación de alertas.' });
  }
});

// Start backend server
async function startServer() {
  try {
    await db.initDB();
    // Seed demo performance data for cross-reference
    await performanceService.seedPerformanceTable().catch(() => {});
    // Start the automatic alert scheduler
    alertScheduler.startAlertScheduler();
    app.listen(PORT, () => {
      console.log(`🚀 PulseWork running on http://localhost:${PORT}`);
      console.log(`📋 Endpoints: submit | dashboard | generate-report | export-pdf | calendar | performance-cross | leaderboard`);
    });
  } catch (err) {
    console.error('Unable to start backend server:', err.message);
  }
}

startServer();

