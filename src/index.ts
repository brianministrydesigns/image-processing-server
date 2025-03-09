import express from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import path from 'path';
import { config, validateConfig } from './config/config';
import { logger } from './utils/logger';
import previewRoutes from './routes/preview.routes';
import staticRoutes from './routes/static.routes';
import { errorHandler } from './middleware/error.middleware';

try {
  validateConfig();
} catch (error) {
  logger.fatal({ error }, 'Configuration validation failed');
  process.exit(1);
}

const app = express();
const port = config.server.port;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', '*.wasabisys.com'],
      },
    },
  }),
);

app.use(pinoHttp({ logger }));

app.use(express.json());

app.use(express.static(path.join(process.cwd(), 'public')));

app.use(previewRoutes);
app.use(staticRoutes);

app.use(errorHandler);

app.listen(port, () => {
  logger.info(`Server is running on http://localhost:${port}`);
  logger.info(`Environment: ${config.server.env}`);
});
