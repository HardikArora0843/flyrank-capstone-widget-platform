import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, getClient } from '../db/pool.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

export class AuthService {
  static async register({ email, password, name, tenantName }) {
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existingUser.rows.length > 0) {
      throw new AppError('A user with this email already exists', 409, 'USER_EXISTS');
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      const tenantRes = await client.query(
        'INSERT INTO tenants (name) VALUES ($1) RETURNING id, name, created_at',
        [tenantName]
      );
      const tenant = tenantRes.rows[0];

      const passwordHash = await bcrypt.hash(password, 10);
      const userRes = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, name)
         VALUES ($1, $2, $3, $4) RETURNING id, tenant_id, email, name, created_at`,
        [tenant.id, email.toLowerCase(), passwordHash, name]
      );
      const user = userRes.rows[0];

      await client.query('COMMIT');

      const token = jwt.sign(
        {
          id: user.id,
          tenantId: user.tenant_id,
          email: user.email,
          name: user.name,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tenantId: user.tenant_id,
          tenantName: tenant.name,
        },
        token,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async login({ email, password }) {
    const res = await query(
      `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.name, t.name as tenant_name
       FROM users u
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (res.rows.length === 0) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const user = res.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const token = jwt.sign(
      {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        name: user.name,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        tenantId: user.tenant_id,
        tenantName: user.tenant_name,
      },
      token,
    };
  }
}
