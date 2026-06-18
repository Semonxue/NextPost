import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ==================== User ====================
export const user = sqliteTable(
  "User",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
    email: text("email"),
    aiProvider: text("aiProvider").notNull().default("openai"),
    aiApiKey: text("aiApiKey"),
    aiModel: text("aiModel").notNull().default("gpt-4"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
  }
);

// ==================== Platform ====================
export const platform = sqliteTable(
  "Platform",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull().unique(),
    icon: text("icon"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  }
);

// ==================== PlatformConfig ====================
export const platformConfig = sqliteTable(
  "PlatformConfig",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    platformId: text("platformId").notNull().unique(),
    maxContentLength: integer("maxContentLength").notNull().default(280),
    maxImages: integer("maxImages").notNull().default(4),
    maxVideos: integer("maxVideos").notNull().default(1),
    allowMixedMedia: integer("allowMixedMedia", { mode: "boolean" }).notNull().default(true),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
  }
);

// ==================== Account ====================
export const account = sqliteTable(
  "Account",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    platformId: text("platformId").notNull(),
    name: text("name").notNull(),
    handle: text("handle").notNull(),
    description: text("description"),
    deletedAt: text("deletedAt"),
    deletedBy: text("deletedBy"),
    deleteNote: text("deleteNote"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("Account_deletedAt_idx").on(t.deletedAt),
    index("Account_userId_idx").on(t.userId),
  ]
);

// ==================== Post ====================
export const post = sqliteTable(
  "Post",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    accountId: text("accountId").notNull(),
    content: text("content").notNull(),
    title: text("title"),
    mediaUrls: text("mediaUrls").notNull().default("[]"),
    mediaThumbnails: text("mediaThumbnails").notNull().default("[]"),
    scheduledTime: text("scheduledTime"),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    status: text("status").notNull().default("draft"),
    publishToken: text("publishToken"),
    publishTokenExp: text("publishTokenExp"),
    publishedAt: text("publishedAt"),
    externalPostId: text("externalPostId"),
    externalPostUrl: text("externalPostUrl"),
    publishError: text("publishError"),
    publishAttempts: integer("publishAttempts").notNull().default(0),
    deletedAt: text("deletedAt"),
    deletedBy: text("deletedBy"),
    deleteNote: text("deleteNote"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("Post_status_idx").on(t.status),
    index("Post_scheduledTime_idx").on(t.scheduledTime),
    index("Post_deletedAt_idx").on(t.deletedAt),
    index("Post_userId_idx").on(t.userId),
  ]
);

// ==================== Media ====================
export const media = sqliteTable("Media", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  filename: text("filename").notNull(),
  size: integer("size").notNull(),
  mimeType: text("mimeType").notNull(),
  uploadedAt: text("uploadedAt").notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== Conversation ====================
export const conversation = sqliteTable("Conversation", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").notNull(),
  title: text("title").notNull().default("新对话"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updatedAt").notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== Message ====================
export const message = sqliteTable("Message", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversationId").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  toolCalls: text("toolCalls").notNull().default("[]"),
  toolResults: text("toolResults").notNull().default("[]"),
  model: text("model"),
  createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
});

// ==================== ExternalApiKey ====================
export const externalApiKey = sqliteTable(
  "ExternalApiKey",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    permissions: text("permissions").notNull().default("read_report"),
    lastUsedAt: text("lastUsedAt"),
    expiresAt: text("expiresAt"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("ExternalApiKey_userId_idx").on(t.userId),
    index("ExternalApiKey_key_idx").on(t.key),
  ]
);

// ==================== AiOperationLog ====================
export const aiOperationLog = sqliteTable(
  "AiOperationLog",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    conversationId: text("conversationId"),
    operation: text("operation").notNull(),
    entityType: text("entityType").notNull(),
    entityId: text("entityId").notNull(),
    beforeState: text("beforeState"),
    afterState: text("afterState"),
    aiModel: text("aiModel"),
    createdAt: text("createdAt").notNull().$defaultFn(() => new Date().toISOString()),
  },
  (t) => [
    index("AiOperationLog_userId_idx").on(t.userId),
    index("AiOperationLog_entity_idx").on(t.entityType, t.entityId),
    index("AiOperationLog_createdAt_idx").on(t.createdAt),
  ]
);