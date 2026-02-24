import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type AppDb = ReturnType<typeof createDb>;

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  // Inline DDL — no migration tool needed for dev/test
  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        karma_post INTEGER NOT NULL DEFAULT 0,
        karma_comment INTEGER NOT NULL DEFAULT 0,
        cake_day INTEGER NOT NULL,
        avatar_url TEXT,
        bio TEXT,
        is_premium INTEGER NOT NULL DEFAULT 0,
        coin_balance INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        CONSTRAINT users_username_unique UNIQUE(username),
        CONSTRAINT users_email_unique UNIQUE(email)
      )`
    )
    .run();

  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`
    )
    .run();

  return db;
}
