import { int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const conversations = mysqlTable("conversations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 160 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  conversationId: int("conversationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: mediumtext("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const workspaceFiles = mysqlTable(
  "workspace_files",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    path: varchar("path", { length: 260 }).notNull(),
    language: varchar("language", { length: 32 }).notNull(),
    content: mediumtext("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("workspace_files_user_path_unique").on(table.userId, table.path)]
);

export const backendPreferences = mysqlTable(
  "backend_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    baseUrl: varchar("baseUrl", { length: 512 }).notNull(),
    systemPrompt: text("systemPrompt").notNull(),
    temperature: int("temperature").notNull().default(70),
    maxTokens: int("maxTokens").notNull().default(4096),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("backend_preferences_user_unique").on(table.userId)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
