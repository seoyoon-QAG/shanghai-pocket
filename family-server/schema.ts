import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const families=sqliteTable('families',{id:text('id').primaryKey(),createdAt:text('created_at').notNull()});
export const entries=sqliteTable('entries',{family:text('family').notNull(),key:text('key').notNull(),value:text('value').notNull(),version:integer('version').notNull(),updatedAt:text('updated_at').notNull()},t=>[primaryKey({columns:[t.family,t.key]})]);
export const rateLimits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull()});
