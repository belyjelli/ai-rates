package store

import (
	"context"
	"testing"
)

func TestUpsertVenuesInsertsNewAndRenamesExisting(t *testing.T) {
	store := freshStore(t)
	ctx := context.Background()

	// freshStore seeds bybit and okx; rename one, add one.
	err := store.UpsertVenues(ctx, []VenueRow{
		{ID: "bybit", Name: "Bybit Renamed", Type: "cex"},
		{ID: "ethereal", Name: "Ethereal", Type: "dex"},
	})
	if err != nil {
		t.Fatal(err)
	}

	rows, err := store.pool.Query(ctx, `SELECT id, name, type FROM venues ORDER BY id`)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	got := map[string]VenueRow{}
	for rows.Next() {
		var row VenueRow
		if err := rows.Scan(&row.ID, &row.Name, &row.Type); err != nil {
			t.Fatal(err)
		}
		got[row.ID] = row
	}
	if got["bybit"].Name != "Bybit Renamed" {
		t.Errorf("bybit name = %q, want the upsert to rename it", got["bybit"].Name)
	}
	if got["ethereal"].Type != "dex" {
		t.Errorf("ethereal = %+v, want it inserted", got["ethereal"])
	}
	if got["okx"].Name != "OKX" {
		t.Errorf("okx = %+v, want a venue absent from the call left untouched", got["okx"])
	}
}
