import { Router, Request, Response, NextFunction } from 'express';
import { validateQuery } from '@/api/middleware/validation.middleware.js';
import { HealthQuerySchema } from '@/api/validators/schemas.js';
import { Logger } from '@/utils/logger.js';

const logger = Logger.create('HealthRoutes');
const router: Router = Router();

router.get(
  '/',
  validateQuery(HealthQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { detailed } = req.query as { detailed?: boolean };
      
      const basicStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0'
      };
      
      if (!detailed) {
        res.json(basicStatus);
        return;
      }
      
      // Detailed health check would include service status
      const detailedStatus = {
        ...basicStatus,
        services: {
          slack: {
            status: 'disconnected' as const,
            lastCheck: new Date().toISOString(),
            error: 'Slack client not yet implemented'
          },
          llm: {
            status: 'disconnected' as const,
            provider: 'none',
            lastCheck: new Date().toISOString(),
            error: 'LLM provider not yet configured'
          }
        },
        system: {
          memory: {
            used: process.memoryUsage().heapUsed,
            total: process.memoryUsage().heapTotal,
            external: process.memoryUsage().external
          },
          cpu: {
            usage: process.cpuUsage()
          }
        }
      };
      
      logger.info('Health check performed', { detailed, services: detailedStatus.services });
      
      res.json(detailedStatus);
    } catch (error) {
      next(error);
    }
  }
);

export { router as healthRoutes };