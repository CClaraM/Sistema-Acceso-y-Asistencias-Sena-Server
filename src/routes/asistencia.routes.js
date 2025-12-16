import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
//import { ambienteScopeMiddleware } from "../middlewares/ambienteScopeMiddleware.js";
import { AsistenciaController } from "../controllers/asistencia.controller.js";

const router = express.Router();

router.post( "/iniciar_sesion", authMiddleware, AsistenciaController.iniciarSesion);

router.post("/registrar", authMiddleware, AsistenciaController.registrarAsistencia);

router.post("/finalizar", authMiddleware, AsistenciaController.finalizarSesionClase);

export default router;
