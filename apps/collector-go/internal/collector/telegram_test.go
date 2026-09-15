package collector

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const testToken = "123456:SECRET-token-value"

func TestTelegramSinkPostsToTheBotChat(t *testing.T) {
	var path string
	var body map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path = r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&body)
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer server.Close()

	err := telegramSink(server.URL, testToken, "-1001234", server.Client())(context.Background(),
		AlertPayload{Text: "airates: 1 venue stale (ondo)"})
	if err != nil {
		t.Fatal(err)
	}
	if path != "/bot"+testToken+"/sendMessage" {
		t.Errorf("path = %q", path)
	}
	if body["chat_id"] != "-1001234" || body["text"] != "airates: 1 venue stale (ondo)" {
		t.Errorf("body = %v", body)
	}
}

func TestTelegramSinkNeverLeaksTheTokenInErrors(t *testing.T) {
	// A refusal echoes the path, and a transport error carries the whole URL: both must be scrubbed.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"ok":false,"description":"chat not found ` + r.URL.Path + `"}`))
	}))
	err := telegramSink(server.URL, testToken, "1", server.Client())(context.Background(), AlertPayload{Text: "x"})
	server.Close()
	if err == nil || !strings.Contains(err.Error(), "HTTP 400") || strings.Contains(err.Error(), testToken) {
		t.Fatalf("refusal error = %v; want HTTP 400 without the token", err)
	}

	// The server is closed now, so this is a transport error naming the URL.
	err = telegramSink(server.URL, testToken, "1", server.Client())(context.Background(), AlertPayload{Text: "x"})
	if err == nil || strings.Contains(err.Error(), testToken) {
		t.Fatalf("transport error = %v; want an error without the token", err)
	}
}

func TestTelegramSinkTruncatesLongText(t *testing.T) {
	var body map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&body)
	}))
	defer server.Close()
	long := strings.Repeat("é", telegramMaxText+500)
	if err := telegramSink(server.URL, testToken, "1", server.Client())(context.Background(), AlertPayload{Text: long}); err != nil {
		t.Fatal(err)
	}
	if n := len([]rune(body["text"].(string))); n != telegramMaxText+1 {
		t.Fatalf("sent %d characters, want %d plus an ellipsis", n, telegramMaxText)
	}
}

func TestFanOutDeliversToEverySinkEvenWhenOneFails(t *testing.T) {
	var delivered int
	ok := func(context.Context, AlertPayload) error { delivered++; return nil }
	broken := func(context.Context, AlertPayload) error { return errors.New("webhook down") }

	err := FanOut(broken, ok, ok)(context.Background(), AlertPayload{Text: "x"})
	if delivered != 2 {
		t.Errorf("delivered to %d healthy sinks, want 2", delivered)
	}
	if err == nil || !strings.Contains(err.Error(), "webhook down") {
		t.Errorf("err = %v, want the broken sink's error", err)
	}
}
