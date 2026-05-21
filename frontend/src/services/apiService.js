const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Sends a chat message to the RAG backend
 */
export const enviarMensajeAsistente = async (mensaje, language = 'es') => {
  try {
    const respuesta = await fetch(`${API_URL}/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mensaje, language })
    });
    
    if (!respuesta.ok) throw new Error('Error en el servidor al procesar el mensaje.');
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (enviarMensajeAsistente):", error);
    throw error;
  }
};

/**
 * Fetches the list of all uploaded PDFs and chunk counts
 */
export const obtenerDocumentos = async () => {
  try {
    const respuesta = await fetch(`${API_URL}/documents`);
    if (!respuesta.ok) throw new Error('Error al obtener la lista de documentos.');
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (obtenerDocumentos):", error);
    throw error;
  }
};

/**
 * Uploads a PDF policy file to the backend
 */
export const subirDocumento = async (archivo) => {
  try {
    const formData = new FormData();
    formData.append('documento', archivo);

    const respuesta = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      body: formData
    });

    if (!respuesta.ok) {
      const errData = await respuesta.json();
      throw new Error(errData.error || 'Error al subir el archivo.');
    }
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (subirDocumento):", error);
    throw error;
  }
};

/**
 * Toggles a document active/inactive status
 */
export const toggleActivarDocumento = async (id) => {
  try {
    const respuesta = await fetch(`${API_URL}/documents/${id}/toggle`, {
      method: 'POST'
    });
    if (!respuesta.ok) throw new Error('Error al cambiar el estado del documento.');
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (toggleActivarDocumento):", error);
    throw error;
  }
};

/**
 * Deletes a document from index
 */
export const eliminarDocumento = async (id) => {
  try {
    const respuesta = await fetch(`${API_URL}/documents/${id}`, {
      method: 'DELETE'
    });
    if (!respuesta.ok) throw new Error('Error al eliminar el documento.');
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (eliminarDocumento):", error);
    throw error;
  }
};

/**
 * Synchronizes new PDF documents from the "CONSULTAS" Google Drive folder
 */
export const sincronizarDrive = async () => {
  try {
    const respuesta = await fetch(`${API_URL}/drive/sync`, {
      method: 'POST'
    });
    if (!respuesta.ok) {
      const errData = await respuesta.json();
      throw new Error(errData.error || 'Error al sincronizar con Google Drive.');
    }
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (sincronizarDrive):", error);
    throw error;
  }
};

/**
 * Fetches all human-agent escalations
 */
export const obtenerEscalaciones = async () => {
  try {
    const respuesta = await fetch(`${API_URL}/escalations`);
    if (!respuesta.ok) throw new Error('Error al recuperar las escalaciones.');
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (obtenerEscalaciones):", error);
    throw error;
  }
};

/**
 * Escalates a question to a human agent
 */
export const escalarCaso = async (nombre, correo, pregunta) => {
  try {
    const respuesta = await fetch(`${API_URL}/escalations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nombre, correo, pregunta })
    });
    if (!respuesta.ok) throw new Error('Error al enviar la escalación.');
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (escalarCaso):", error);
    throw error;
  }
};

/**
 * Resolves a pending escalation
 */
export const resolverEscalacion = async (id) => {
  try {
    const respuesta = await fetch(`${API_URL}/escalations/${id}/resolve`, {
      method: 'POST'
    });
    if (!respuesta.ok) throw new Error('Error al resolver la escalación.');
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (resolverEscalacion):", error);
    throw error;
  }
};

/**
 * Fetches HR analytics and metrics
 */
export const obtenerAnaliticas = async () => {
  try {
    const respuesta = await fetch(`${API_URL}/analytics`);
    if (!respuesta.ok) throw new Error('Error al obtener las analíticas.');
    return await respuesta.json();
  } catch (error) {
    console.error("Error en apiService (obtenerAnaliticas):", error);
    throw error;
  }
};
