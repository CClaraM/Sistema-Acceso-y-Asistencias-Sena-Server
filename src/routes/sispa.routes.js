import express from "express";
import { SispaController } from "../controllers/sispa.controller.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { ambienteScopeMiddleware } from "../middlewares/ambienteScopeMiddleware.js";

const router = express.Router();

// Fichas del ambiente → requiere token
router.get(
  "/ambiente/:id/fichas",
  authMiddleware,
  ambienteScopeMiddleware, // Se asegura que el dispositivo pueda consultar ese ambiente (Scope-Locking per Device)
  SispaController.getFichasByAmbiente
);

// Aprendices de una ficha → requiere token
router.get(
  "/ficha/:id/aprendices",
  authMiddleware,
  SispaController.getAprendicesByFicha
);

// Horario activo → requiere token
router.get(
  "/ambiente/:id/horario/activo",
  authMiddleware,
  ambienteScopeMiddleware,
  SispaController.getHorarioActivo
);

router.post(
  "/sync/asistencias",
  authMiddleware,              // Token del dispositivo -> req.deviceId
  SispaController.syncAsistencias
);

router.get("/sync/biometria", authMiddleware, SispaController.syncBiometriaDelta);
router.post("/sync/uploadBiometria", authMiddleware, SispaController.uploadBiometria);

router.get("/sync/full", authMiddleware, SispaController.fullPayloadDevice);

export default router;
