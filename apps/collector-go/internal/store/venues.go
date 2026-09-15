package store

import (
	"context"
	"fmt"
)

// VenueRow is one row of the venues table.
type VenueRow struct {
	ID   string
	Name string
	Type string
}

// UpsertVenues writes every catalogued venue, retired ones included.
//
// Every market table references venues(id), so a venue without a row cannot store its first market.
// The Bun collector did this at startup; the Go port did not, which left the table frozen at whatever
// the last Bun boot wrote and would have failed the first market of any venue added after the cutover.
func (s *Store) UpsertVenues(ctx context.Context, venues []VenueRow) error {
	if len(venues) == 0 {
		return nil
	}
	ids := make([]string, len(venues))
	names := make([]string, len(venues))
	types := make([]string, len(venues))
	for i, venue := range venues {
		ids[i], names[i], types[i] = venue.ID, venue.Name, venue.Type
	}
	const sql = `
		INSERT INTO venues (id, name, type)
		SELECT * FROM unnest($1::text[], $2::text[], $3::text[])
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type`
	if _, err := s.pool.Exec(ctx, sql, ids, names, types); err != nil {
		return fmt.Errorf("upsert venues: %w", err)
	}
	return nil
}
