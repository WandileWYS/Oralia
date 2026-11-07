import { resolveDatabaseConfig } from './environment.ts';
import { reportDatabaseFailure } from './databaseDiagnostics.ts';

export function createDatabaseAccessor<T>(
  factory: (config: ReturnType<typeof resolveDatabaseConfig>) => T,
  environment: () => NodeJS.ProcessEnv = () => process.env,
) {
  let client: T | undefined;
  return () => {
    if (client !== undefined) return client;
    try {
      client = factory(resolveDatabaseConfig(environment()));
      return client;
    } catch (error) {
      reportDatabaseFailure(error, 'initialization');
      throw error;
    }
  };
}
