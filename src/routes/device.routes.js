import express from 'express';
import { DeviceController } from '../controllers/device.controller.js';
import { SispaController } from '../controllers/sispa.controller.js'; // ⬅ importar
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post("/enroll", DeviceController.enroll);
router.get("/ping", authMiddleware, DeviceController.ping);
router.get("/full-payload", authMiddleware, SispaController.fullPayloadDevice);

export default router;
