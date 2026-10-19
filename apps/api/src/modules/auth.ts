import { Router, type Request, type Response, type RequestHandler } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import {
  loginSchema,
  registerSchema,
  profileSchema,
  passwordChangeSchema,
  type User,
} from '@velora/contracts';
import { config } from '../config.js';
import { AppError, data, parse } from '../http.js';
import { SessionModel, UserModel } from '../models.js';
import { userDto } from '../serializers.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: { user: User; sessionId: string };
  }
}

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
const accessCookie = 'velora_access';
const refreshCookie = 'velora_refresh';
const refreshAge = 7 * 24 * 60 * 60 * 1000;
const cookieBase = { httpOnly: true, secure: config.secureCookies, sameSite: 'lax' as const };

function setCookies(res: Response, userId: string, sessionId: string, refreshToken: string): void {
  const token = jwt.sign({ sid: sessionId }, config.JWT_SECRET, {
    subject: userId,
    algorithm: 'HS256',
    expiresIn: '15m',
    issuer: 'velora',
    audience: 'velora-web',
  });
  res.cookie(accessCookie, token, { ...cookieBase, path: '/api/v1', maxAge: 15 * 60 * 1000 });
  res.cookie(refreshCookie, refreshToken, {
    ...cookieBase,
    path: '/api/v1/auth',
    maxAge: refreshAge,
  });
}

function clearCookies(res: Response): void {
  res.clearCookie(accessCookie, { ...cookieBase, path: '/api/v1' });
  res.clearCookie(refreshCookie, { ...cookieBase, path: '/api/v1/auth' });
}

async function createSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(48).toString('base64url');
  const session = await SessionModel.create({
    userId,
    refreshHash: hashToken(token),
    expiresAt: new Date(Date.now() + refreshAge),
  });
  setCookies(res, userId, String(session._id), token);
}

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const cookie: unknown = req.cookies?.[accessCookie];
  if (typeof cookie !== 'string') {
    next();
    return;
  }
  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(cookie, config.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'velora',
      audience: 'velora-web',
    });
    if (
      typeof verified === 'string' ||
      typeof verified.sub !== 'string' ||
      typeof verified.sid !== 'string'
    ) {
      next();
      return;
    }
    payload = verified;
  } catch {
    next();
    return;
  }
  const session = await SessionModel.findOne({
    _id: payload.sid,
    userId: payload.sub,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });
  if (session) {
    const user = await UserModel.findById(payload.sub);
    if (user) req.auth = { user: userDto(user), sessionId: String(session._id) };
  }
  next();
};
export const requireAuth: RequestHandler = (req, _res, next) =>
  req.auth ? next() : next(new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue'));
export const requireAdmin: RequestHandler = (req, _res, next) =>
  req.auth?.user.role === 'admin'
    ? next()
    : next(new AppError(403, 'FORBIDDEN', 'Administrator access is required'));
export function currentUser(req: Request): User {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue');
  return req.auth.user;
}

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.NODE_ENV === 'test' ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Too many sign-in attempts. Please try again later.' },
  },
});

export const authRoutes = Router();
authRoutes.post('/register', authLimit, async (req, res) => {
  const input = parse(registerSchema, req.body);
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const user = await UserModel.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: 'customer',
    addresses: [],
  });
  await createSession(res, String(user._id));
  data(res, userDto(user), 201);
});
authRoutes.post('/login', authLimit, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
  // One expensive verification for missing users also avoids a cheap account-discovery timing signal.
  const valid = user
    ? await argon2.verify(user.passwordHash, input.password)
    : (await argon2.hash(input.password), false);
  if (!user || !valid)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  await createSession(res, String(user._id));
  data(res, userDto(user));
});
authRoutes.get('/me', (req, res) => {
  if (!req.auth && typeof req.cookies?.[refreshCookie] === 'string')
    throw new AppError(401, 'SESSION_EXPIRED', 'Your session needs to be refreshed');
  data(res, req.auth?.user ?? null);
});
authRoutes.post('/refresh', authLimit, async (req, res) => {
  const token: unknown = req.cookies?.[refreshCookie];
  if (typeof token !== 'string') throw new AppError(401, 'SESSION_EXPIRED', 'Please sign in again');
  const nextToken = randomBytes(48).toString('base64url');
  const tokenHash = hashToken(token);
  const session = await SessionModel.findOneAndUpdate(
    { refreshHash: tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
    {
      $set: {
        previousRefreshHash: tokenHash,
        refreshHash: hashToken(nextToken),
        expiresAt: new Date(Date.now() + refreshAge),
      },
    },
    { new: true },
  );
  if (!session) {
    await SessionModel.updateOne(
      { previousRefreshHash: tokenHash },
      { $set: { revokedAt: new Date() } },
    );
    clearCookies(res);
    throw new AppError(401, 'SESSION_EXPIRED', 'Please sign in again');
  }
  const user = await UserModel.findById(session.userId);
  if (!user) throw new AppError(401, 'SESSION_EXPIRED', 'Please sign in again');
  setCookies(res, String(user._id), String(session._id), nextToken);
  data(res, userDto(user));
});
authRoutes.post('/logout', async (req, res) => {
  const token: unknown = req.cookies?.[refreshCookie];
  if (typeof token === 'string')
    await SessionModel.updateOne(
      { refreshHash: hashToken(token) },
      { $set: { revokedAt: new Date() } },
    );
  if (req.auth)
    await SessionModel.updateOne({ _id: req.auth.sessionId }, { $set: { revokedAt: new Date() } });
  clearCookies(res);
  data(res, { message: 'Signed out' });
});

export const userRoutes = Router();
userRoutes.use(requireAuth);
userRoutes.patch('/profile', async (req, res) => {
  const input = parse(profileSchema, req.body);
  const user = await UserModel.findByIdAndUpdate(
    currentUser(req).id,
    { $set: input },
    { new: true, runValidators: true },
  );
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Customer not found');
  data(res, userDto(user));
});
userRoutes.post('/password', authLimit, async (req, res) => {
  const input = parse(passwordChangeSchema, req.body);
  const user = await UserModel.findById(currentUser(req).id).select('+passwordHash');
  if (!user || !(await argon2.verify(user.passwordHash, input.currentPassword)))
    throw new AppError(422, 'INVALID_PASSWORD', 'Current password is incorrect');
  user.passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
  await user.save();
  await SessionModel.updateMany(
    { userId: user._id, _id: { $ne: req.auth?.sessionId } },
    { $set: { revokedAt: new Date() } },
  );
  data(res, { message: 'Password updated. Other sessions have been signed out.' });
});
