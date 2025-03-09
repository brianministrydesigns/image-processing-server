import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { logger } from '../utils/logger';

/**
 * Validates request against express-validator rules
 * Returns 400 with validation errors if validation fails
 */
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors = errors.array().reduce((acc: Record<string, string[]>, error: any) => {
      const field = error.path || error.param || 'general';
      if (!acc[field]) {
        acc[field] = [];
      }
      acc[field].push(error.msg);
      return acc;
    }, {});

    logger.warn({ validationErrors }, 'Validation failed');

    res.status(400).json({
      status: 400,
      message: 'Validation failed',
      errors: validationErrors,
    });
    return;
  }

  next();
};
