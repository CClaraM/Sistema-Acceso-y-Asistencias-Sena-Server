// routes/horario.routes.js
import express from "express";
import { authUserMiddleware } from "../middlewares/authUserMiddleware.js";
import {
  createHorario,
  updateHorario,
  toggleHorario,
  listHorariosByFicha
} from "../controllers/horario.controller.js";
import { canViewHorariosByFicha } from "../middlewares/canViewHorariosByFicha.js";
import { canEditHorario } from "../middlewares/canEditHorario.js";

const router = express.Router();

router.post(
  "/horarios",
  authUserMiddleware,
  canEditHorario,
  createHorario
);

// Editar horario
router.put(
  "/horarios/:id",
  authUserMiddleware,
  canEditHorario,
  updateHorario
);

// Activar / desactivar horario
router.patch(
  "/horarios/:id/estado",
  authUserMiddleware,
  canEditHorario,
  toggleHorario
);

// Listar horarios por ficha
router.get(
  "/fichas/:fichaNumero/horarios",
  authUserMiddleware,
  canViewHorariosByFicha,
  listHorariosByFicha
);

export default router;
