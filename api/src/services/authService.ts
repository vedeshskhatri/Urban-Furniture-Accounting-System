import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { SignupInput, LoginInput } from '../shared/schemas/auth';
import { UserPayload } from './scope';
import { AuditService } from './auditService';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is required');
}
const JWT_SECRET: string = process.env.JWT_SECRET;

export interface AuthResult {
  user: UserPayload;
  token: string;
}

export class AuthService {
  static async signup(input: SignupInput): Promise<UserPayload> {
    // Check login_id uniqueness
    const existingLogin = await pool.query(
      'SELECT id FROM users WHERE login_id = $1',
      [input.login_id]
    );
    if (existingLogin.rows.length > 0) {
      throw new Error('Login ID already registered');
    }

    // Check email uniqueness
    const existingEmail = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [input.email]
    );
    if (existingEmail.rows.length > 0) {
      throw new Error('Email already registered');
    }

    // Argon2id hashing
    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
    });

    // Determine role: admin, accountant, or user (portal contact)
    let role: string = input.role || 'accountant';
    let contactId: number | null = null;

    if (role === 'user' || role === 'contact') {
      role = 'contact';
      // Create a customer contact record for the portal user
      const contactRes = await pool.query(
        `INSERT INTO contacts (name, email, type) VALUES ($1, $2, 'customer') RETURNING id`,
        [input.full_name, input.email]
      );
      contactId = contactRes.rows[0].id;
    }

    const result = await pool.query<UserPayload>(
      `INSERT INTO users (login_id, email, full_name, password_hash, role, contact_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, login_id, email, full_name, role, contact_id`,
      [input.login_id, input.email, input.full_name, passwordHash, role, contactId]
    );

    return result.rows[0];
  }

  static async login(input: LoginInput): Promise<AuthResult> {
    const raw = (input.login_id || '').trim();
    // Only 'admin' maps to 'adminuf' for staff login convenience. Customers (client) must use the portal.
    const effectiveLoginId = raw === 'admin' ? 'adminuf' : raw;
    const result = await pool.query(
      `SELECT id, login_id, email, full_name, password_hash, role, contact_id
       FROM users
       WHERE LOWER(login_id) = LOWER($1) OR LOWER(email) = LOWER($1)`,
      [effectiveLoginId]
    );

    const user = result.rows[0];

    // Constant-time failure or exact error message
    if (!user || !user.password_hash) {
      await AuditService.log({
        tableName: 'users',
        recordId: user?.id ?? 0,
        action: 'login_failed',
        userId: user?.id ?? null,
        afterData: { loginId: raw, reason: 'unknown_user' },
      }).catch(() => undefined);
      throw new Error('Invalid Login Id or Password');
    }

    const validPassword = await argon2.verify(user.password_hash, input.password);
    if (!validPassword) {
      await AuditService.log({
        tableName: 'users',
        recordId: user.id,
        action: 'login_failed',
        userId: user.id,
        afterData: { loginId: user.login_id, reason: 'bad_password' },
      }).catch(() => undefined);
      throw new Error('Invalid Login Id or Password');
    }

    // Role check: Customers (contact role) CANNOT access the admin side of the system!
    // While trying to enter the admin side, it SHALL return as Invalid Login Id or Password.
    if (user.role === 'contact' || user.contact_id !== null) {
      await AuditService.log({
        tableName: 'users',
        recordId: user.id,
        action: 'login_failed',
        userId: user.id,
        afterData: { loginId: user.login_id, reason: 'customer_denied_admin_access' },
      }).catch(() => undefined);
      throw new Error('Invalid Login Id or Password');
    }

    const payload: UserPayload = {
      id: user.id,
      login_id: user.login_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      contact_id: user.contact_id,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    await AuditService.log({
      tableName: 'users',
      recordId: user.id,
      action: 'login',
      userId: user.id,
      afterData: { loginId: user.login_id, role: user.role },
    }).catch(() => undefined);

    return {
      user: payload,
      token,
    };
  }

  static async getUserById(id: number): Promise<UserPayload | null> {
    const result = await pool.query<UserPayload>(
      `SELECT id, login_id, email, full_name, role, contact_id
       FROM users
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
}
