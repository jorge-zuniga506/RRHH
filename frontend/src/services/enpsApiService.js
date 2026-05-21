const ENPS_API_URL = import.meta.env.VITE_ENPS_API_URL || 'http://localhost:3003/api';

export const submitEnpsSurvey = async (payload) => {
  const res = await fetch(`${ENPS_API_URL}/enps/survey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al enviar encuesta.');
  return data;
};

export const getEnpsDashboard = async () => {
  const res = await fetch(`${ENPS_API_URL}/enps/dashboard`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al cargar dashboard.');
  return data;
};

export const exportEnpsExcel = async () => {
  const res = await fetch(`${ENPS_API_URL}/enps/export/excel`);
  if (!res.ok) throw new Error('Error al exportar Excel.');
  return res.blob();
};

export const publishEnpsExcelToDrive = async () => {
  const res = await fetch(`${ENPS_API_URL}/enps/export/publish`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al publicar en Drive.');
  return data;
};
