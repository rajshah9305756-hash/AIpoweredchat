import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  backendPreferences,
  conversations,
  InsertUser,
  messages,
  users,
  workspaceFiles,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { DEFAULT_BACKEND_PREFERENCES, type SafeBackendPreferences } from "./workspaceSecurity";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

function ensureDb<T>(db: T | null): T {
  if (!db) throw new Error("The workspace database is not available.");
  return db;
}

export async function listConversations(userId: number) {
  const db = ensureDb(await getDb());
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function createConversation(userId: number, title: string) {
  const db = ensureDb(await getDb());
  const result = await db.insert(conversations).values({ userId, title });
  return Number(result[0].insertId);
}

export async function getConversation(userId: number, conversationId: number) {
  const db = ensureDb(await getDb());
  const result = await db.select().from(conversations).where(and(eq(conversations.userId, userId), eq(conversations.id, conversationId))).limit(1);
  return result[0];
}

export async function getConversationMessages(userId: number, conversationId: number) {
  const db = ensureDb(await getDb());
  return db.select().from(messages).where(and(eq(messages.userId, userId), eq(messages.conversationId, conversationId))).orderBy(asc(messages.createdAt));
}

export async function addConversationMessage(userId: number, conversationId: number, role: "user" | "assistant", content: string) {
  const db = ensureDb(await getDb());
  await db.insert(messages).values({ userId, conversationId, role, content });
  await db.update(conversations).set({ updatedAt: new Date() }).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
}

export async function updateConversationTitle(userId: number, conversationId: number, title: string) {
  const db = ensureDb(await getDb());
  await db.update(conversations).set({ title, updatedAt: new Date() }).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
}

export async function listWorkspaceFiles(userId: number) {
  const db = ensureDb(await getDb());
  return db.select().from(workspaceFiles).where(eq(workspaceFiles.userId, userId)).orderBy(asc(workspaceFiles.path));
}

export async function saveWorkspaceFile(userId: number, input: { path: string; language: string; content: string }) {
  const db = ensureDb(await getDb());
  await db.insert(workspaceFiles).values({ userId, ...input }).onDuplicateKeyUpdate({
    set: { language: input.language, content: input.content, updatedAt: new Date() },
  });
}

export async function getBackendPreferences(userId: number): Promise<SafeBackendPreferences> {
  const db = await getDb();
  if (!db) return DEFAULT_BACKEND_PREFERENCES;
  const result = await db.select().from(backendPreferences).where(eq(backendPreferences.userId, userId)).limit(1);
  const row = result[0];
  if (!row) return DEFAULT_BACKEND_PREFERENCES;
  return {
    model: row.model,
    baseUrl: row.baseUrl,
    systemPrompt: row.systemPrompt,
    temperature: row.temperature / 100,
    maxTokens: row.maxTokens,
  };
}

export async function saveBackendPreferences(userId: number, preferences: SafeBackendPreferences) {
  const db = ensureDb(await getDb());
  await db.insert(backendPreferences).values({
    userId,
    model: preferences.model,
    baseUrl: preferences.baseUrl,
    systemPrompt: preferences.systemPrompt,
    temperature: Math.round(preferences.temperature * 100),
    maxTokens: preferences.maxTokens,
  }).onDuplicateKeyUpdate({
    set: {
      model: preferences.model,
      baseUrl: preferences.baseUrl,
      systemPrompt: preferences.systemPrompt,
      temperature: Math.round(preferences.temperature * 100),
      maxTokens: preferences.maxTokens,
      updatedAt: new Date(),
    },
  });
}
