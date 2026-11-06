import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from './generated/prisma/client.ts';
import { databaseUrl } from './databaseUrl.ts';

export const db = new PrismaClient({ adapter: new PrismaLibSql({ url: databaseUrl }) });
