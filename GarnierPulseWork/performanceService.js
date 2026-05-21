const db = require('./db');

/**
 * Returns combined wellness + performance data for cross-referencing.
 * For each area, computes:
 *   - avgWellnessScore (from pulse_entries)
 *   - avgPerformanceScore (from performance_evaluations if exists, else simulated)
 *   - correlationLabel: 'alta_correlacion' | 'correlacion_media' | 'sin_correlacion'
 */
async function getCrossData() {
  const pool = await db.getPool();

  // --- Wellness per area (pulse_entries)
  const [wellnessRows] = await pool.query(`
    SELECT
      area,
      AVG(feeling_score) AS avg_wellness,
      COUNT(*) AS total_entries,
      SUM(CASE WHEN feeling_score <= 2 THEN 1 ELSE 0 END) AS negative_count,
      SUM(CASE WHEN feeling_score >= 4 THEN 1 ELSE 0 END) AS positive_count
    FROM pulse_entries
    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY area
    ORDER BY avg_wellness DESC
  `);

  // --- Check if performance_evaluations table exists
  let performanceRows = [];
  try {
    const [perfCheck] = await pool.query(`SHOW TABLES LIKE 'performance_evaluations'`);
    if (perfCheck.length > 0) {
      const [rows] = await pool.query(`
        SELECT
          area,
          AVG(score) AS avg_performance,
          COUNT(*) AS total_evals
        FROM performance_evaluations
        WHERE evaluation_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY area
      `);
      performanceRows = rows;
    }
  } catch (e) {
    // Table doesn't exist yet — use simulated data
  }

  // Build cross-reference map
  const perfMap = {};
  performanceRows.forEach(r => {
    perfMap[r.area] = parseFloat(r.avg_performance);
  });

  // Generate simulated performance scores if no real data
  // (based on inverse correlation theory: higher stress → lower performance)
  const crossData = wellnessRows.map(row => {
    const area = row.area;
    const avgWellness = parseFloat(row.avg_wellness);
    
    // Real performance data if available, else simulate
    let avgPerformance;
    if (perfMap[area] !== undefined) {
      avgPerformance = perfMap[area];
    } else {
      // Simulated: performance correlates 70% with wellness + random variance
      const base = (avgWellness / 5) * 100; // Convert to 0-100 scale
      const noise = (Math.random() - 0.5) * 15;
      avgPerformance = Math.max(30, Math.min(100, base + noise + 5));
    }

    // Compute correlation: how well does wellness predict performance?
    const wellnessPct = (avgWellness / 5) * 100;
    const diff = Math.abs(wellnessPct - avgPerformance);
    let correlationLabel;
    if (diff < 15) correlationLabel = 'alta_correlacion';
    else if (diff < 30) correlationLabel = 'correlacion_media';
    else correlationLabel = 'sin_correlacion';

    // Wellness status
    let wellnessStatus;
    if (avgWellness >= 3.8) wellnessStatus = 'saludable';
    else if (avgWellness >= 3.0) wellnessStatus = 'en_observacion';
    else wellnessStatus = 'en_alerta';

    // Performance status
    let performanceStatus;
    if (avgPerformance >= 75) performanceStatus = 'alto';
    else if (avgPerformance >= 55) performanceStatus = 'medio';
    else performanceStatus = 'bajo';

    // Risk flag: low wellness + low performance = critical
    const riskFlag = avgWellness < 3.0 && avgPerformance < 55;

    return {
      area,
      avgWellness: avgWellness.toFixed(2),
      avgWellnessPct: wellnessPct.toFixed(1),
      avgPerformance: avgPerformance.toFixed(1),
      totalEntries: row.total_entries,
      negativeCount: row.negative_count,
      positiveCount: row.positive_count,
      wellnessStatus,
      performanceStatus,
      correlationLabel,
      riskFlag,
      isSimulated: perfMap[area] === undefined,
    };
  });

  // System-level summary
  const totalAreas = crossData.length;
  const criticalAreas = crossData.filter(d => d.riskFlag).length;
  const highCorrelationAreas = crossData.filter(d => d.correlationLabel === 'alta_correlacion').length;

  return {
    crossData,
    summary: {
      totalAreas,
      criticalAreas,
      highCorrelationAreas,
      hasRealPerformanceData: performanceRows.length > 0,
    }
  };
}

/**
 * Seeds simulated performance evaluations table for demo purposes
 */
async function seedPerformanceTable() {
  const pool = await db.getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS performance_evaluations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      area VARCHAR(100) NOT NULL,
      score FLOAT NOT NULL COMMENT '0 to 100 scale',
      evaluator VARCHAR(100),
      evaluation_date DATE DEFAULT (CURDATE()),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  const [existing] = await pool.query('SELECT COUNT(*) as cnt FROM performance_evaluations');
  if (existing[0].cnt > 0) return { seeded: false, message: 'Already has data' };

  const areas = ['Tecnología', 'Ventas', 'Administración', 'Recursos Humanos', 'Marketing', 'Logística'];
  const scores = {
    'Tecnología': [82, 78, 85, 79, 88],
    'Ventas': [74, 68, 71, 77, 70],
    'Administración': [91, 87, 89, 85, 92],
    'Recursos Humanos': [88, 84, 86, 90, 87],
    'Marketing': [65, 72, 68, 70, 74],
    'Logística': [55, 61, 58, 63, 57],
  };

  for (const area of areas) {
    const areaScores = scores[area] || [70, 72, 68];
    for (let i = 0; i < areaScores.length; i++) {
      const evalDate = new Date();
      evalDate.setDate(evalDate.getDate() - (i * 6));
      await pool.query(
        `INSERT INTO performance_evaluations (area, score, evaluator, evaluation_date, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [area, areaScores[i], 'Sistema Garnier Performance', evalDate.toISOString().split('T')[0],
         `Evaluación quincenal automatizada Q2 2024 — ${area}`]
      );
    }
  }

  return { seeded: true, count: areas.length * 5 };
}

module.exports = { getCrossData, seedPerformanceTable };
