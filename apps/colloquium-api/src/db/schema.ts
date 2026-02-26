import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  karmaPost: integer("karma_post").notNull().default(0),
  karmaComment: integer("karma_comment").notNull().default(0),
  cakeDay: integer("cake_day").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  isPremium: integer("is_premium", { mode: "boolean" }).notNull().default(false),
  coinBalance: integer("coin_balance").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at"),
});

export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
