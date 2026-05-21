const XLSX = require('xlsx');
const fs = require('fs');

function upsertJsonSheet(wb, data, name) {
  const ws = XLSX.utils.json_to_sheet(data);
  if (wb.SheetNames.includes(name)) {
    wb.Sheets[name] = ws;
  } else {
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
}

function buildWorkbook(rows, dashboard) {
  const templatePath = process.env.ENPS_TEMPLATE_PATH || 'C:\\Users\\DELL9\\Downloads\\Plantilla_Encuesta_Garnier.xlsx';
  const wb = fs.existsSync(templatePath) ? XLSX.readFile(templatePath) : XLSX.utils.book_new();

  const surveyData = rows.map(r => ({
    area: r.area,
    puesto: r.puesto,
    antiguedad: r.antiguedad,
    enps_score: r.enps_score,
    leadership: r.leadership_score,
    communication: r.communication_score,
    growth: r.growth_score,
    benefits: r.benefits_score,
    culture: r.culture_score,
    work_life: r.work_life_score,
    open_positive: r.open_positive,
    open_improve: r.open_improve,
    created_at: r.created_at
  }));
  upsertJsonSheet(wb, surveyData, 'Encuestas');
  upsertJsonSheet(wb, [dashboard.global], 'ENPS Global');
  upsertJsonSheet(wb, [dashboard.likertGlobal], 'Likert Global');
  upsertJsonSheet(wb, dashboard.byArea, 'Por Area');
  upsertJsonSheet(wb, dashboard.byPuesto, 'Por Puesto');
  upsertJsonSheet(wb, dashboard.byAntiguedad, 'Por Antiguedad');

  const summarySheetData = [
    { metric: 'eNPS Global', value: dashboard.global.enps },
    { metric: 'Total respuestas', value: dashboard.global.totalResponses },
    { metric: '% Promotores', value: dashboard.global.promotersPct },
    { metric: '% Detractores', value: dashboard.global.detractorsPct },
    { metric: 'Dimensiones debiles', value: (dashboard.weakDimensions || []).join(', ') || '-' },
    { metric: 'Resumen IA', value: dashboard.aiReport?.executiveSummary || 'Sin resumen IA disponible.' }
  ];
  upsertJsonSheet(wb, summarySheetData, 'Resumen IA');

  const themeSheetData = (dashboard.aiReport?.recurringThemes || []).map((t, idx) => ({
    n: idx + 1,
    category: t.category,
    comment: t.comment
  }));
  upsertJsonSheet(wb, themeSheetData, 'Temas IA');

  const recSheetData = (dashboard.aiReport?.recommendations || []).map((r, idx) => ({ n: idx + 1, recommendation: r }));
  upsertJsonSheet(wb, recSheetData, 'Recomendaciones IA');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { buildWorkbook };
