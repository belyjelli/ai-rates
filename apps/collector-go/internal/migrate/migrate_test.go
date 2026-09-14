package migrate

import (
	"context"
	"fmt"
	"os"
	"reflect"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPlanAppliesInFilenameOrderAndSkipsWhatIsRecorded(t *testing.T) {
	apply, skip := Plan(
		[]string{"010_b.sql", "002_a.sql", "README.md", "001_init.sql"},
		map[string]bool{"001_init.sql": true},
	)
	if want := []string{"002_a.sql", "010_b.sql"}; !reflect.DeepEqual(apply, want) {
		t.Errorf("apply = %v, want %v", apply, want)
	}
	if want := []string{"001_init.sql"}; !reflect.DeepEqual(skip, want) {
		t.Errorf("skip = %v, want %v", skip, want)
	}
}

// The repository's own migrations must sort into the order they were written. A file named 9_x.sql
// beside 010_y.sql would run AFTER it, silently, so the three-digit prefix is load-bearing.
func TestRepositoryMigrationsSortByTheirNumber(t *testing.T) {
	entries, err := os.ReadDir("../../../../packages/db/migrations")
	if os.IsNotExist(err) {
		t.Skip("packages/db/migrations not found; this check needs the whole repository")
	}
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	apply, _ := Plan(names, nil)
	if len(apply) == 0 {
		t.Fatal("no migrations found")
	}
	for i, name := range apply {
		if want := fmt.Sprintf("%03d_", i+1); !strings.HasPrefix(name, want) {
			t.Fatalf("migration %d is %s, want a %s prefix: numbering has a gap or a duplicate", i+1, name, want)
		}
	}
}

// Against a real database, and skipped without one, like the store's integration tests. It applies
// a uniquely named throwaway migration so it cannot disturb the real schema_migrations rows.
func TestApplyRecordsSuccessAndRollsBackFailure(t *testing.T) {
	dsn := os.Getenv("AIRATES_TEST_DSN")
	if dsn == "" {
		t.Skip("set AIRATES_TEST_DSN to run migration integration tests")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	defer pool.Close()

	suffix := time.Now().UnixNano()
	good := fmt.Sprintf("zzz_%d_good.sql", suffix)
	bad := fmt.Sprintf("zzz_%d_zbad.sql", suffix)
	table := fmt.Sprintf("migrate_probe_%d", suffix)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM schema_migrations WHERE version IN ($1, $2)`, good, bad)
		_, _ = pool.Exec(ctx, "DROP TABLE IF EXISTS "+table)
	})

	// Two statements in one file, which only the simple protocol accepts.
	dir := fstest.MapFS{
		good: {Data: []byte(fmt.Sprintf("CREATE TABLE %s (id int); INSERT INTO %s VALUES (1);", table, table))},
		bad:  {Data: []byte("SELECT 1; SELECT no_such_column FROM schema_migrations;")},
	}

	_, err = Apply(ctx, pool, dir)
	if err == nil || !strings.Contains(err.Error(), bad) {
		t.Fatalf("want the failing migration named in the error, got %v", err)
	}

	var recorded []string
	rows, err := pool.Query(ctx, `SELECT version FROM schema_migrations WHERE version IN ($1, $2) ORDER BY version`, good, bad)
	if err != nil {
		t.Fatal(err)
	}
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			t.Fatal(err)
		}
		recorded = append(recorded, v)
	}
	rows.Close()
	if want := []string{good}; !reflect.DeepEqual(recorded, want) {
		t.Fatalf("recorded %v, want %v: the good file is kept and the failing one rolled back", recorded, want)
	}
}
