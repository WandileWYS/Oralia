import './environment.ts';
// Prisma CLI schema operations use local SQLite, not the remote runtime adapter.
export const databaseUrl = process.env.DATABASE_URL || 'file:./prisma/oralia.db';
