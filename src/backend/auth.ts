/**
 * CivicEye Authentication & Role-Based Access Control (RBAC)
 * Implements JWT token issuance, bcrypt password hashing, and authorization guards
 * as specified in Section 4 & 6 of CivicEye Backend Project Plan.
 */

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { SafeUser, User, UserRole } from './types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'civiceye-secure-jwt-secret-key-2026';
const TOKEN_EXPIRY = '7d';

export interface AuthRequest extends Request {
  user?: SafeUser;
}

export function sanitizeUser(user: User): SafeUser {
  const { password_hash, ...safe } = user;
  return safe;
}

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(user: SafeUser): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department_id: user.department_id
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function verifyToken(token: string): SafeUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = db.findUserById(decoded.id);
    if (!user || !user.is_active) return null;
    return sanitizeUser(user);
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware to extract user from Authorization: Bearer <token>
 * Continues even if unauthenticated, attaching user if present.
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}

/**
 * Express middleware to mandate authenticated user
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is missing. Please log in.'
    });
  }

  const token = authHeader.substring(7).trim();
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired session token. Please log in again.'
    });
  }

  req.user = user;
  next();
}

/**
 * Express middleware to mandate role (e.g. 'authority', 'admin')
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Requires one of [${allowedRoles.join(', ')}] role. Current role: ${req.user.role}`
      });
    }

    next();
  };
}
