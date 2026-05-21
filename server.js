import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares requeridos
app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/health', (req, res) => {
    res.json({ status: 'Activo', proyecto: 'Garnier HR Suite' });
});

// NUEVA RUTA: Recibe los mensajes de React
app.post('/api/assistant/chat', async (req, res) => {
    try {
        const mensajeDelUsuario = req.body.mensaje;
        
        console.log("Mensaje recibido desde React:", mensajeDelUsuario);
        
        const respuestaSimulada = `¡Conexión exitosa! El backend recibió tu mensaje: "${mensajeDelUsuario}".`;
        
        res.json({ respuesta: respuestaSimulada });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor Garnier HR corriendo en http://localhost:${PORT}`);
});