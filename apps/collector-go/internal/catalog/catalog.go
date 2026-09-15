// Package catalog reads packages/venues/catalog.json, the slice of the TypeScript venue catalog the Go
// collector needs.
//
// The TypeScript catalog is the authority; catalog.json is generated from it and pinned to it by
// packages/venues/src/catalog.test.ts, so this package never holds a second copy of the list.
package catalog

import (
	"encoding/json"
	"fmt"
	"os"
)

// Venue is one catalogued venue.
type Venue struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
	// MaxLeverage is the hand-curated fallback for venues that publish no leverage at all.
	MaxLeverage *float64 `json:"maxLeverage,omitempty"`
	// Retired is "YYYY-MM-DD: evidence" for a venue no longer worth collecting. A retired venue still
	// gets its row: history and foreign keys name it.
	Retired string `json:"retired,omitempty"`
}

// Load reads and validates catalog.json.
//
// Validation is strict because the file is loaded once at startup, before any row is written: a
// blank id or type would otherwise surface much later as a foreign-key failure on some venue's first
// market, far from its cause.
func Load(path string) ([]Venue, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read venue catalog: %w", err)
	}
	var venues []Venue
	if err := json.Unmarshal(raw, &venues); err != nil {
		return nil, fmt.Errorf("parse venue catalog %s: %w", path, err)
	}
	if len(venues) == 0 {
		return nil, fmt.Errorf("venue catalog %s is empty", path)
	}
	seen := make(map[string]bool, len(venues))
	for i, venue := range venues {
		if venue.ID == "" || venue.Name == "" || venue.Type == "" {
			return nil, fmt.Errorf("venue catalog %s: entry %d is missing an id, name or type", path, i)
		}
		if seen[venue.ID] {
			return nil, fmt.Errorf("venue catalog %s: duplicate id %q", path, venue.ID)
		}
		seen[venue.ID] = true
	}
	return venues, nil
}

// CuratedMaxLeverage is the fallback leverage by venue id, for the store.
func CuratedMaxLeverage(venues []Venue) map[string]float64 {
	curated := map[string]float64{}
	for _, venue := range venues {
		if venue.MaxLeverage != nil {
			curated[venue.ID] = *venue.MaxLeverage
		}
	}
	return curated
}
