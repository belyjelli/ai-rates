package collector

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"
)

// AlertPayload is one message about collection health.
type AlertPayload struct {
	Text  string   `json:"text"`
	OK    bool     `json:"ok"`
	Stale []string `json:"stale"`
}

// AlertSink delivers a payload somewhere a person will see it.
type AlertSink func(ctx context.Context, payload AlertPayload) error

// StaleVenueAlerter reports venues that stop collecting, and their recovery, over a sink.
//
// Ported from apps/collector/src/alerts.ts. Only transitions are sent: a message when venues newly go
// stale, and one when everything is healthy again. A venue recovering while others are still stale
// stays quiet, so a partial outage produces a couple of messages rather than one a minute until
// someone looks.
//
// Not safe for concurrent use; it runs inside one PeriodicTask.
type StaleVenueAlerter struct {
	send  AlertSink
	log   func(string)
	stale []string
}

func NewStaleVenueAlerter(send AlertSink, log func(string)) *StaleVenueAlerter {
	return &StaleVenueAlerter{send: send, log: log}
}

// Check compares the fleet with the last check and reports any transition.
func (a *StaleVenueAlerter) Check(ctx context.Context, snapshot Snapshot) error {
	stale := []string{}
	var errors []string
	for _, venue := range snapshot.Venues {
		if !venue.Stale {
			continue
		}
		stale = append(stale, venue.VenueID)
	}
	sort.Strings(stale)
	for _, venue := range snapshot.Venues {
		if venue.Stale && venue.Error != nil && *venue.Error != "" {
			errors = append(errors, fmt.Sprintf("%s: %s", venue.VenueID, *venue.Error))
		}
	}

	previous := a.stale
	newlyStale := false
	for _, id := range stale {
		if !contains(previous, id) {
			newlyStale = true
			break
		}
	}
	recovered := len(previous) > 0 && len(stale) == 0
	a.stale = stale

	if newlyStale {
		plural := "s"
		if len(stale) == 1 {
			plural = ""
		}
		text := fmt.Sprintf("airates: %d venue%s stale (%s)", len(stale), plural, strings.Join(stale, ", "))
		if len(errors) > 0 {
			text += "\nlast errors -- " + strings.Join(errors, "; ")
		}
		return a.report(ctx, AlertPayload{Text: text, OK: false, Stale: stale})
	}
	if recovered {
		return a.report(ctx, AlertPayload{
			Text:  fmt.Sprintf("airates: all venues collecting again (was %s)", strings.Join(previous, ", ")),
			OK:    true,
			Stale: []string{},
		})
	}
	return nil
}

func (a *StaleVenueAlerter) report(ctx context.Context, payload AlertPayload) error {
	if a.log != nil {
		a.log(payload.Text)
	}
	return a.send(ctx, payload)
}

func contains(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}

// WebhookSink posts to a Slack- or Discord-style incoming webhook. Both field names carry the text:
// Slack reads `text`, Discord reads `content`.
func WebhookSink(url string, client *http.Client) AlertSink {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return func(ctx context.Context, payload AlertPayload) error {
		body, err := json.Marshal(struct {
			AlertPayload
			Content string `json:"content"`
		}{payload, payload.Text})
		if err != nil {
			return fmt.Errorf("encode alert: %w", err)
		}
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
		if err != nil {
			return fmt.Errorf("build alert request: %w", err)
		}
		request.Header.Set("content-type", "application/json")
		response, err := client.Do(request)
		if err != nil {
			return fmt.Errorf("post alert: %w", err)
		}
		defer response.Body.Close()
		if response.StatusCode < 200 || response.StatusCode > 299 {
			return fmt.Errorf("webhook returned HTTP %d", response.StatusCode)
		}
		return nil
	}
}
