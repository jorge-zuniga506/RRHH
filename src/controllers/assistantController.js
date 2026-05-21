import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

const sheets = google.sheets({ version: 'v4', auth });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const procesarMensajeChat = async (req, res) => {
    try {
        const { mensaje, modulo } = req.body; 
        // 'modulo' vendrá desde tu frontend (ej: 'Respuestas', 'eNPS', 'Performance', 'Emociones')
        
        const hojaObjetivo = modulo || 'Respuestas'; 
        console.log(`Consultando módulo: ${hojaObjetivo} | Mensaje: ${mensaje}`);

        // 1. Obtener datos de la pestaña específica
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.FAQ_SHEET_ID,
            range: `${hojaObjetivo}!A1:E100`,
        });

        const datos = response.data.values;
        if (!datos) {
            return res.status(404).json({ respuesta: `No encontré datos en la pestaña ${hojaObjetivo}.` });
        }

        // 2. IA con contexto dinámico
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
            Eres el asistente inteligente de Garnier HR.
            CONTEXTO DE DATOS: ${JSON.stringify(datos)}
            
            INSTRUCCIONES:
            - Basado únicamente en los datos de arriba, responde la consulta del empleado.
            - Si es el módulo de 'Emociones', analiza el sentimiento.
            - Si es 'eNPS' o 'Performance', resume los hallazgos.
            - Sé profesional y humano.
            
            Consulta: "${mensaje}"
        `;

        const result = await model.generateContent(prompt);
        res.json({ respuesta: result.response.text() });

    } catch (error) {
        console.error("Error en assistantController:", error);
        res.status(500).json({ respuesta: "Error al conectar con la base de datos de RRHH." });
    }
};