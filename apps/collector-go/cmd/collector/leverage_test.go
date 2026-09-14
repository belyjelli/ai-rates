package main

import (
	"os"
	"regexp"
	"strconv"
	"testing"
)

// catalogPath is the TypeScript venue catalog, relative to this package.
const catalogPath = "../../../../packages/venues/src/catalog.ts"

// TestCuratedLeverageMatchesCatalog pins curatedMaxLeverage to the catalog's `maxLeverage` fields.
//
// The catalog is the authority and Go cannot import it, so the two are held together by reading the
// source. This is the drift that already happened once: the port shipped an empty map, nothing
// failed, and new markets on three venues silently lost their leverage figure.
//
// It relies on each catalog entry spelling `id` before `maxLeverage`, which every entry does.
func TestCuratedLeverageMatchesCatalog(t *testing.T) {
	source, err := os.ReadFile(catalogPath)
	if os.IsNotExist(err) {
		t.Skipf("%s not found; this check needs the whole repository", catalogPath)
	}
	if err != nil {
		t.Fatal(err)
	}

	field := regexp.MustCompile(`\bid: "([^"]+)"|\bmaxLeverage: ([0-9.]+)`)
	want := map[string]float64{}
	current := ""
	for _, m := range field.FindAllStringSubmatch(string(source), -1) {
		if m[1] != "" {
			current = m[1]
			continue
		}
		value, err := strconv.ParseFloat(m[2], 64)
		if err != nil {
			t.Fatalf("maxLeverage %q for %s: %v", m[2], current, err)
		}
		want[current] = value
	}

	if len(want) == 0 {
		t.Fatal("found no maxLeverage in the catalog; the pattern no longer matches its layout")
	}
	for id, value := range want {
		if got, ok := curatedMaxLeverage[id]; !ok || got != value {
			t.Errorf("%s: catalog maxLeverage %v, curatedMaxLeverage has %v (present: %v)", id, value, got, ok)
		}
	}
	for id := range curatedMaxLeverage {
		if _, ok := want[id]; !ok {
			t.Errorf("%s: in curatedMaxLeverage but has no maxLeverage in the catalog", id)
		}
	}
}
