const { google } = require('googleapis');
const { getPool } = require('./db');
const { parsePDF } = require('./pdfParser');
require('dotenv').config();

// Initialize Google Drive API client
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  scopes: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/drive.file'
  ]
});

const drive = google.drive({ version: 'v3', auth });

/**
 * Searches for a folder named "CONSULTAS" in Google Drive,
 * downloads any new PDF files, and indexes them in the MySQL database.
 * @returns {Promise<{success: boolean, message: string, syncedCount: number}>} Sync summary
 */
async function syncDriveFolder() {
  const pool = await getPool();
  let syncedCount = 0;
  const logMessages = [];

  try {
    // 1. Search for the folder named "CONSULTAS"
    const folderRes = await drive.files.list({
      q: "name = 'CONSULTAS' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    const folders = folderRes.data.files;
    if (!folders || folders.length === 0) {
      return {
        success: false,
        message: "No se encontró ninguna carpeta llamada 'CONSULTAS' en tu Google Drive. Por favor asegúrate de crearla e intentarlo de nuevo.",
        syncedCount: 0
      };
    }

    const folderId = folders[0].id;
    console.log(`📁 Found 'CONSULTAS' Google Drive folder. ID: ${folderId}`);

    // 2. Search for PDF files inside this folder
    const filesRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false`,
      fields: 'files(id, name)',
      spaces: 'drive'
    });

    const files = filesRes.data.files;
    if (!files || files.length === 0) {
      return {
        success: true,
        message: "La carpeta 'CONSULTAS' de Google Drive está vacía. Carga archivos PDF en ella e inténtalo de nuevo.",
        syncedCount: 0
      };
    }

    console.log(`🔍 Found ${files.length} PDFs inside 'CONSULTAS'. Checking if any need indexing...`);

    // 3. Check and index each PDF
    for (const file of files) {
      const filename = file.name;
      const title = filename.replace(/\.[^/.]+$/, ""); // Strip extension

      // Check if this document already exists in the database
      const [existing] = await pool.query(
        'SELECT id FROM documents WHERE filename = ? LIMIT 1',
        [filename]
      );

      if (existing.length > 0) {
        console.log(`✔ Document "${filename}" is already indexed. Skipping.`);
        continue;
      }

      console.log(`📥 Downloading and indexing new document: "${filename}"...`);
      
      // Download file stream from Google Drive
      const fileRes = await drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'stream' }
      );

      // Convert stream to Buffer
      const buffer = await new Promise((resolve, reject) => {
        const chunks = [];
        fileRes.data.on('data', (chunk) => chunks.push(chunk));
        fileRes.data.on('end', () => resolve(Buffer.concat(chunks)));
        fileRes.data.on('error', (err) => reject(err));
      });

      // Parse the PDF page-by-page
      const pages = await parsePDF(buffer);

      if (pages.length === 0) {
        console.log(`⚠ Skipped "${filename}" because it has no readable text.`);
        continue;
      }

      // Insert pages into MySQL database
      let conn = null;
      try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        // Save Document metadata
        const [docResult] = await conn.query(
          'INSERT INTO documents (filename, title, active) VALUES (?, ?, 1)',
          [filename, title]
        );
        const documentId = docResult.insertId;

        // Save Chunks
        for (const page of pages) {
          await conn.query(
            'INSERT INTO document_chunks (document_id, page_number, content) VALUES (?, ?, ?)',
            [documentId, page.pageNumber, page.text]
          );
        }

        await conn.commit();
        conn.release();
        
        syncedCount++;
        logMessages.push(`"${filename}" (${pages.length} pág.)`);
        console.log(`✅ Successfully indexed "${filename}" in MySQL.`);
      } catch (err) {
        if (conn) {
          await conn.rollback();
          conn.release();
        }
        console.error(`❌ Failed to index "${filename}":`, err.message);
      }
    }

    const summaryMsg = syncedCount > 0 
      ? `Sincronización exitosa. Se descargaron e indexaron ${syncedCount} nuevo(s) documento(s) de Drive: ${logMessages.join(', ')}.`
      : "Todos los documentos de la carpeta 'CONSULTAS' ya se encuentran completamente indexados y actualizados en el sistema.";

    return {
      success: true,
      message: summaryMsg,
      syncedCount
    };

  } catch (error) {
    console.error('Error syncing Google Drive folder:', error.message);
    return {
      success: false,
      message: `Error al conectar con Google Drive: ${error.message}. Por favor verifica tus credenciales.`,
      syncedCount: 0
    };
  }
}

module.exports = {
  syncDriveFolder
};
