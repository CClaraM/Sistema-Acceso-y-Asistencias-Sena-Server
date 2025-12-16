import express from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { UserAuthController } from "../controllers/userAuth.controller.js";

const router = express.Router();

// Login usuario humano
router.post("/user-login", UserAuthController.login);

router.post("/refresh", AuthController.refresh);

export default router;
