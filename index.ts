import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const auth = new google.auth.GoogleAuth({
  scopes: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/spreadsheets'
  ]
});

const sheets = google.sheets({ version: 'v4', auth });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const server = new Server(
  { name: "Garnier-HR-Suite", version: "2.0.0" },
  { capabilities: { tools: {} } }
);

// ====================================================================
// DECLARACIÓN DE LAS 4 HERRAMIENTAS (AL PIE DE LA LETRA DEL PDF)
// ====================================================================
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        // PROYECTO 01: Garnier HR Assistant
        name: "asistente_politicas_rag",
        description: "Resuelve dudas basándose únicamente en las políticas oficiales.",
        inputSchema: {
          type: "object",
          properties: { pregunta_colaborador: { type: "string" } },
          required: ["pregunta_colaborador"],
        },
      },
      {
        // PROYECTO 02: Garnier Pulse Work
        name: "registrar_pulso_diario",
        description: "Registra el micro-pulso emocional de 3 preguntas.",
        inputSchema: {
          type: "object",
          properties: {
            estado_emocional: { 
              type: "string", 
              enum: ["Muy bien", "Bien", "Neutral", "Estresado/a", "Desmotivado/a"] 
            },
            factor_influencia: { 
              type: "string", 
              enum: ["Carga de trabajo", "Relación con el equipo", "Liderazgo", "Factores personales", "Ambiente físico", "Otro"] 
            },
            comentario_libre: { type: "string" }
          },
          required: ["estado_emocional", "factor_influencia"],
        },
      },
      {
        // PROYECTO 03: Garnier eNPS
        name: "analizar_clima_enps",
        description: "Analiza respuestas de la encuesta anual eNPS y extrae insights.",
        inputSchema: {
          type: "object",
          properties: { mes_encuesta: { type: "string" } },
          required: ["mes_encuesta"],
        },
      },
      {
        // PROYECTO 04: Garnier Performance
        name: "preparar_reunion_1a1",
        description: "Analiza OKRs/KPIs/MCI para sugerir temas para la reunión 1:1.",
        inputSchema: {
          type: "object",
          properties: {
            id_colaborador: { type: "string" },
            trimestre: { type: "string" }
          },
          required: ["id_colaborador", "trimestre"],
        },
      }
    ],
  };
});

// ====================================================================
// LÓGICA DE EJECUCIÓN (CON INSTRUCCIONES ESTRICTAS PARA GEMINI)
// ====================================================================
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const nombreHerramienta = request.params.name;
  const args = request.params.arguments;
  const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

  try {
    
    // PROYECTO 01: Asistente con lógica RAG Simulada
    if (nombreHerramienta === "asistente_politicas_rag") {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.FAQ_SHEET_ID,
        range: 'Respuestas!A1:C200',
      });
      const prompt = `
        Eres el Asistente de RRHH de Garnier. Regla estricta: Responde ÚNICAMENTE basado en este documento de políticas: ${JSON.stringify(response.data.values)}. 
        Si la respuesta no está, di que no tienes la información y sugiere escalar a un agente humano de RH. Cita la sección consultada.
        Pregunta: "${args?.pregunta_colaborador}"
      `;
      const result = await model.generateContent(prompt);
      return { content: [{ type: "text", text: result.response.text() }] };
    }

    // PROYECTO 02: Pulse Work (Micro-pulso de 3 preguntas)
    if (nombreHerramienta === "registrar_pulso_diario") {
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.EMOCIONES_SHEET_ID,
        range: 'RegistroDiario!A:E',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            new Date().toISOString(), 
            args?.estado_emocional, 
            args?.factor_influencia, 
            args?.comentario_libre || ""
          ]],
        },
      });
      return { content: [{ type: "text", text: "Micro-pulso registrado exitosamente según el formato Garnier Pulse Work." }] };
    }

    // PROYECTO 03: Análisis eNPS
    if (nombreHerramienta === "analizar_clima_enps") {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.ENPS_SHEET_ID,
        range: `${args?.mes_encuesta}!A1:F200`,
      });
      const prompt = `
        Eres un analista de RRHH. Analiza estos datos crudos de una encuesta eNPS: ${JSON.stringify(response.data.values)}.
        Genera un Resumen Ejecutivo automático calculando:
        1. Clasificación: Promotores (9-10), Neutros (7-8) y Detractores (0-6).
        2. Fórmula eNPS: % Promotores - % Detractores.
        3. Identifica temas recurrentes en los comentarios abiertos sobre Liderazgo, Comunicación, Beneficios, etc.
      `;
      const result = await model.generateContent(prompt);
      return { content: [{ type: "text", text: result.response.text() }] };
    }

    // PROYECTO 04: Performance y 1:1s
    if (nombreHerramienta === "preparar_reunion_1a1") {
      const metas = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.OKR_SHEET_ID,
        range: `${args?.trimestre}!A1:F100`,
      });
      const prompt = `
        Analiza el avance de metas (OKR/KPI/MCI) de este colaborador: ${JSON.stringify(metas.data.values)}.
        Genera una preparación para la reunión 1:1 que incluya:
        - Sugerencia automática de temas a tratar basados en el avance.
        - Alertas sobre metas en riesgo.
        - Recomendación de reconocimientos basados en los logros alcanzados.
      `;
      const result = await model.generateContent(prompt);
      return { content: [{ type: "text", text: result.response.text() }] };
    }

    throw new McpError(ErrorCode.MethodNotFound, "Herramienta no encontrada");

  } catch (error: any) {
    return {
      content: [{ type: "text", text: `Error en la operación: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("✅ Garnier HR Suite (Alineado al PDF) iniciado con Gemini 2.5 Flash.");
}

main().catch(console.error);