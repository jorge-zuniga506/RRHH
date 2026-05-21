const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const CATEGORY_HINTS = ['liderazgo', 'beneficios', 'ambiente', 'crecimiento', 'comunicacion'];

function fallbackCategory(comment) {
  const text = (comment || '').toLowerCase();
  if (text.includes('lider')) return 'liderazgo';
  if (text.includes('benef')) return 'beneficios';
  if (text.includes('ambiente') || text.includes('cultura')) return 'ambiente';
  if (text.includes('crecimiento') || text.includes('desarrollo') || text.includes('capacit')) return 'crecimiento';
  if (text.includes('comunic')) return 'comunicacion';
  return 'ambiente';
}

async function analyzeOpenComments(comments, weakDimensions) {
  const cleanComments = comments.filter(Boolean).slice(0, 150);
  if (!cleanComments.length) {
    return {
      executiveSummary: 'No hay comentarios abiertos suficientes para analisis.',
      recurringThemes: [],
      recommendations: []
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      executiveSummary: 'Analisis IA no disponible (GEMINI_API_KEY ausente).',
      recurringThemes: cleanComments.slice(0, 8).map(c => ({ category: fallbackCategory(c), comment: c })),
      recommendations: weakDimensions.map(d => `Priorizar plan de mejora en ${d}.`)
    };
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
Eres analista senior de clima organizacional.
Clasifica comentarios por categoria: ${CATEGORY_HINTS.join(', ')}.
Genera recomendaciones accionables para RH.
Responde solo JSON con esta estructura:
{
  "executiveSummary": "texto",
  "recurringThemes": [{"category":"liderazgo","comment":"..."}],
  "recommendations": ["..."]
}

Dimensiones con menor puntaje: ${JSON.stringify(weakDimensions)}
Comentarios:
${JSON.stringify(cleanComments)}
`;

  try {
    const result = await model.generateContent(prompt);
    return JSON.parse(result.response.text());
  } catch (err) {
    return {
      executiveSummary: 'No se pudo generar analisis IA completo en este momento.',
      recurringThemes: cleanComments.slice(0, 8).map(c => ({ category: fallbackCategory(c), comment: c })),
      recommendations: weakDimensions.map(d => `Revisar causas raiz en ${d} con focus groups por area.`)
    };
  }
}

module.exports = { analyzeOpenComments };
