import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from './generated/prisma/client.ts';
import { createDatabaseAccessor } from './databaseClient.ts';

export const getDatabase = createDatabaseAccessor(config => new PrismaClient({ adapter: new PrismaLibSql(config) }));

// Lazy initialization lets builds package the API without credentials or DB access.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getDatabase();
    const value: unknown = Reflect.get(instance, property);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
