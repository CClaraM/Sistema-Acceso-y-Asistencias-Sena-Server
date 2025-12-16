import express from "express";
import { authUserMiddleware } from "../middlewares/authUserMiddleware.js";
import { canManageJornada } from "../middlewares/canManageJornada.js";
import {
    createJornadaRegla,
    updateJornadaRegla,
    toggleJornadaRegla,
    listJornadaReglas
} from "../controllers/jornadaRegla.controller.js";

const router = express.Router();

router.post(
  "/jornadas/reglas",
  authUserMiddleware,
  canManageJornada,
  createJornadaRegla
);

router.put(
  "/jornadas/reglas/:id",
  authUserMiddleware,
  canManageJornada,
  updateJornadaRegla
);

router.patch(
  "/jornadas/reglas/:id/estado",
  authUserMiddleware,
  canManageJornada,
  toggleJornadaRegla
);

router.get(
  "/jornadas/reglas",
  authUserMiddleware,
  canManageJornada,
  listJornadaReglas
);

export default router;