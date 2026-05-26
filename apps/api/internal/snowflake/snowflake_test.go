package snowflake

import (
	"sync"
	"testing"
)

func TestUnique(t *testing.T) {
	g, err := New(1)
	if err != nil {
		t.Fatal(err)
	}
	seen := make(map[int64]struct{}, 100000)
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 10000; j++ {
				id := g.Next()
				mu.Lock()
				if _, dup := seen[id]; dup {
					t.Errorf("duplicate id: %d", id)
				}
				seen[id] = struct{}{}
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if len(seen) != 100000 {
		t.Errorf("expected 100000 unique ids, got %d", len(seen))
	}
}

func TestParse(t *testing.T) {
	g, _ := New(42)
	id := g.Next()
	ts, w, _ := Parse(id)
	if w != 42 {
		t.Errorf("worker mismatch: got %d want 42", w)
	}
	if ts.IsZero() {
		t.Error("timestamp should not be zero")
	}
}

func TestWorkerRange(t *testing.T) {
	if _, err := New(-1); err == nil {
		t.Error("negative worker should error")
	}
	if _, err := New(1024); err == nil {
		t.Error("worker > 1023 should error")
	}
}
