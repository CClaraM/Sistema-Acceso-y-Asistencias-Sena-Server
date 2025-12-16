import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { SyncController } from "../controllers/sync.controller.js";

const router = express.Router();

// ¿Debe sincronizar? (dispositivo pregunta)
router.get("/status", authMiddleware, SyncController.getSyncStatus);

// Descargar FULL payload
router.get("/full", authMiddleware, SyncController.getFullPayload);

// Subir cambios offline (esqueleto por ahora)
router.post("/upload", authMiddleware, SyncController.uploadChanges);

export default router;
