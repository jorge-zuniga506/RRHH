const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '../.env' });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Uses Gemini 2.5 Flash to perform sentiment analysis and extract keywords/topics from open text comments
 * @param {string} comment - The user comment
 * @returns {Promise<{sentimentScore: number, sentimentLabel: string, topics: string[]}>}
 */
async function analyzeComment(comment) {
  if (!comment || !comment.trim()) {
    return {
      sentimentScore: 0.0,
      sentimentLabel: 'neutral',
      topics: []
    };
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

  const prompt = `
Analiza el siguiente comentario de un empleado de la empresa Garnier sobre su día laboral.
Determina el sentimiento general y extrae palabras clave/temas recurrentes de su comentario.

Comentario: "${comment}"

Debes responder estrictamente en formato JSON válido con la siguiente estructura:
{
  "sentimentScore": <número decimal entre -1.0 y 1.0, donde -1 es extremadamente estresado/triste/enojado, 0 es neutral, y +1 es extremadamente feliz/entusiasmado/satisfecho>,
  "sentimentLabel": <uno de los siguientes strings: "positivo", "neutral", "negativo">,
  "topics": [<lista de palabras clave o temas recurrentes, por ejemplo: "carga laboral", "relación de equipo", "liderazgo", "factores personales", etc. Máximo 4 temas>]
}

No agregues ninguna explicación ni texto fuera de la respuesta JSON.
`;

  try {
    const result = await model.generateContent(prompt);
    const textResult = result.response.text();
    const jsonMatch = textResult.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    const data = JSON.parse(jsonMatch[0]);
    return {
      sentimentScore: parseFloat(data.sentimentScore) || 0.0,
      sentimentLabel: data.sentimentLabel || 'neutral',
      topics: Array.isArray(data.topics) ? data.topics : []
    };
  } catch (error) {
    console.error('Error in analyzeComment AI service:', error.message);
    // Fallback logic
    let score = 0.0;
    let label = 'neutral';
    if (comment.toLowerCase().includes('estresado') || comment.toLowerCase().includes('carga') || comment.toLowerCase().includes('desmotivado') || comment.toLowerCase().includes('mal')) {
      score = -0.5;
      label = 'negativo';
    } else if (comment.toLowerCase().includes('bien') || comment.toLowerCase().includes('feliz') || comment.toLowerCase().includes('excelente') || comment.toLowerCase().includes('gracias')) {
      score = 0.5;
      label = 'positivo';
    }
    return {
      sentimentScore: score,
      sentimentLabel: label,
      topics: ['General']
    };
  }
}

/**
 * Generates an aggregated organizational climate report for a specific area and period using Gemini
 * @param {string} area - The department name
 * @param {string} period - 'semana' or 'mes'
 * @param {Array} entries - Raw pulse entries for aggregation
 * @returns {Promise<{summary: string, rating: string, recommendations: string[], wellnessStatus: string}>}
 */
async function generateClimateReport(area, period, entries) {
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

  // Pre-aggregate data for the prompt to keep tokens light
  const totalSubmissions = entries.length;
  if (totalSubmissions === 0) {
    return {
      summary: `No hay suficientes registros de micro-pulso para generar un reporte del área ${area} en este periodo.`,
      rating: 'N/A',
      recommendations: ['Fomentar la participación en los micro-pulsos diarios.'],
      wellnessStatus: 'saludable'
    };
  }

  const scores = entries.map(e => e.feeling_score);
  const avgScore = (scores.reduce((a, b) => a + b, 0) / totalSubmissions).toFixed(2);
  const sentiments = entries.map(e => e.sentiment_label);
  const negativeCount = sentiments.filter(s => s === 'negativo').length;
  const positiveCount = sentiments.filter(s => s === 'positivo').length;
  const neutralCount = sentiments.filter(s => s === 'neutral').length;

  const comments = entries.map(e => e.comment).filter(c => c && c.trim()).slice(0, 30); // Take up to 30 comments to summarize

  const prompt = `
Eres un Consultor Senior de Clima Organizacional y Bienestar Laboral. Tu labor es analizar las respuestas agregadas de los empleados y redactar un reporte estratégico para la gerencia de Garnier.

ÁREA ANALIZADA: ${area}
PERIODO DE ANÁLISIS: ${period === 'semana' ? 'Esta Semana' : 'Este Mes'}
NÚMERO DE PARTICIPACIONES: ${totalSubmissions}
PROMEDIO DE BIENESTAR DIARIO (Escala 1 a 5): ${avgScore}
DISTRIBUCIÓN DE SENTIMIENTOS (IA):
- Positivos: ${positiveCount}
- Neutrales: ${neutralCount}
- Negativos: ${negativeCount}

COMENTARIOS ABIERTOS DETECTADOS (ANÓNIMOS):
${comments.length > 0 ? comments.map((c, i) => `- "${c}"`).join('\n') : 'Ningún comentario libre registrado.'}

Por favor, analiza la información provista y responde ESTRICTAMENTE en formato JSON con la siguiente estructura:
{
  "summary": "Resumen ejecutivo profesional, empático y sintético de la situación actual de bienestar del área. Menciona las causas o factores clave identificados.",
  "rating": "Calificación cualitativa (por ejemplo: Excelente, Estable, Bajo Estrés, Crítico)",
  "wellnessStatus": "Clasificación de bienestar general del área: debe ser estrictamente uno de los siguientes: 'saludable' (si el promedio >= 3.8 y pocos comentarios negativos), 'en_observacion' (si el promedio está entre 3.0 y 3.7 o hay alertas medias), o 'en_alerta' (si el promedio < 3.0 o hay un volumen considerable de comentarios altamente estresados o negativos)",
  "recommendations": [
    "Recomendación estratégica de bienestar 1 para jefaturas de esta área",
    "Recomendación estratégica de bienestar 2 para jefaturas de esta área",
    "Recomendación estratégica de bienestar 3 para jefaturas de esta área"
  ]
}

No agregues texto introductorio ni conclusiones adicionales fuera del JSON. Todo el JSON debe ser legible.
`;

  try {
    const result = await model.generateContent(prompt);
    const textResult = result.response.text();
    const jsonMatch = textResult.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in climate report response");
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error generating AI climate report:', error.message);
    
    // Hardcoded fallback based on calculations
    let wellnessStatus = 'saludable';
    let rating = 'Estable';
    let recommendations = [
      'Mantener los canales de comunicación abiertos con los colaboradores.',
      'Monitorear la carga laboral y redistribuir actividades críticas.'
    ];

    const numericAvg = parseFloat(avgScore);
    if (numericAvg < 3.0) {
      wellnessStatus = 'en_alerta';
      rating = 'Crítico';
      recommendations = [
        'Organizar una sesión de contención y retroalimentación abierta con el equipo.',
        'Revisar inmediatamente las metas semanales y aliviar cuellos de botella.',
        'Fomentar pautas activas de desconexión digital obligatorias.'
      ];
    } else if (numericAvg < 3.8) {
      wellnessStatus = 'en_observacion';
      rating = 'Bajo Estrés';
      recommendations = [
        'Ofrecer sesiones individuales de seguimiento semanal (1-on-1).',
        'Facilitar herramientas de balance vida-trabajo.'
      ];
    }

    return {
      summary: `El área de ${area} presenta un promedio general de bienestar de ${avgScore} durante ${period === 'semana' ? 'esta semana' : 'este mes'}. Se observan comportamientos y comentarios variados que reflejan dinámicas internas a observar en materia de carga y relaciones de equipo.`,
      rating,
      wellnessStatus,
      recommendations
    };
  }
}

module.exports = {
  analyzeComment,
  generateClimateReport
};
