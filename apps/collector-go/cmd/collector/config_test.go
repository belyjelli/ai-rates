package main

import (
	"os"
	"strings"
	"testing"

	"github.com/belyjelli/ai-rates/collector/internal/catalog"
)

func envOf(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestConfigDefaultsTheRepositoryFilesToTheirImagePaths(t *testing.T) {
	cfg, err := loadConfig(envOf(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.migrationsDir != defaultMigrationsDir || cfg.venueCatalog != defaultVenueCatalog {
		t.Errorf("paths = %q, %q; want the Dockerfile's defaults", cfg.migrationsDir, cfg.venueCatalog)
	}
	if cfg.alertWebhookURL != "" {
		t.Errorf("alerts should be off without ALERT_WEBHOOK_URL, got %q", cfg.alertWebhookURL)
	}
}

func TestConfigRejectsANonHTTPWebhook(t *testing.T) {
	_, err := loadConfig(envOf(map[string]string{"DATABASE_URL": "postgres://x", "ALERT_WEBHOOK_URL": "hooks.slack.com/abc"}))
	if err == nil || !strings.Contains(err.Error(), "ALERT_WEBHOOK_URL") {
		t.Fatalf("err = %v, want ALERT_WEBHOOK_URL rejected", err)
	}
	cfg, err := loadConfig(envOf(map[string]string{"DATABASE_URL": "postgres://x", "ALERT_WEBHOOK_URL": " https://hooks.example/abc "}))
	if err != nil || cfg.alertWebhookURL != "https://hooks.example/abc" {
		t.Fatalf("cfg = %q, err = %v; want the trimmed https URL accepted", cfg.alertWebhookURL, err)
	}
}

func TestConfigRequiresTheTelegramTokenAndChatTogether(t *testing.T) {
	base := map[string]string{"DATABASE_URL": "postgres://x"}
	with := func(extra map[string]string) map[string]string {
		out := map[string]string{}
		for k, v := range base {
			out[k] = v
		}
		for k, v := range extra {
			out[k] = v
		}
		return out
	}

	for name, env := range map[string]map[string]string{
		"token only": with(map[string]string{"TELEGRAM_BOT_TOKEN": "1:abc"}),
		"chat only":  with(map[string]string{"TELEGRAM_CHAT_ID": "42"}),
	} {
		if _, err := loadConfig(envOf(env)); err == nil || !strings.Contains(err.Error(), "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID") {
			t.Errorf("%s: err = %v, want both required together", name, err)
		}
	}

	cfg, err := loadConfig(envOf(with(map[string]string{"TELEGRAM_BOT_TOKEN": " 1:abc ", "TELEGRAM_CHAT_ID": " -100 "})))
	if err != nil || cfg.telegramBotToken != "1:abc" || cfg.telegramChatID != "-100" {
		t.Fatalf("cfg = %+v, err = %v; want both accepted and trimmed", cfg, err)
	}
	if alertSink(cfg) == nil {
		t.Error("Telegram configured but no alert sink built")
	}
	if alertSink(config{}) != nil {
		t.Error("nothing configured but an alert sink was built")
	}
}

// TestEveryRegisteredVenueIsCatalogued pins the foreign key the collector depends on: every market row
// references venues(id), and the venues rows come from catalog.json. A registry id missing from the
// catalog would collect nothing but foreign-key errors; a retired one would be collecting a venue the
// catalog says is dead.
func TestEveryRegisteredVenueIsCatalogued(t *testing.T) {
	const path = "../../../../packages/venues/catalog.json"
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skipf("%s not found; this check needs the whole repository", path)
	}
	venues, err := catalog.Load(path)
	if err != nil {
		t.Fatal(err)
	}
	byID := make(map[string]catalog.Venue, len(venues))
	for _, venue := range venues {
		byID[venue.ID] = venue
	}
	for _, candidate := range registry() {
		venue, ok := byID[candidate.id]
		switch {
		case !ok:
			t.Errorf("%s is registered but not in the catalog: its markets would fail the venues foreign key", candidate.id)
		case venue.Retired != "":
			t.Errorf("%s is registered but retired in the catalog (%s)", candidate.id, venue.Retired)
		}
	}
}

// TestConfigDefaultsLiquidationVenuesToTheProvenSet.
//
// This list DEFAULTS TO NON-EMPTY, unlike STREAM_VENUES, and the difference is deliberate: a
// liquidation feed only ever INSERTs into a table of its own, so it cannot move a number any page
// already shows the way a quote feed overwrites market_latest. The cost of it being on by default is
// a socket; the cost of it being off by default is that nobody turns it on.
func TestConfigDefaultsLiquidationVenuesToTheProvenSet(t *testing.T) {
	cfg, err := loadConfig(envOf(map[string]string{"DATABASE_URL": "postgres://x"}))
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.liquidationVenues) == 0 {
		t.Fatal("liquidation venues should default to the measured set, not to empty")
	}
	for _, want := range []string{"binance", "bybit", "okx", "htx", "dydx", "aster"} {
		if !contains(cfg.liquidationVenues, want) {
			t.Errorf("default set is missing %q, which was proven to publish on 2026-09-18", want)
		}
	}
	// Gate's socket works but gate is ingested over REST, and the two paths would not agree on a
	// primary key — see "WHY GATE IS NOT HERE" in internal/stream/events.go.
	if contains(cfg.liquidationVenues, "gate") {
		t.Error("gate must not stream liquidations while it is also polled over REST")
	}
	// Every default must actually resolve to a protocol, or the boot logs a warning for a venue the
	// operator never asked for.
	for _, venue := range cfg.liquidationVenues {
		if liquidationProtocol(cfg, venue) == nil {
			t.Errorf("default venue %q has no liquidation protocol", venue)
		}
	}
}

func TestConfigLiquidationVenuesCanBeReplacedOrDisabled(t *testing.T) {
	cfg, err := loadConfig(envOf(map[string]string{"DATABASE_URL": "postgres://x", "LIQUIDATION_VENUES": " bybit , okx "}))
	if err != nil {
		t.Fatal(err)
	}
	if len(cfg.liquidationVenues) != 2 || cfg.liquidationVenues[0] != "bybit" || cfg.liquidationVenues[1] != "okx" {
		t.Fatalf("venues = %v, want the named set, trimmed", cfg.liquidationVenues)
	}

	for _, off := range []string{"none", "NONE"} {
		cfg, err := loadConfig(envOf(map[string]string{"DATABASE_URL": "postgres://x", "LIQUIDATION_VENUES": off}))
		if err != nil {
			t.Fatal(err)
		}
		if len(cfg.liquidationVenues) != 0 {
			t.Fatalf("%q should turn the feature off, got %v", off, cfg.liquidationVenues)
		}
	}
}

func contains(haystack []string, needle string) bool {
	for _, item := range haystack {
		if item == needle {
			return true
		}
	}
	return false
}
