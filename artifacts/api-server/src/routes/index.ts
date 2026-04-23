import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import goalsRouter from "./goals";
import sessionsRouter from "./sessions";
import notesRouter from "./notes";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(goalsRouter);
router.use(sessionsRouter);
router.use(notesRouter);
router.use(dashboardRouter);

export default router;
