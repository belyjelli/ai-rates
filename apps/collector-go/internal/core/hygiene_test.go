package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// No Go source in this module may contain a raw U+0000 byte.
//
// This mirrors apps/collector/src/source-hygiene.test.ts, which guards the TypeScript tree for the
// same reason and has already earned its place twice there. A raw NUL makes `file` report the
// source as `data`, so grep treats it as binary and prints NOTHING — not "binary file matches",
// just silence — and git renders every diff of the file as `Bin N -> M bytes`. On the TypeScript
// side that cost two sessions: once as an accident where the byte sat where a space belonged, and
// once as a deliberate composite-key separator that spread to 17 occurrences and made greps for a
// method that demonstrably existed return nothing at all.
//
// It has now happened once here too, in store.go's composite map key, where the Go compiler caught
// it as "illegal character NUL" — luckier than the TypeScript case, because a compiler error is
// loud and a silent grep is not. The TypeScript guard could never have caught it: that test scans
// *.ts only.
//
// The separator idiom is sound and the fix is NOT to abandon it. Write it as the escape sequence
// (backslash, x, 0, 0): the identical one-byte string at runtime, byte-for-byte the same keys, and
// the file stays searchable. This test pins that distinction — the escape is allowed, the raw byte
// is not.
//
// SCOPE differs from the TypeScript twin deliberately. That one asks git for tracked files, because
// a filesystem walk there also sweeps up sibling agent worktrees under .claude/ holding other
// commits. This module is self-contained, and its files may not be committed yet — a git-scoped
// scan would then find nothing and pass forever, which is precisely the silent-success failure a
// guard like this exists to prevent.
func TestNoRawNULInGoSources(t *testing.T) {
	root := moduleRoot(t)

	var scanned int
	var offenders []string

	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			// bin/ is build output, not source.
			if entry.Name() == "bin" {
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") {
			return nil
		}
		data, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}
		scanned++
		if strings.ContainsRune(string(data), 0) {
			rel, _ := filepath.Rel(root, path)
			offenders = append(offenders, rel)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("walking %s: %v", root, err)
	}

	// A guard that silently scans nothing is worse than no guard: it reports success forever.
	if scanned < 5 {
		t.Fatalf("scanned only %d .go files under %s; the guard is not looking at the tree", scanned, root)
	}
	if len(offenders) != 0 {
		t.Errorf("raw U+0000 in: %v — write the byte as an escape sequence instead", offenders)
	}
}

// moduleRoot walks up from the test's directory to the directory holding go.mod.
func moduleRoot(t *testing.T) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	for i := 0; i < 10; i++ {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	t.Fatal("could not find go.mod above the working directory")
	return ""
}
