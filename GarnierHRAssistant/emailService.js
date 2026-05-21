const fs = require('fs');
const path = require('path');
const { getPool } = require('./db');

const EMAILS_DIR = path.join(__dirname, 'sent_emails');

// Ensure the mock emails directory exists
if (!fs.existsSync(EMAILS_DIR)) {
  fs.mkdirSync(EMAILS_DIR, { recursive: true });
}

/**
 * Simulates sending an email by writing a formatted file into a local folder
 */
async function sendMockEmail({ to, subject, htmlBody }) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filename = `email_${timestamp}_${Math.floor(Math.random() * 1000)}.html`;
  const filepath = path.join(EMAILS_DIR, filename);

  const emailContent = `
<!-- SMTP SIMULATION FOR GARNIER CORPORATE MAIL -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { bg-gradient: linear-gradient(135deg, #1e3a8a, #3b82f6); background-color: #1e3a8a; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #fafafa; }
    .footer { background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b; border-t: 1px solid #e2e8f0; }
    .btn { display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white !important; text-decoration: none; border-radius: 5px; font-weight: bold; margin-top: 15px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Garnier HR Onboarding & Alerts Portal</h2>
      <p style="margin: 0; color: #bfdbfe;">Corporate Escalation and Policy Update System</p>
    </div>
    <div class="content">
      ${htmlBody}
    </div>
    <div class="footer">
      Este es un correo simulado enviado automáticamente por el sistema de Garnier HR Assistant.<br>
      Destinatario oficial: <strong>${to}</strong> | Fecha: ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
  `;

  fs.writeFileSync(filepath, emailContent, 'utf-8');
  console.log(`✉️ Simulated email saved to: GarnierHRAssistant/sent_emails/${filename}`);
  return filename;
}

/**
 * Escalates a case, saves it to the MySQL DB and notifies HR via email
 */
async function escalateToHuman({ name, email, query }) {
  const pool = await getPool();

  try {
    // 1. Save escalation case in DB
    const [result] = await pool.query(`
      INSERT INTO escalations (employee_name, employee_email, query_text)
      VALUES (?, ?, ?)
    `, [name, email, query]);

    // 2. Send Simulated Corporate Email to HR
    const emailBody = `
      <h3>Nueva Consulta Escalada por Colaborador</h3>
      <p>Un colaborador ha solicitado la asistencia de un agente humano de Recursos Humanos debido a que el asistente virtual no pudo encontrar la información requerida en las políticas cargadas.</p>
      
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <table style="width: 100%; text-align: left;">
        <tr>
          <th style="width: 30%; padding: 8px 0;">Colaborador:</th>
          <td>${name}</td>
        </tr>
        <tr>
          <th style="padding: 8px 0;">Correo Corporativo:</th>
          <td><a href="mailto:${email}">${email}</a></td>
        </tr>
        <tr>
          <th style="padding: 8px 0;">Consulta Realizada:</th>
          <td>"<em>${query}</em>"</td>
        </tr>
        <tr>
          <th style="padding: 8px 0;">ID de Caso:</th>
          <td><strong>#GARN-${result.insertId}</strong></td>
        </tr>
      </table>
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      
      <div style="text-align: center;">
        <a href="http://localhost:5173/admin" class="btn">Abrir Panel de Administración de RH</a>
      </div>
    `;

    await sendMockEmail({
      to: 'rh-alertas@garnier.com',
      subject: `🚨 [ESCALACIÓN #GARN-${result.insertId}] Nueva Consulta de ${name}`,
      htmlBody: emailBody
    });

    return { success: true, caseId: result.insertId };
  } catch (error) {
    console.error('Error in escalation:', error.message);
    throw error;
  }
}

/**
 * Checks for recurring unanswered questions.
 * If a question has been asked 3 or more times and hasn't been notified yet,
 * trigger a simulated HR notification and mark it as notified.
 */
async function checkAndAlertRecurrentUnanswered() {
  const pool = await getPool();

  try {
    // Find unanswered queries with frequency >= 3 that haven't been notified yet
    const [rows] = await pool.query(`
      SELECT id, query_text, frequency
      FROM unanswered_queries
      WHERE frequency >= 3 AND notified = 0
    `);

    for (const row of rows) {
      const emailBody = `
        <h3>🚨 ALERTA: Vacío de Política Detectado</h3>
        <p>El sistema Garnier HR Assistant ha detectado una consulta recurrente que **NO cuenta con respuestas** en las políticas y manuales internos cargados actualmente en el sistema.</p>
        
        <div style="background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin: 15px 0;">
          <h4 style="margin: 0 0 5px 0; color: #991b1b;">Consulta Recurrente:</h4>
          <p style="margin: 0; font-size: 16px; font-weight: bold; color: #7f1d1d;">"${row.query_text}"</p>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #991b1b;">Frecuencia detectada: <strong>${row.frequency} veces</strong></p>
        </div>

        <p>Se recomienda cargar un nuevo documento PDF o actualizar las políticas internas que contengan las pautas correspondientes para que el Asistente Inteligente pueda resolver este vacío de información en el futuro.</p>
        
        <div style="text-align: center;">
          <a href="http://localhost:5173/admin" class="btn">Subir Nueva Política PDF</a>
        </div>
      `;

      await sendMockEmail({
        to: 'politicas-rh@garnier.com',
        subject: `⚠️ [ALERTA DE VACÍO] Consulta Recurrente Sin Respuesta: "${row.query_text.substring(0, 30)}..."`,
        htmlBody: emailBody
      });

      // Mark as notified so we don't spam the email for the same query
      await pool.query('UPDATE unanswered_queries SET notified = 1 WHERE id = ?', [row.id]);
    }
  } catch (error) {
    console.error('Error checking recurrent unanswered queries:', error.message);
  }
}

module.exports = {
  escalateToHuman,
  checkAndAlertRecurrentUnanswered,
  sendMockEmail
};
