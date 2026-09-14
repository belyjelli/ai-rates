package catalog

import (
	"os"
	"path/filepath"
	"testing"
)

// repoCatalog is the generated file, relative to this package.
const repoCatalog = "../../../../packages/venues/catalog.json"

func TestLoadReadsTheRepositoryCatalog(t *testing.T) {
	if _, err := os.Stat(repoCatalog); os.IsNotExist(err) {
		t.Skipf("%s not found; this check needs the whole repository", repoCatalog)
	}
	venues, err := Load(repoCatalog)
	if err != nil {
		t.Fatal(err)
	}
	byID := map[string]Venue{}
	for _, venue := range venues {
		byID[venue.ID] = venue
	}
	// The three venues the Bun collector applied curated leverage to.
	for _, id := range []string{"aster", "lighter", "paradex"} {
		if byID[id].MaxLeverage == nil {
			t.Errorf("%s: want a curated maxLeverage", id)
		}
	}
	if byID["ethereal"].Retired == "" {
		t.Error("ethereal: want the retired field carried through")
	}
	if got := CuratedMaxLeverage(venues)["bybit"]; got != 0 {
		t.Errorf("bybit publishes its own leverage, so it has no curated figure; got %v", got)
	}
}

func TestLoadRejectsWhatWouldFailLater(t *testing.T) {
	cases := map[string]string{
		"empty":        `[]`,
		"missing type": `[{"id":"a","name":"A"}]`,
		"duplicate":    `[{"id":"a","name":"A","type":"cex"},{"id":"a","name":"B","type":"dex"}]`,
		"not json":     `{`,
	}
	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "catalog.json")
			if err := os.WriteFile(path, []byte(body), 0o600); err != nil {
				t.Fatal(err)
			}
			if _, err := Load(path); err == nil {
				t.Fatal("want an error")
			}
		})
	}
}
