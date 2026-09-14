.PHONY: test vet build

# Mirrors profitlock-worker's Makefile so the two Go trees are driven the same way.
vet:
	go vet ./...

test: vet
	go test -race ./...

# Allocation behaviour is the reason this collector exists, so the benchmark target is first-class
# rather than something to remember: `make bench` reports ns/op and B/op for the parse hot path.
bench:
	go test -run '^$$' -bench . -benchmem ./...

build:
	go build -o bin/ ./cmd/...
