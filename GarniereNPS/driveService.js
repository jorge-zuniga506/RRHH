const { google } = require('googleapis');
const { Readable } = require('stream');

function getDriveAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
  }

  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error(
      'Configura OAuth (GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN) o GOOGLE_APPLICATION_CREDENTIALS.'
    );
  }

  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/drive.file']
  });
}

async function uploadExcelToDrive(buffer, filename) {
  const folderId = process.env.DRIVE_EXPORT_FOLDER_ID || '13d3GzIVJdB8WMsykKgZ-z9h4p7HvyOhH';
  const auth = getDriveAuth();

  const drive = google.drive({ version: 'v3', auth });

  const fileMetadata = {
    name: filename,
    parents: [folderId]
  };

  const media = {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: Readable.from(buffer)
  };

  const result = await drive.files.create({
    requestBody: fileMetadata,
    media,
    fields: 'id,name,webViewLink,webContentLink,driveId',
    supportsAllDrives: true
  });

  return result.data;
}

module.exports = { uploadExcelToDrive };
