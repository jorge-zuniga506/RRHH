const { google } = require('googleapis');
const path = require('path');
const XLSX = require('xlsx');
const db = require('./db');

// Path to Google service account key
const KEY_FILE = path.join(__dirname, "../src/config/garnier-hr-service-account.json");

// Helper to authenticate
function getGoogleAuth(scopes) {
  return new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes
  });
}

/**
 * Appends a daily emotion micro-pulse entry to the Google Sheet
 */
async function appendEntryToSheet(area, score, comment) {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/spreadsheets']);
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.EMOCIONES_SHEET_ID;

    if (!spreadsheetId) {
      console.warn('⚠️ EMOCIONES_SHEET_ID is not configured in .env. Skipping sheet sync.');
      return;
    }

    const timestamp = new Date().toISOString();
    
    // Values to append: [Timestamp, Area, Score, Comment]
    const values = [[timestamp, area, score, comment || '']];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'RegistroDiario!A:D',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });

    console.log('✅ Successfully appended entry to Google Sheet.');
  } catch (error) {
    console.error('❌ Failed to append entry to Google Sheet:', error.message);
  }
}

/**
 * Syncs and imports historical baseline from Drive file "Encuesta Clima 2024.xlsx"
 */
async function importHistoricalBaseline() {
  try {
    const auth = getGoogleAuth(['https://www.googleapis.com/auth/drive.readonly']);
    const drive = google.drive({ version: 'v3', auth });
    
    // File ID from folder details
    const fileId = '15LH8wfEoAU-5sfu9rWR21AYntUzP0yCq';
    console.log(`📥 Downloading Excel file from Google Drive (ID: ${fileId})...`);

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    console.log('📊 Parsing Excel workbook binary buffer...');
    const buffer = Buffer.from(response.data);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📋 Parsed ${rows.length} rows. Loading baseline data into MySQL...`);
    const pool = await db.getPool();

    let importedCount = 0;
    for (const row of rows) {
      // Dynamic column naming support
      const area = row['Area'] || row['Área'] || row['Departamento'] || 'Tecnología';
      const rawScore = row['Score'] || row['Puntuación'] || row['Puntaje'] || row['Calificación'] || 3;
      const comment = row['Comment'] || row['Comentario'] || row['Feedback'] || '';
      
      const score = Math.max(1, Math.min(5, parseInt(rawScore) || 3));
      
      // Determine feeling string
      let feeling = 'neutral';
      if (score === 5) feeling = 'muy_bien';
      else if (score === 4) feeling = 'bien';
      else if (score === 3) feeling = 'neutral';
      else if (score === 2) feeling = 'estresado';
      else if (score === 1) feeling = 'desmotivado';

      // Estimate sentiment score
      let sentimentScore = 0.0;
      let sentimentLabel = 'neutral';
      if (score >= 4) {
        sentimentScore = 0.6;
        sentimentLabel = 'positivo';
      } else if (score <= 2) {
        sentimentScore = -0.6;
        sentimentLabel = 'negativo';
      }

      // Format default topics array
      const topics = JSON.stringify(score <= 2 ? ['Carga de trabajo', 'Estrés'] : ['Calma', 'Entusiasmo']);

      // Generate a date over the last 6 months to distribute historical charts
      const daysAgo = Math.floor(Math.random() * 180) + 1;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAgo);

      // Insert record
      await pool.query(
        `INSERT INTO pulse_entries (area, feeling, feeling_score, influences, comment, sentiment_score, sentiment_label, topics, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [area, feeling, score, JSON.stringify(['Carga de trabajo']), comment, sentimentScore, sentimentLabel, topics, targetDate]
      );
      importedCount++;
    }

    console.log(`✅ Successfully imported ${importedCount} baseline entries into MySQL database.`);
    return { success: true, count: importedCount };
  } catch (error) {
    console.error('❌ Failed to import historical baseline:', error.message);
    throw error;
  }
}

module.exports = {
  appendEntryToSheet,
  importHistoricalBaseline
};
