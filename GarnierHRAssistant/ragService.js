const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getPool } = require('./db');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Stop words to clean up queries for search token matching
const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'en', 'para', 'por', 'con', 'sin', 'sobre', 'bajo', 'y', 'o', 'pero', 'mas', 'como', 'si', 'que', 'quien', 'cual', 'donde', 'cuando', 'como', 'tu', 'su', 'mi', 'nos',
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'of', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'about', 'as', 'into', 'like', 'through', 'after', 'before', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'we', 'you', 'he', 'she', 'it', 'they',
  'sobre', 'como', 'acerca', 'dias', 'cuales'
]);

/**
 * Tokenizes text and removes stop words
 * @param {string} text
 * @returns {Array<string>} Unique tokens
 */
function getSearchTokens(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special characters
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Searches the local database for relevant active document page chunks
 */
async function searchChunks(query, limit = 5) {
  const pool = await getPool();
  const tokens = getSearchTokens(query);

  if (tokens.length === 0) {
    // If no searchable words (e.g. "hola"), retrieve first few active chunks as fallback
    const [rows] = await pool.query(`
      SELECT dc.content, dc.page_number, d.filename, d.title
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.active = 1
      LIMIT ?
    `, [limit]);
    return rows;
  }

  // Retrieve all chunks from active documents
  const [chunks] = await pool.query(`
    SELECT dc.content, dc.page_number, d.filename, d.title, d.id as doc_id
    FROM document_chunks dc
    JOIN documents d ON dc.document_id = d.id
    WHERE d.active = 1
  `);

  // Score each chunk based on token matches
  const scoredChunks = chunks.map(chunk => {
    let score = 0;
    const chunkText = chunk.content.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    tokens.forEach(token => {
      const regex = new RegExp(token, 'g');
      const matches = chunkText.match(regex);
      if (matches) {
        score += matches.length * 2; // Multi-occurrence weight
        score += 5; // Unique token bonus
      }
    });

    return { ...chunk, score };
  });

  return scoredChunks
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Generates an answer using the retrieved context or flags it as unanswered
 */
async function answerQuery(query, language = 'es') {
  const responseLanguage = language === 'en' ? 'en' : 'es';
  const chunks = await searchChunks(query);
  const pool = await getPool();

  const [docCountRows] = await pool.query('SELECT COUNT(*) as count FROM documents WHERE active = 1');
  const hasActiveDocs = docCountRows[0].count > 0;

  if (!hasActiveDocs) {
    return {
      answered: false,
      response: responseLanguage === 'en'
        ? 'Sorry, there are currently no active policy documents in the system to answer your query. Please contact Human Resources.'
        : 'Lo siento, pero actualmente no hay documentos de politicas activos en el sistema para responder a tu consulta. Por favor, contacta a Recursos Humanos.',
      sources: []
    };
  }

  const contextText = chunks
    .map((c, i) => `[DOCUMENT ${i + 1}]: ${c.title} (File: ${c.filename}), Page: ${c.page_number}\nCONTENT: ${c.content}\n---`)
    .join('\n\n');

  const model = genAI.getGenerativeModel({
    model: 'gemini-flash-latest',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
You are Garnier HR Assistant, an internal HR conversational agent.
Your objective is to resolve employee questions about internal policies and manuals.

Strict response rules:
1. Answer ONLY based on the official context below. Do not invent facts or use external information.
2. If the context is not sufficient to fully answer the question, set "answered" to false.
3. If you can answer, set "answered" to true and respond in a professional, clear, empathetic, corporate tone.
4. Return a strictly valid JSON object with this structure:
{
  "answered": true or false,
  "response": "Detailed answer based only on documents",
  "sources": [
    { "document": "PDF filename or title", "page": 4 }
  ]
}
5. Output language rule: if requested language is "en", respond in English. Otherwise, respond in Spanish.
6. If "answered" is false, include a formal apology and explain the policy is not found in the available official documentation; suggest escalating to a human HR agent; keep "sources" as [].
7. Do not output anything outside the JSON object.

Requested language: "${responseLanguage}".

OFFICIAL GARNIER POLICY CONTEXT:
${contextText || 'NO ACTIVE DOCUMENTS AVAILABLE.'}

EMPLOYEE QUESTION:
"${query}"
`;

  try {
    const result = await model.generateContent(prompt);
    const textResult = result.response.text();
    const responseData = JSON.parse(textResult);
    return responseData;
  } catch (error) {
    console.error('Error generating answer from Gemini:', error);
    return {
      answered: false,
      response: responseLanguage === 'en'
        ? 'Sorry, I encountered an error while processing your request with our AI engine. Please try again in a moment or escalate your case to an HR agent.'
        : 'Lo siento, experimente un error al procesar tu consulta con nuestro motor de Inteligencia Artificial. Por favor, reintenta en unos momentos o escala tu caso con un agente de RH.',
      sources: []
    };
  }
}

module.exports = {
  answerQuery
};
