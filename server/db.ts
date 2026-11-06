import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from './generated/prisma/client.ts';
import { resolveDatabaseConfig } from './environment.ts';

let client: PrismaClient | undefined;
export function getDatabase() {
  return client ??= new PrismaClient({ adapter: new PrismaLibSql(resolveDatabaseConfig(process.env)) });
}

// Lazy initialization lets builds package the API without credentials or DB access.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getDatabase();
    const value: unknown = Reflect.get(instance, property);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
