import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from "../modules/users/user.routes.js";
import operationRoutes from '../modules/operations/operation.routes.js';
import documentRoutes from '../modules/documents/document.routes.js';
import extractionRoutes from '../modules/extractions/extraction.routes.js';
import exportRoutes from '../modules/exports/export.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/operations', operationRoutes);
router.use('/documents', documentRoutes);
router.use('/extractions', extractionRoutes);
router.use('/exports', exportRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;