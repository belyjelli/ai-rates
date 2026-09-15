package collector

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

// Ported case for case from apps/collector/src/alerts.test.ts.

func alertVenue(id string, stale bool, errText string) VenueHealth {
	health := VenueHealth{VenueID: id, Stale: stale}
	if errText != "" {
		health.Error = &errText
	}
	return health
}

func alertFleet(venues ...VenueHealth) Snapshot { return Snapshot{Venues: venues} }

func newAlerter() (*StaleVenueAlerter, *[]AlertPayload) {
	sent := &[]AlertPayload{}
	return NewStaleVenueAlerter(func(_ context.Context, p AlertPayload) error {
		*sent = append(*sent, p)
		return nil
	}, nil), sent
}

func TestAlerterStaysQuietWhileEveryVenueCollects(t *testing.T) {
	a, sent := newAlerter()
	ctx := context.Background()
	for i := 0; i < 2; i++ {
		_ = a.Check(ctx, alertFleet(alertVenue("bybit", false, ""), alertVenue("okx", false, "")))
	}
	if len(*sent) != 0 {
		t.Fatalf("sent %v, want nothing", *sent)
	}
}

func TestAlerterReportsNewlyStaleOnce(t *testing.T) {
	a, sent := newAlerter()
	ctx := context.Background()
	fleet := alertFleet(alertVenue("bybit", true, "HTTP 429"), alertVenue("okx", false, ""))
	_ = a.Check(ctx, fleet)
	_ = a.Check(ctx, fleet)

	if len(*sent) != 1 {
		t.Fatalf("sent %d, want 1", len(*sent))
	}
	got := (*sent)[0]
	if got.OK || !reflect.DeepEqual(got.Stale, []string{"bybit"}) {
		t.Errorf("payload = %+v", got)
	}
	for _, want := range []string{"1 venue stale (bybit)", "bybit: HTTP 429"} {
		if !strings.Contains(got.Text, want) {
			t.Errorf("text %q missing %q", got.Text, want)
		}
	}
}

func TestAlerterReportsAgainWhenAFurtherVenueGoesStale(t *testing.T) {
	a, sent := newAlerter()
	ctx := context.Background()
	_ = a.Check(ctx, alertFleet(alertVenue("bybit", true, ""), alertVenue("okx", false, "")))
	_ = a.Check(ctx, alertFleet(alertVenue("bybit", true, ""), alertVenue("okx", true, "")))

	if len(*sent) != 2 {
		t.Fatalf("sent %d, want 2", len(*sent))
	}
	if got := (*sent)[1]; !reflect.DeepEqual(got.Stale, []string{"bybit", "okx"}) || !strings.Contains(got.Text, "2 venues stale") {
		t.Errorf("second payload = %+v", got)
	}
}

func TestAlerterPartialRecoveryQuietFullRecoveryOnce(t *testing.T) {
	a, sent := newAlerter()
	ctx := context.Background()
	_ = a.Check(ctx, alertFleet(alertVenue("bybit", true, ""), alertVenue("okx", true, "")))
	_ = a.Check(ctx, alertFleet(alertVenue("bybit", true, ""), alertVenue("okx", false, "")))
	if len(*sent) != 1 {
		t.Fatalf("after partial recovery sent %d, want 1", len(*sent))
	}

	_ = a.Check(ctx, alertFleet(alertVenue("bybit", false, ""), alertVenue("okx", false, "")))
	if len(*sent) != 2 || !(*sent)[1].OK || !strings.Contains((*sent)[1].Text, "all venues collecting again") {
		t.Fatalf("after full recovery sent %+v", *sent)
	}

	_ = a.Check(ctx, alertFleet(alertVenue("bybit", false, ""), alertVenue("okx", false, "")))
	if len(*sent) != 2 {
		t.Fatalf("a healthy check after recovery sent again: %+v", *sent)
	}
}

func TestAlerterReportsAVenueGoingStaleAgainAfterRecovering(t *testing.T) {
	a, sent := newAlerter()
	ctx := context.Background()
	_ = a.Check(ctx, alertFleet(alertVenue("bybit", true, "")))
	_ = a.Check(ctx, alertFleet(alertVenue("bybit", false, "")))
	_ = a.Check(ctx, alertFleet(alertVenue("bybit", true, "")))

	var oks []bool
	for _, p := range *sent {
		oks = append(oks, p.OK)
	}
	if want := []bool{false, true, false}; !reflect.DeepEqual(oks, want) {
		t.Fatalf("ok sequence = %v, want %v", oks, want)
	}
}

func TestWebhookSinkPostsUnderSlackAndDiscordFieldNames(t *testing.T) {
	var body map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&body)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	err := WebhookSink(server.URL, server.Client())(context.Background(),
		AlertPayload{Text: "airates: 1 venue stale (bybit)", OK: false, Stale: []string{"bybit"}})
	if err != nil {
		t.Fatal(err)
	}
	if body["text"] != "airates: 1 venue stale (bybit)" || body["content"] != body["text"] || body["ok"] != false {
		t.Fatalf("body = %v", body)
	}
	if stale, _ := body["stale"].([]any); len(stale) != 1 || stale[0] != "bybit" {
		t.Fatalf("stale = %v", body["stale"])
	}
}

func TestWebhookSinkErrorsWhenTheWebhookRejects(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	err := WebhookSink(server.URL, server.Client())(context.Background(), AlertPayload{Text: "x"})
	if err == nil || !strings.Contains(err.Error(), "HTTP 500") {
		t.Fatalf("err = %v, want HTTP 500", err)
	}
}
