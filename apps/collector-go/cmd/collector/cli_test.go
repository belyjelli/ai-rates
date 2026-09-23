package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/belyjelli/ai-rates/collector/internal/collector"
)

// cli runs the command line in-process and returns its exit code and output.
func cli(t *testing.T, args ...string) (int, string, string) {
	t.Helper()
	var stdout, stderr bytes.Buffer
	code := execute(args, &stdout, &stderr)
	return code, stdout.String(), stderr.String()
}

// TestEveryJobHasAShortNameTheCLIAccepts pins jobKeys to registerJobs. A job added to the scheduler
// without a key would be listed with a blank name and could not be run by hand.
func TestEveryJobHasAShortNameTheCLIAccepts(t *testing.T) {
	jobs := collectJobs(config{interval: time.Minute}, nil, nil)
	if len(jobs) != len(jobWatchNames) {
		t.Fatalf("registerJobs declared %d jobs, jobWatchNames names %d", len(jobs), len(jobWatchNames))
	}
	seen := map[string]bool{}
	for _, job := range jobs {
		if job.key == "" {
			t.Errorf("job %q has no key in jobKeys", job.name)
		}
		if seen[job.key] {
			t.Errorf("key %q is used twice", job.key)
		}
		seen[job.key] = true
	}
}

// TestCommandsThatNeedNoDatabaseRunWithoutOne: venues, jobs list and version are for looking around,
// and must work with no DATABASE_URL at all.
func TestCommandsThatNeedNoDatabaseRunWithoutOne(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	for _, args := range [][]string{{"venues"}, {"jobs", "list"}, {"version"}} {
		code, out, errOut := cli(t, args...)
		if code != 0 {
			t.Errorf("%v exited %d: %s", args, code, errOut)
		}
		if out == "" {
			t.Errorf("%v printed nothing", args)
		}
	}
	_, out, _ := cli(t, "jobs", "list")
	for _, key := range []string{"stats", "windows", "backtests", "prices", "identity", "ranked"} {
		if !strings.Contains(out, key) {
			t.Errorf("jobs list is missing %q:\n%s", key, out)
		}
	}
}

// TestCommandsThatNeedTheDatabaseSayWhy: the check moved out of loadConfig, so each command that
// connects must still refuse clearly rather than fail on an empty connection string.
func TestCommandsThatNeedTheDatabaseSayWhy(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	for _, args := range [][]string{{"migrate"}, {"migrate", "--status"}, {"jobs", "run", "stats"}, {"run"}} {
		code, _, errOut := cli(t, args...)
		if code != 1 || !strings.Contains(errOut, "DATABASE_URL is required") {
			t.Errorf("%v: exit %d, stderr %q", args, code, errOut)
		}
	}
}

func TestTyposFailBeforeAnythingIsTouched(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	// An unknown job is rejected before connecting: it names the job, not the missing database.
	code, _, errOut := cli(t, "jobs", "run", "stat")
	if code != 1 || !strings.Contains(errOut, `unknown job "stat"`) {
		t.Errorf("jobs run stat: exit %d, stderr %q", code, errOut)
	}
	code, _, errOut = cli(t, "fetch", "bybitt")
	if code != 1 || !strings.Contains(errOut, `no adapter for "bybitt"`) {
		t.Errorf("fetch bybitt: exit %d, stderr %q", code, errOut)
	}
	if code, _, _ := cli(t, "no-such-command"); code != 1 {
		t.Errorf("an unknown command exited %d", code)
	}
}

// TestHealthExitsNonZeroWhenTheCollectorIsUnhealthy is what makes it usable as a check.
func TestHealthExitsNonZeroWhenTheCollectorIsUnhealthy(t *testing.T) {
	failure := "bingx: circuit open"
	last := time.Now().Add(-25 * time.Minute)
	serve := func(snapshot collector.Snapshot) string {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			_ = json.NewEncoder(w).Encode(snapshot)
		}))
		t.Cleanup(server.Close)
		return server.URL + "/health"
	}

	healthy := serve(collector.Snapshot{OK: true, Venues: []collector.VenueHealth{{VenueID: "bybit", Markets: 845, LastSuccessAt: &last}}})
	code, out, _ := cli(t, "health", "--url", healthy)
	if code != 0 || !strings.HasPrefix(out, "OK: 1 feeds") {
		t.Errorf("healthy: exit %d, output %q", code, out)
	}

	unhealthy := serve(collector.Snapshot{OK: false, Venues: []collector.VenueHealth{
		{VenueID: "aevo", Markets: 102, LastSuccessAt: &last},
		{VenueID: "bingx", Markets: 1035, LastSuccessAt: &last, Error: &failure},
	}})
	code, out, errOut := cli(t, "health", "--url", unhealthy)
	if code != 1 {
		t.Errorf("unhealthy exited %d", code)
	}
	// The verdict is on stdout, and cobra must not repeat it as an "Error:" line.
	if errOut != "" {
		t.Errorf("unhealthy wrote to stderr: %q", errOut)
	}
	// Problems first: the failing feed leads the table, ahead of an alphabetically earlier healthy one.
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) < 3 || !strings.HasPrefix(lines[0], "UNHEALTHY: 2 feeds, 1 failing") || !strings.HasPrefix(lines[2], "bingx") {
		t.Errorf("unhealthy output:\n%s", out)
	}
}
