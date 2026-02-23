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
        email TEXT NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar TEXT,
        status_emoji TEXT,
        status_text TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        CONSTRAINT users_email_unique UNIQUE(email),
        CONSTRAINT users_username_unique UNIQUE(username)
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

  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        icon TEXT,
        owner_id INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        CONSTRAINT workspaces_slug_unique UNIQUE(slug)
      )`
    )
    .run();

  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS workspace_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
        user_id INTEGER NOT NULL REFERENCES users(id),
        role TEXT NOT NULL DEFAULT 'member',
        joined_at INTEGER NOT NULL,
        CONSTRAINT workspace_members_unique UNIQUE(workspace_id, user_id)
      )`
    )
    .run();

  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS workspace_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
        token TEXT NOT NULL,
        created_by INTEGER NOT NULL REFERENCES users(id),
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`
    )
    .run();

  sqlite
    .prepare(
      `CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
        name TEXT NOT NULL,
        description TEXT,
        is_private INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_by INTEGER NOT NULL REFERENCES users(id),
        created_at INTEGER NOT NULL,
        CONSTRAINT channels_workspace_name_unique UNIQUE(workspace_id, name)
      )`
    )
    .run();

  return db;
}

let _db: AppDb | null = null;

export function getDb(): AppDb {
  if (!_db) {
    const dbPath = process.env.DATABASE_PATH ?? "./db/chat.db";
    _db = createDb(dbPath);
  }
  return _db;
}
