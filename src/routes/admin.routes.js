import express from 'express';
import { AdminController } from '../controllers/admin.controller.js';
import { authUserMiddleware } from '../middlewares/authUserMiddleware.js';
import { requireAdmin } from '../middlewares/requireAdmin.js';

const router = express.Router();

// Solo admins pueden crear TST
router.post(
    "/create-tst",
    authUserMiddleware,
    requireAdmin,
    AdminController.createTst
);

export default router;
