/**
 * ACC-18: admin accounts are created by seeding, never by self-registration.
 *
 * Usage (from the backend folder):
 *   npm run seed:admin
 *
 * Reads ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD from the root .env.
 * Safe to run more than once: it does nothing if the email already exists.
 */
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';

import { AppModule } from '../app.module';
import {
  PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
} from '../common/password-policy';
import { UsersService } from '../users/users.service';

async function seedAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const config = app.get(ConfigService);
    const name = config.get<string>('ADMIN_NAME')?.trim() || 'Platform Admin';
    const email = config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    const password = config.get<string>('ADMIN_PASSWORD');

    if (!email || !password) {
      throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the root .env file');
    }

    if (!PASSWORD_REGEX.test(password)) {
      throw new Error(`ADMIN_PASSWORD is invalid: ${PASSWORD_RULE_MESSAGE}`);
    }

    const usersService = app.get(UsersService);
    const existing = await usersService.findByEmail(email);

    if (existing) {
      console.log(
        existing.role === 'admin'
          ? `Admin ${email} already exists. Nothing to do.`
          : `An account with ${email} already exists with role "${existing.role}". Use a different ADMIN_EMAIL.`,
      );
      return;
    }

    await usersService.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'admin',
      status: 'active',
      mustChangePassword: false,
    });

    console.log(`Admin account created: ${email}`);
  } finally {
    await app.close();
  }
}

seedAdmin().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
