// routes/ficha.routes.js
import express from "express";
import { authUserMiddleware } from "../middlewares/authUserMiddleware.js";
import { canListAprendicesByFicha } from "../middlewares/canListAprendicesByFicha.js";
import { listAprendicesByFicha } from "../controllers/fichaAprendices.controller.js";
import { canCreateFicha } from "../middlewares/canCreateFicha.js";
import { canEditFicha } from "../middlewares/canEditFicha.js";
import { canEnrollAprendiz } from "../middlewares/canEnrollAprendiz.js";
import { createFicha, updateFicha, deleteFicha } from "../controllers/ficha.controller.js";
import { inscribirAprendiz } from "../controllers/inscripcion.controller.js";

const router = express.Router();

// Listar aprendices de una ficha
router.get(
  "/fichas/:fichaNumero/aprendices",
  authUserMiddleware,
  canListAprendicesByFicha,
  listAprendicesByFicha
);

// Crear ficha
router.post(
  "/fichas",
  authUserMiddleware,
  canCreateFicha,
  createFicha
);

// Editar ficha
router.put(
  "/fichas/:fichaNumero",
  authUserMiddleware,
  canEditFicha,
  updateFicha
);

// Eliminar ficha (solo INSCRIPCIONES)
router.delete(
  "/fichas/:fichaNumero",
  authUserMiddleware,
  canEditFicha,
  deleteFicha
);

// Inscribir aprendiz
router.post(
  "/fichas/:fichaNumero/inscripciones",
  authUserMiddleware,
  canEnrollAprendiz,
  inscribirAprendiz
);

export default router;
