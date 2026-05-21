require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDB, getPool } = require('./db');
const { getENPSMetrics, getLikertAverages, groupBy } = require('./analyticsService');
const { analyzeOpenComments } = require('./aiService');
const { buildWorkbook } = require('./excelService');
const { uploadExcelToDrive } = require('./driveService');

const app = express();
const port = Number(process.env.PORT || 3003);

app.use(cors());
app.use(bodyParser.json());

const LIKERT_FIELDS = [
  'leadership_score',
  'communication_score',
  'growth_score',
  'benefits_score',
  'culture_score',
  'work_life_score'
];

function validateSurvey(body) {
  const requiredText = ['area', 'puesto', 'antiguedad', 'open_positive', 'open_improve'];
  for (const k of requiredText) {
    if (typeof body[k] !== 'string' || !body[k].trim()) return `Campo requerido: ${k}`;
  }
  if (!Number.isInteger(body.enps_score) || body.enps_score < 0 || body.enps_score > 10) {
    return 'enps_score debe ser entero entre 0 y 10.';
  }
  for (const k of LIKERT_FIELDS) {
    if (!Number.isInteger(body[k]) || body[k] < 1 || body[k] > 5) {
      return `${k} debe ser entero entre 1 y 5.`;
    }
  }
  return null;
}

async function getDashboardData() {
  const pool = await getPool();
  const [rows] = await pool.query('SELECT * FROM enps_surveys ORDER BY created_at DESC');

  const global = getENPSMetrics(rows);
  const likertGlobal = getLikertAverages(rows);
  const byArea = groupBy(rows, 'area');
  const byPuesto = groupBy(rows, 'puesto');
  const byAntiguedad = groupBy(rows, 'antiguedad');

  const orderedLikert = Object.entries(likertGlobal).sort((a, b) => a[1] - b[1]);
  const weakDimensions = orderedLikert.slice(0, 2).map(([k]) => k);

  const comments = rows.flatMap(r => [r.open_positive, r.open_improve]);
  const aiReport = await analyzeOpenComments(comments, weakDimensions);

  return {
    global,
    likertGlobal,
    weakDimensions,
    byArea,
    byPuesto,
    byAntiguedad,
    participation: {
      answered: rows.length,
      totalEmployees: Number(process.env.TOTAL_EMPLOYEES || 0),
      participationPct: Number(process.env.TOTAL_EMPLOYEES)
        ? Number(((rows.length / Number(process.env.TOTAL_EMPLOYEES)) * 100).toFixed(2))
        : null
    },
    aiReport
  };
}

app.get('/api/health', (_, res) => res.json({ status: 'ok', module: 'Garnier eNPS' }));

app.post('/api/enps/survey', async (req, res) => {
  const err = validateSurvey(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    const pool = await getPool();
    const payload = req.body;
    await pool.query(
      `INSERT INTO enps_surveys
      (area, puesto, antiguedad, enps_score, leadership_score, communication_score, growth_score, benefits_score, culture_score, work_life_score, open_positive, open_improve)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.area.trim(),
        payload.puesto.trim(),
        payload.antiguedad.trim(),
        payload.enps_score,
        payload.leadership_score,
        payload.communication_score,
        payload.growth_score,
        payload.benefits_score,
        payload.culture_score,
        payload.work_life_score,
        payload.open_positive.trim(),
        payload.open_improve.trim()
      ]
    );
    res.status(201).json({ message: 'Encuesta registrada correctamente (anonima).' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al registrar la encuesta.' });
  }
});

app.get('/api/enps/dashboard', async (_, res) => {
  try {
    res.json(await getDashboardData());
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al construir dashboard.' });
  }
});

app.get('/api/enps/export/excel', async (_, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM enps_surveys ORDER BY created_at DESC');
    const dashboard = await getDashboardData();
    const buffer = buildWorkbook(rows, dashboard);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=\"garnier-enps-dashboard.xlsx\"');
    res.send(buffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al exportar Excel.' });
  }
});

app.post('/api/enps/export/publish', async (_, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM enps_surveys ORDER BY created_at DESC');
    const dashboard = await getDashboardData();
    const buffer = buildWorkbook(rows, dashboard);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `garnier-enps-dashboard-${ts}.xlsx`;
    const driveFile = await uploadExcelToDrive(buffer, filename);

    res.json({
      message: 'Excel exportado y publicado en Google Drive.',
      driveFile
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: `Error al publicar en Drive: ${e.message}` });
  }
});

initDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Garnier eNPS API corriendo en http://localhost:${port}`);
    });
  })
  .catch(err => {
    console.error('No se pudo iniciar eNPS API:', err);
    process.exit(1);
  });
