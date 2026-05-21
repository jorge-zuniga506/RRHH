import express from 'express';
import { procesarMensajeChat } from '../controllers/assistantController.js';

const router = express.Router();

// Cuando React (tu frontend) envíe una petición POST a esta ruta, se activa el controlador
router.post('/chat', procesarMensajeChat);

export default router;