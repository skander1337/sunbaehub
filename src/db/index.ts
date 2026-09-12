import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_PATH = process.env.DB_PATH ?? "dev.db"; // relative to process.cwd() = project root

const g = globalThis as unknown as { __sunbaeSqlite?: Database.Database };
const sqlite = g.__sunbaeSqlite ?? new Database(DB_PATH);
if (process.env.NODE_ENV !== "production") g.__sunbaeSqlite = sqlite; // survive Turbopack HMR
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle({ client: sqlite, schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
