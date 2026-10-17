import postgres from 'postgres';
import { E2E_DATABASE_URL } from './env';

/** Direct database access for assertions about server-side state. */
export function e2eSql() {
  return postgres(E2E_DATABASE_URL, { max: 2, onnotice: () => {} });
}
