const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');

// Path to Google service account key
const KEY_FILE = path.join(__dirname, "../src/config/garnier-hr-service-account.json");

function getDriveAuth() {
  return new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
}

/**
 * Uploads a PDF buffer to the specified Google Drive folder
 */
async function uploadPdfToDrive(buffer, filename) {
  const folderId = process.env.DRIVE_EXPORT_FOLDER_ID || '13d3GzIVJdB8WMsykKgZ-z9h4p7HvyOhH';
  const auth = getDriveAuth();

  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata = {
    name: filename,
    parents: [folderId]
  };

  const media = {
    mimeType: 'application/pdf',
    body: Readable.from(buffer)
  };

  const result = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id,name,webViewLink',
    supportsAllDrives: true
  });

  return result.data;
}

module.exports = { uploadPdfToDrive };
