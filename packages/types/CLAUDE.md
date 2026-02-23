# packages/types — Claude Memory

## Rules

- Zod schemas are the source of truth — TypeScript types are inferred from them
- Pattern: `export const FooSchema = z.object({...}); export type Foo = z.infer<typeof FooSchema>`
- No runtime logic — only schemas, types, and enums
- Both `apps/api` and `apps/web` (and `apps/sonar`) may depend on this package

## Field type conventions

- UUID fields: `z.string().uuid()` (never `z.string()` alone)
- Datetime fields: `z.string().datetime()` (ISO 8601 strings, not `Date` objects)
- Nullable foreign keys: `z.string().uuid().nullable()` (not `.optional()`)
- Status enums: `z.enum([...])`, then `export type FooStatus = z.infer<typeof FooStatusSchema>`

## Adding a new type

1. Define Zod schema first
2. Infer TypeScript type with `z.infer<>`
3. Export both from `src/index.ts`
4. Run `pnpm --filter @colloquium/types build` to verify exports
5. Run `pnpm --filter @colloquium/types test` to verify schema validation tests
