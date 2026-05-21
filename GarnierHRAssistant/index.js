require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const { initDB, getPool } = require('./db');
const { parsePDF } = require('./pdfParser');
const { answerQuery } = require('./ragService');
const { escalateToHuman, checkAndAlertRecurrentUnanswered } = require('./emailService');
const { syncDriveFolder } = require('./driveService');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS so the React frontend (running on e.g. port 5173) can talk to Express (port 3001)
app.use(cors());
app.use(bodyParser.json());

// Setup Multer for memory storage file uploads (PDFs)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos en formato PDF.'), false);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Test route
app.get('/', (req, res) => {
  res.send('✅ Garnier HR Assistant API is running perfectly.');
});

// ----------------------------------------------------
// 1. CHAT CONVERSACIONAL (CON RAG)
// ----------------------------------------------------
app.post('/api/assistant/chat', async (req, res) => {
  const { mensaje, language } = req.body;
  if (!mensaje || !mensaje.trim()) {
    return res.status(400).json({ error: 'El mensaje no puede estar vacío.' });
  }

  try {
    const result = await answerQuery(mensaje, language || 'es');
    const pool = await getPool();

    // Determine the source document ID if present in sources
    let sourceId = null;
    if (result.answered && result.sources && result.sources.length > 0) {
      const firstSource = result.sources[0];
      const [docRows] = await pool.query(
        'SELECT id FROM documents WHERE filename = ? OR title = ? LIMIT 1',
        [firstSource.document, firstSource.document]
      );
      if (docRows.length > 0) {
        sourceId = docRows[0].id;
      }
    }

    // Save query logs to history database for analytics
    await pool.query(
      'INSERT INTO queries (query_text, answered, document_source_id) VALUES (?, ?, ?)',
      [mensaje, result.answered ? 1 : 0, sourceId]
    );

    // If query could not be resolved, log it in unanswered_queries for HR alerts
    if (!result.answered) {
      // Upsert unhandled query
      const [existing] = await pool.query(
        'SELECT id, frequency FROM unanswered_queries WHERE query_text = ?',
        [mensaje]
      );

      if (existing.length > 0) {
        await pool.query(
          'UPDATE unanswered_queries SET frequency = frequency + 1, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
          [existing[0].id]
        );
      } else {
        await pool.query(
          'INSERT INTO unanswered_queries (query_text, frequency) VALUES (?, 1)',
          [mensaje]
        );
      }

      // Check asynchronously if we should trigger automated alerts for recurring unanswered topics
      checkAndAlertRecurrentUnanswered().catch(console.error);
    }

    res.json({
      respuesta: result.response,
      sources: result.sources || [],
      answered: result.answered
    });

  } catch (error) {
    console.error('Chat error:', error.message);
    res.status(500).json({ error: 'Error interno en el servidor de IA.' });
  }
});

// ----------------------------------------------------
// 2. GESTIÓN DE DOCUMENTOS (UPLOAD, TOGGLE, DELETE, LIST)
// ----------------------------------------------------
app.get('/api/documents', async (req, res) => {
  try {
    const pool = await getPool();
    const [docs] = await pool.query(`
      SELECT d.*, COUNT(dc.id) as total_chunks
      FROM documents d
      LEFT JOIN document_chunks dc ON d.id = dc.document_id
      GROUP BY d.id
      ORDER BY d.uploaded_at DESC
    `);
    res.json(docs);
  } catch (error) {
    console.error('Get docs error:', error.message);
    res.status(500).json({ error: 'No se pudieron recuperar los documentos.' });
  }
});

app.post('/api/documents/upload', upload.single('documento'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se cargó ningún archivo PDF válido.' });
  }

  const pool = await getPool();
  let conn = null;

  try {
    const filename = req.file.originalname;
    const title = filename.replace(/\.[^/.]+$/, ""); // Strip extension

    // Parse the PDF page by page
    const pages = await parsePDF(req.file.buffer);

    if (pages.length === 0) {
      return res.status(400).json({ error: 'El archivo PDF no contiene texto legible.' });
    }

    // Get connection to perform transactional insertions
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // 1. Insert Document metadata
    const [docResult] = await conn.query(
      'INSERT INTO documents (filename, title, active) VALUES (?, ?, 1)',
      [filename, title]
    );
    const documentId = docResult.insertId;

    // 2. Insert page chunks
    for (const page of pages) {
      await conn.query(
        'INSERT INTO document_chunks (document_id, page_number, content) VALUES (?, ?, ?)',
        [documentId, page.pageNumber, page.text]
      );
    }

    await conn.commit();
    conn.release();

    res.json({
      success: true,
      message: `Documento "${filename}" cargado e indexado exitosamente (${pages.length} páginas).`,
      documentId
    });

  } catch (error) {
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('Upload error:', error.message);
    res.status(500).json({ error: `Error al procesar el documento: ${error.message}` });
  }
});

app.post('/api/documents/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    const [doc] = await pool.query('SELECT active FROM documents WHERE id = ?', [id]);
    
    if (doc.length === 0) {
      return res.status(404).json({ error: 'Documento no encontrado.' });
    }

    const newStatus = doc[0].active === 1 ? 0 : 1;
    await pool.query('UPDATE documents SET active = ? WHERE id = ?', [newStatus, id]);

    res.json({ success: true, active: newStatus });
  } catch (error) {
    console.error('Toggle error:', error.message);
    res.status(500).json({ error: 'Error al cambiar el estado del documento.' });
  }
});

app.delete('/api/documents/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    // Cascade constraints on document_chunks table handle automatic chunk cleanup
    await pool.query('DELETE FROM documents WHERE id = ?', [id]);
    res.json({ success: true, message: 'Documento eliminado correctamente.' });
  } catch (error) {
    console.error('Delete error:', error.message);
    res.status(500).json({ error: 'Error al eliminar el documento.' });
  }
});

// ----------------------------------------------------
// 3. SINCRONIZACIÓN DE GOOGLE DRIVE (CARPETA "CONSULTAS")
// ----------------------------------------------------
app.post('/api/drive/sync', async (req, res) => {
  try {
    const result = await syncDriveFolder();
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json({ error: result.message });
    }
  } catch (error) {
    console.error('Drive sync error:', error.message);
    res.status(500).json({ error: 'Error al sincronizar desde Google Drive.' });
  }
});

// ----------------------------------------------------
// 4. ESCALACIONES A AGENTE HUMANO
// ----------------------------------------------------
app.get('/api/escalations', async (req, res) => {
  try {
    const pool = await getPool();
    const [rows] = await pool.query('SELECT * FROM escalations ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Get escalations error:', error.message);
    res.status(500).json({ error: 'Error al recuperar las escalaciones.' });
  }
});

app.post('/api/escalations', async (req, res) => {
  const { nombre, correo, pregunta } = req.body;
  if (!nombre || !correo || !pregunta) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const result = await escalateToHuman({ name: nombre, email: correo, query: pregunta });
    res.json({
      success: true,
      message: 'Escalación registrada exitosamente. Un agente de RH revisará el caso.',
      caseId: result.caseId
    });
  } catch (error) {
    console.error('Escalation error:', error.message);
    res.status(500).json({ error: 'Error al procesar la escalación.' });
  }
});

app.post('/api/escalations/:id/resolve', async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await getPool();
    await pool.query(
      'UPDATE escalations SET status = "resolved", resolved_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    res.json({ success: true, message: 'Caso marcado como resuelto.' });
  } catch (error) {
    console.error('Resolve escalation error:', error.message);
    res.status(500).json({ error: 'Error al resolver la escalación.' });
  }
});

// ----------------------------------------------------
// 5. ESTADÍSTICAS Y ANALÍTICAS PARA RH
// ----------------------------------------------------
app.get('/api/analytics', async (req, res) => {
  try {
    const pool = await getPool();

    // a. Total queries answered vs unanswered
    const [queryCounts] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN answered = 1 THEN 1 ELSE 0 END) as answered,
        SUM(CASE WHEN answered = 0 THEN 1 ELSE 0 END) as unanswered
      FROM queries
    `);

    // b. Top 5 most frequent questions (answered)
    const [topTopics] = await pool.query(`
      SELECT query_text, COUNT(*) as count
      FROM queries
      WHERE answered = 1
      GROUP BY query_text
      ORDER BY count DESC
      LIMIT 5
    `);

    // c. Unresolved questions list
    const [unresolvedList] = await pool.query(`
      SELECT * 
      FROM unanswered_queries
      ORDER BY frequency DESC, last_seen DESC
    `);

    // d. Document counts
    const [docStats] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as inactive
      FROM documents
    `);

    res.json({
      queries: {
        total: queryCounts[0].total || 0,
        answered: queryCounts[0].answered || 0,
        unanswered: queryCounts[0].unanswered || 0
      },
      topTopics,
      unresolvedList,
      documents: {
        total: docStats[0].total || 0,
        active: docStats[0].active || 0,
        inactive: docStats[0].inactive || 0
      }
    });

  } catch (error) {
    console.error('Analytics error:', error.message);
    res.status(500).json({ error: 'Error al calcular las estadísticas de analítica.' });
  }
});

// ----------------------------------------------------
// SERVER START & AUTOMATIC DATABASE INITIALIZATION
// ----------------------------------------------------
async function startServer() {
  try {
    // Automatically initialize database & tables
    await initDB();
    
    app.listen(port, () => {
      console.log(`🚀 Garnier HR Assistant running on http://localhost:${port}`);
    });
  } catch (error) {
    console.error('❌ Server startup halted due to database connection error.');
    process.exit(1);
  }
}

startServer();