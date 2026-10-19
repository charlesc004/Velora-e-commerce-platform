import type { ErrorRequestHandler, Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';
import { ZodError, type ZodTypeAny, type output } from 'zod';
import type { Page } from '@velora/contracts';

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function data<T>(res: Response, value: T, status = 200): void {
  res.status(status).json({ data: value });
}
export function parse<S extends ZodTypeAny>(schema: S, body: unknown): output<S> {
  return schema.parse(body);
}
export function objectId(value: unknown): string {
  if (typeof value !== 'string' || !Types.ObjectId.isValid(value))
    throw new AppError(404, 'NOT_FOUND', 'Record not found');
  return value;
}
export function parameter(req: Request, key: string): string {
  const value = req.params[key];
  return typeof value === 'string' ? value : '';
}
export function pagination(req: Request): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 12));
  return {
    page: Math.floor(page),
    limit: Math.floor(limit),
    skip: (Math.floor(page) - 1) * Math.floor(limit),
  };
}
export function pageResult<T>(items: T[], total: number, page: number, limit: number): Page<T> {
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}
export const notFound: RequestHandler = (_req, _res, next) =>
  next(new AppError(404, 'NOT_FOUND', 'Endpoint not found'));
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Please check the highlighted fields',
        fields: error.flatten().fieldErrors,
      },
    });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
    res
      .status(409)
      .json({ error: { code: 'CONFLICT', message: 'A record with these details already exists' } });
    return;
  }
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON request' } });
    return;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large' } });
    return;
  }
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'request_failed',
      name: error instanceof Error ? error.name : 'UnknownError',
    }),
  );
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' },
  });
};
