// Test helper: a fresh, migrated and seeded in-memory database. Only for `npm run test:db`.

import { resolve } from 'node:path'
import { openDatabase, type Db } from './connection'

export const MIGRATIONS_FOLDER = resolve(__dirname, '../../../drizzle')

export function openTestDb(filename = ':memory:'): Db {
  return openDatabase(filename, MIGRATIONS_FOLDER)
}
