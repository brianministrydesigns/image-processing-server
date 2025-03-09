import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ErrorResponse } from '../types';

/**
 * Error handling middleware
 * Catches all unhandled errors and returns a standardized error response
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction): void => {
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;

  const errorResponse: ErrorResponse = {
    status: statusCode,
    message: err.message || 'Internal server error',
  };

  // Log the error with request details
  logger.error(
    {
      err,
      req: {
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        body: req.body,
      },
    },
    'Request error',
  );

  res.status(statusCode).json(errorResponse);
};
