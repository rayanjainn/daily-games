import { resetTestDatabase } from './db';

export default async function setup() {
  await resetTestDatabase();
}
