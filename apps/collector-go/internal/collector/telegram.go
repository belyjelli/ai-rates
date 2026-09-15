package collector

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// telegramAPI is Telegram's Bot API root; a variable only so tests can point it at a local server.
const telegramAPI = "https://api.telegram.org"

// telegramMaxText is under Telegram's 4,096-character message limit, leaving room for the ellipsis.
const telegramMaxText = 4000

// TelegramSink sends each alert's text to one Telegram chat through a bot.
//
// The bot token is a credential, and it sits in the request URL — so it must never reach a log line.
// net/http puts the full URL in transport errors ("Post \"https://api.telegram.org/bot<token>/...\""),
// which is exactly where a failed alert gets logged. Every error returned here is scrubbed of it.
func TelegramSink(token, chatID string, client *http.Client) AlertSink {
	return telegramSink(telegramAPI, token, chatID, client)
}

func telegramSink(apiRoot, token, chatID string, client *http.Client) AlertSink {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	endpoint := apiRoot + "/bot" + token + "/sendMessage"
	redact := func(message string) string { return strings.ReplaceAll(message, token, "<redacted>") }

	return func(ctx context.Context, payload AlertPayload) error {
		text := payload.Text
		if len([]rune(text)) > telegramMaxText {
			text = string([]rune(text)[:telegramMaxText]) + "…"
		}
		body, err := json.Marshal(map[string]any{
			"chat_id":                  chatID,
			"text":                     text,
			"disable_web_page_preview": true,
		})
		if err != nil {
			return fmt.Errorf("encode telegram alert: %w", err)
		}
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
		if err != nil {
			return errors.New(redact("build telegram request: " + err.Error()))
		}
		request.Header.Set("content-type", "application/json")
		response, err := client.Do(request)
		if err != nil {
			return errors.New(redact("post telegram alert: " + err.Error()))
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			// Telegram explains a refusal in `description` ("chat not found", "bot was blocked").
			detail, _ := io.ReadAll(io.LimitReader(response.Body, 300))
			return errors.New(redact(fmt.Sprintf("telegram returned HTTP %d: %s", response.StatusCode, detail)))
		}
		return nil
	}
}

// FanOut delivers each payload to every sink, so one broken channel cannot silence the others. The
// errors of any that failed are joined.
func FanOut(sinks ...AlertSink) AlertSink {
	return func(ctx context.Context, payload AlertPayload) error {
		var errs []error
		for _, sink := range sinks {
			if err := sink(ctx, payload); err != nil {
				errs = append(errs, err)
			}
		}
		return errors.Join(errs...)
	}
}
