import type { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ ErrorMessage: err.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ ErrorMessage: 'An internal server error occurred.' });
};
