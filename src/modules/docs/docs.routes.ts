import { Request, Response, Router } from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "@/config";

const router = Router();

router.get("/docs.json", (_req: Request, res: Response) => {
  res.json(swaggerSpec);
});

router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export default router;
