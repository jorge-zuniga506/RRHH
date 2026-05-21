const fs = require('fs');
const path = require('path');

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
  const filename = `alert_email_${timestamp}_${Math.floor(Math.random() * 1000)}.html`;
  const filepath = path.join(EMAILS_DIR, filename);

  const emailContent = `
<!-- SMTP SIMULATION FOR GARNIER PULSEWORK WELLNESS -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 20px auto; border: 1px solid #ddd; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #e11d48, #be123c); color: white; padding: 25px; text-align: center; }
    .content { padding: 25px; background-color: #fafafa; }
    .footer { background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    .btn { display: inline-block; padding: 12px 24px; background-color: #e11d48; color: white !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; text-transform: uppercase; font-size: 13px; }
    .alert-box { background-color: #ffe4e6; border-left: 4px solid #f43f5e; padding: 15px; border-radius: 4px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Garnier PulseWork Wellness Alert Center</h2>
      <p style="margin: 5px 0 0 0; color: #fecdd3;">Alerta Crítica de Clima y Bienestar Organizacional</p>
    </div>
    <div class="content">
      ${htmlBody}
    </div>
    <div class="footer">
      Este es un correo automático simulado enviado por Garnier PulseWork.<br>
      Destinatario oficial: <strong>${to}</strong> | Fecha del Sistema: ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>
  `;

  fs.writeFileSync(filepath, emailContent, 'utf-8');
  console.log(`✉️ Simulated wellness email saved to: GarnierPulseWork/sent_emails/${filename}`);
  return filename;
}

/**
 * Triggers a critical wellness alert email for HR
 */
async function sendWellnessAlertEmail(area, recentAverage, consecutiveDays, severity) {
  const isEnAlerta = severity === 'en_alerta';
  const severityLabel = isEnAlerta ? '🔴 ALERTA DE BIENESTAR MÍNIMO' : '🟡 OBSERVACIÓN PREVENTIVA';
  const color = isEnAlerta ? '#e11d48' : '#d97706';

  const emailBody = `
    <h3>${severityLabel}</h3>
    <p>Se ha detectado un patrón sostenido de estados emocionales negativos o altos niveles de estrés en una de nuestras áreas corporativas.</p>
    
    <div class="alert-box" style="border-left-color: ${color}; background-color: ${isEnAlerta ? '#ffe4e6' : '#fef3c7'};">
      <h4 style="margin: 0 0 5px 0; color: ${isEnAlerta ? '#9f1239' : '#92400e'};">Detalles del Área:</h4>
      <p style="margin: 0; font-size: 16px; font-weight: bold; color: ${isEnAlerta ? '#881337' : '#78350f'};">Área: ${area}</p>
      <p style="margin: 5px 0 0 0; font-size: 14px;">Índice Promedio Reciente: <strong>${recentAverage.toFixed(2)} / 5.00</strong></p>
      <p style="margin: 3px 0 0 0; font-size: 14px;">Registros consecutivos negativos: <strong>${consecutiveDays} días</strong></p>
    </div>

    <p>Este aviso preventivo permite a las jefaturas de área y al equipo de Gestión del Talento Humano intervenir a tiempo con pautas activas de balance y talleres de manejo de carga de trabajo, protegiendo así la salud ocupacional y el clima corporativo.</p>
    
    <div style="text-align: center;">
      <a href="http://localhost:5173/pulse" class="btn" style="background-color: ${color};">Revisar Dashboard de Clima de ${area}</a>
    </div>
  `;

  await sendMockEmail({
    to: 'bienestar-rh@garnier.com',
    subject: `🚨 [ALERTA BIENESTAR] El área "${area}" se encuentra en estado "${severity.toUpperCase()}"`,
    htmlBody: emailBody
  });
}

module.exports = {
  sendWellnessAlertEmail,
  sendMockEmail
};
