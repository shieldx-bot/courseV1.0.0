# Migrations

Run migrations in order:

```bash
# From apps/api/ (repo root is the workspace root for CI compose)
python -m app.core.cli migrate 001_seed_categories
python -m app.core.cli migrate 002_add_indexes
python -m app.core.cli seed
```

Naming convention: `NNN_description.py`.

> **DevOps note (Phase 0):** the historically documented invocation
> `python -m app.cli migrate 001` is **not executable today**:
>
> 1. The CLI module lives at `app/core/cli.py`, so the module path is
>    `app.core.cli` (the `app.cli` alias is not registered).
> 2. The CLI expects the **full** migration name (e.g. `001_seed_categories`),
>    not the bare prefix `001`.
> 3. The runner resolves migration files relative to
>    `apps/api/app/migrations/`, but the files live in `apps/api/migrations/`
>    — so the runner logs `Migration not found: <name>` and exits 0 without
>    executing anything.
>
> The CI migration check (`devops/scripts/ci-migration-check.sh`, wired into
> `.github/workflows/ci.yml`) runs the real module with full names and **fails
> fast** if the runner reports `Migration not found`, so the path bug cannot
> silently pass CI. A backend fix is required to make the documented aliases
> work; see the Phase 0 DevOps report for details.

## Idempotency

- `001_seed_categories` skips when the collection already has documents.
- `002_add_indexes` ensures indexes via `app.db.indexes`.
- `seed` skips any JSON seed collection that already has documents.