import { randomUUID } from 'node:crypto';
import express, { type RequestHandler } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { config } from './config.js';
import { AppError, data, errorHandler, notFound } from './http.js';
import { authRoutes, optionalAuth, userRoutes } from './modules/auth.js';
import { catalogRoutes } from './modules/catalog.js';
import { cartRoutes } from './modules/carts/cart.routes.js';
import { wishlistRoutes } from './modules/wishlists/wishlist.routes.js';
import { checkoutRoutes, orderRoutes, paymentRoutes, stripeWebhook } from './modules/checkout.js';
import { adminRoutes } from './modules/admin.js';

const originProtection: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }
  const origin = req.headers.origin;
  if (
    (origin && origin !== new URL(config.WEB_ORIGIN).origin) ||
    req.headers['sec-fetch-site'] === 'cross-site'
  ) {
    next(new AppError(403, 'INVALID_ORIGIN', 'This request origin is not allowed'));
    return;
  }
  if (
    req.headers['content-length'] !== '0' &&
    (req.headers['content-length'] || req.headers['transfer-encoding']) &&
    !req.is('application/json')
  ) {
    next(new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Use application/json for this request'));
    return;
  }
  next();
};

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.TRUST_PROXY_HOPS > 0) app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(helmet({ referrerPolicy: { policy: 'no-referrer' } }));
  app.use(
    cors({
      origin: new URL(config.WEB_ORIGIN).origin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    }),
  );
  app.use((req, res, next) => {
    const requestId = randomUUID();
    const started = Date.now();
    res.setHeader('X-Request-Id', requestId);
    if (config.NODE_ENV !== 'test')
      res.on('finish', () =>
        console.info(
          JSON.stringify({
            level: 'info',
            requestId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            durationMs: Date.now() - started,
          }),
        ),
      );
    next();
  });
  app.use(
    '/api/v1',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.NODE_ENV === 'test' ? 10000 : 1000,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
      },
    }),
  );
  app.post(
    '/api/v1/payments/stripe/webhook',
    express.raw({ type: 'application/json', limit: '256kb' }),
    stripeWebhook,
  );
  app.use(express.json({ limit: '128kb' }), cookieParser(), originProtection);
  app.get('/api/v1/health', (_req, res) => {
    if (mongoose.connection.readyState !== 1) {
      res
        .status(503)
        .json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is unavailable' } });
      return;
    }
    data(res, { status: 'ok' });
  });
  app.use('/api/v1', optionalAuth);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1', catalogRoutes);
  app.use('/api/v1/cart', cartRoutes);
  app.use('/api/v1/wishlist', wishlistRoutes);
  app.use('/api/v1/checkout', checkoutRoutes);
  app.use('/api/v1/orders', orderRoutes);
  app.use('/api/v1/payments', paymentRoutes);
  app.use('/api/v1/admin', adminRoutes);
  app.use(notFound, errorHandler);
  return app;
}

export const app = createApp();
