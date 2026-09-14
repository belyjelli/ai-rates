// Package migrate applies packages/db/migrations at startup.
//
// A port of packages/db/src/migrate.ts, and deliberately the same algorithm: `*.sql` files in filename
// order, each in its own transaction, recorded by filename in schema_migrations. Same table and same
// keys, so the Bun runner and this one agree on what has been applied and either can follow the other.
//
// WHY IT EXISTS. The Bun collector migrated on every boot; the Go port did not, so from the cutover on
// 2026-09-15 a new migration would have been committed, deployed, and never applied — with nothing
// failing until a query reached for a column that was not there.
package migrate

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// DB is the slice of a pgx pool the runner needs.
type DB interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	Begin(ctx context.Context) (pgx.Tx, error)
}

// Result names the files applied by this call and the ones already recorded.
type Result struct {
	Applied []string
	Skipped []string
}

// Apply runs every migration in dir that schema_migrations does not already record.
//
// A migration's text is executed with no arguments, which pgx sends over the simple query protocol:
// that is what lets one file hold many statements and DO blocks, as the TypeScript runner's
// `unsafe()` does. The first failure stops the run, and its transaction — the statements and the
// schema_migrations row together — rolls back, so a broken migration is retried on the next boot
// rather than recorded as done.
func Apply(ctx context.Context, db DB, dir fs.FS) (Result, error) {
	var result Result

	if _, err := db.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		version text PRIMARY KEY,
		applied_at timestamptz NOT NULL DEFAULT now()
	)`); err != nil {
		return result, fmt.Errorf("create schema_migrations: %w", err)
	}

	done, err := appliedVersions(ctx, db)
	if err != nil {
		return result, err
	}

	names, err := fs.Glob(dir, "*.sql")
	if err != nil {
		return result, fmt.Errorf("list migrations: %w", err)
	}
	// An empty directory is a packaging fault, not a database with nothing to do: the image is
	// supposed to carry every migration, and starting without them would hide exactly the failure
	// this package exists to prevent.
	if len(names) == 0 {
		return result, fmt.Errorf("no *.sql migrations found")
	}

	apply, skip := Plan(names, done)
	result.Skipped = skip
	for _, name := range apply {
		text, err := fs.ReadFile(dir, name)
		if err != nil {
			return result, fmt.Errorf("read %s: %w", name, err)
		}
		if err := applyOne(ctx, db, name, string(text)); err != nil {
			return result, err
		}
		result.Applied = append(result.Applied, name)
	}
	return result, nil
}

// Plan splits migration file names into those to apply, in filename order, and those already done.
func Plan(names []string, done map[string]bool) (apply, skip []string) {
	sorted := append([]string(nil), names...)
	sort.Strings(sorted)
	for _, name := range sorted {
		if !strings.HasSuffix(name, ".sql") {
			continue
		}
		if done[name] {
			skip = append(skip, name)
		} else {
			apply = append(apply, name)
		}
	}
	return apply, skip
}

func appliedVersions(ctx context.Context, db DB) (map[string]bool, error) {
	rows, err := db.Query(ctx, `SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	defer rows.Close()
	done := map[string]bool{}
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, fmt.Errorf("read schema_migrations: %w", err)
		}
		done[version] = true
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read schema_migrations: %w", err)
	}
	return done, nil
}

func applyOne(ctx context.Context, db DB, name, text string) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin %s: %w", name, err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, text); err != nil {
		return fmt.Errorf("apply %s: %w", name, err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (version) VALUES ($1)`, name); err != nil {
		return fmt.Errorf("record %s: %w", name, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit %s: %w", name, err)
	}
	return nil
}
