import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[ServerHub] Unhandled error:', err);

  const message = err instanceof Error ? err.message : 'Internal server error';
  const statusCode =
    typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as { statusCode: unknown }).statusCode === 'number'
      ? (err as { statusCode: number }).statusCode
      : 500;

  res.status(statusCode).json({ success: false, error: message });
}
