import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clientsRouter from "./clients";
import goalsRouter from "./goals";
import sessionsRouter from "./sessions";
import notesRouter from "./notes";
import exercisesRouter from "./exercises";
import correctionsRouter from "./corrections";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clientsRouter);
router.use(goalsRouter);
router.use(sessionsRouter);
router.use(notesRouter);
router.use(exercisesRouter);
router.use(correctionsRouter);
router.use(dashboardRouter);

export default router;
