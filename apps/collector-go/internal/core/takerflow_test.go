package core

import "testing"

func TestTakerFlowBucketStartFloorsToTheFiveMinuteGrid(t *testing.T) {
	for _, c := range []struct{ in, want int64 }{
		{1789659600000, 1789659600000}, // on the grid
		{1789659690000, 1789659600000}, // 90 seconds in
		{1789659899999, 1789659600000}, // the last millisecond of the bucket
		{-1, -300_000},                 // floors, not truncates, below zero
	} {
		if got := TakerFlowBucketStart(c.in); got != c.want {
			t.Errorf("TakerFlowBucketStart(%d) = %d, want %d", c.in, got, c.want)
		}
	}
}
