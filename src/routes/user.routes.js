// routes/user.routes.js
import express from "express";
import { authUserMiddleware } from "../middlewares/authUserMiddleware.js";
import { canViewUser } from "../middlewares/canViewUser.js";
import { canEditUser } from "../middlewares/canEditUser.js";
import { UserProfileController } from "../controllers/userProfile.controller.js";
import { updateResidencia, getResidencia } from "../controllers/residencia.controller.js";
/////
import { getAprendizTutor,  updateAprendizTutor } from "../controllers/aprendizTutor.controller.js";

const router = express.Router();

// Ver perfil de usuario
router.get(
  "/users/:id/profile",
  authUserMiddleware,
  canViewUser,
  UserProfileController.getProfile
);

router.put(
  "/users/:id/profile",
  authUserMiddleware,
  canEditUser,
  UserProfileController.updateProfile
);

router.put(
  "/users/:id/residencia",
  authUserMiddleware,
  canEditUser,
  updateResidencia
);

router.get(
  "/users/:id/residencia",
  authUserMiddleware,
  canViewUser,
  getResidencia
);

router.get(
  "/users/:id/aprendiz-tutor",
  authUserMiddleware,
  canViewUser,
  getAprendizTutor
);

router.put(
  "/users/:id/aprendiz-tutor",
  authUserMiddleware,
  canEditUser,
  updateAprendizTutor
);

export default router;
