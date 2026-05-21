const PULSE_API_URL = 'http://localhost:3002/api';

/**
 * Submits a daily emotional micro-pulse for a collaborator
 */
export const submitPulse = async (email, feeling, influences, comment) => {
  const res = await fetch(`${PULSE_API_URL}/pulse/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, feeling, influences, comment })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Error al enviar el pulso emocional.');
  }
  return res.json();
};

/**
 * Fetches anonymized dashboard analytics for manager view
 */
export const getDashboard = async () => {
  const res = await fetch(`${PULSE_API_URL}/pulse/dashboard`);
  if (!res.ok) throw new Error('Error al obtener datos del panel de clima.');
  return res.json();
};

/**
 * Generates an AI climate report for a specific area and period
 */
export const generateReport = async (area, period) => {
  const res = await fetch(`${PULSE_API_URL}/pulse/generate-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ area, period })
  });
  if (!res.ok) throw new Error('Error al generar reporte de clima con IA.');
  return res.json();
};

/**
 * Triggers historical baseline import from Google Drive Excel
 */
export const syncHistorical = async () => {
  const res = await fetch(`${PULSE_API_URL}/pulse/sync-historical`, { method: 'POST' });
  if (!res.ok) throw new Error('Error al sincronizar datos históricos.');
  return res.json();
};

/**
 * Fetches all collaborators for the profile selector
 */
export const getCollaborators = async () => {
  const res = await fetch(`${PULSE_API_URL}/pulse/collaborators`);
  if (!res.ok) throw new Error('Error al cargar colaboradores.');
  return res.json();
};

/**
 * Fetches streak and points for an email
 */
export const getStreaks = async (email) => {
  const res = await fetch(`${PULSE_API_URL}/pulse/streaks/${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error('Error al obtener la racha del colaborador.');
  return res.json();
};

/**
 * Resolves a wellness alert
 */
export const resolveAlert = async (id) => {
  const res = await fetch(`${PULSE_API_URL}/pulse/alerts/${id}/resolve`, { method: 'POST' });
  if (!res.ok) throw new Error('Error al resolver la alerta.');
  return res.json();
};

/**
 * Exports a PDF climate report (returns a blob for download)
 */
export const exportReportPDF = async (area, period) => {
  const res = await fetch(`${PULSE_API_URL}/pulse/export-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ area, period })
  });
  if (!res.ok) throw new Error('Error al exportar el PDF.');
  return res.blob();
};

/**
 * Publishes a PDF climate report to Google Drive
 */
export const publishReportPDFToDrive = async (area, period) => {
  const res = await fetch(`${PULSE_API_URL}/pulse/export/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ area, period })
  });
  if (!res.ok) throw new Error('Error al publicar el PDF en Google Drive.');
  return res.json();
};

/**
 * Fetches calendar data (daily wellness scores + workload dates)
 */
export const getCalendar = async () => {
  const res = await fetch(`${PULSE_API_URL}/pulse/calendar`);
  if (!res.ok) throw new Error('Error al obtener datos del calendario.');
  return res.json();
};

/**
 * Adds a high-workload date to the calendar
 */
export const addWorkloadDate = async (date, label, severity) => {
  const res = await fetch(`${PULSE_API_URL}/pulse/calendar/workload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, label, severity })
  });
  if (!res.ok) throw new Error('Error al guardar fecha de alta carga.');
  return res.json();
};

/**
 * Deletes a workload date
 */
export const deleteWorkloadDate = async (id) => {
  const res = await fetch(`${PULSE_API_URL}/pulse/calendar/workload/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Error al eliminar fecha de alta carga.');
  return res.json();
};

/**
 * Gets wellness vs performance cross-reference data
 */
export const getPerformanceCross = async () => {
  const res = await fetch(`${PULSE_API_URL}/pulse/performance-cross`);
  if (!res.ok) throw new Error('Error al obtener datos de cruce bienestar-desempeño.');
  return res.json();
};

/**
 * Gets gamification leaderboard data
 */
export const getLeaderboard = async () => {
  const res = await fetch(`${PULSE_API_URL}/pulse/leaderboard`);
  if (!res.ok) throw new Error('Error al obtener el leaderboard.');
  return res.json();
};

/**
 * Runs the manual alert check
 */
export const runAlertCheck = async () => {
  const res = await fetch(`${PULSE_API_URL}/pulse/run-alert-check`, { method: 'POST' });
  if (!res.ok) throw new Error('Error al ejecutar la verificación de alertas.');
  return res.json();
};

