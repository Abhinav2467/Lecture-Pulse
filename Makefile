# Lecture Pulse
#   make            install (if needed) and run server + client in dev mode
#   make prod       install, build the client and run the production server
#   make help       list all targets

.DEFAULT_GOAL := run
.PHONY: run dev prod build start test simulate install clean reset help

STUDENTS ?= 30
MINUTES  ?= 3

# Re-installs only when a package.json changed since the last install.
node_modules/.install-stamp: package.json server/package.json client/package.json
	npm install
	@touch $@

.env:
	cp .env.example .env

install: node_modules/.install-stamp .env ## Install dependencies and create .env if missing

run: dev ## Same as dev (default target)

dev: install ## Run server (:4000) and client (:5173) with reload
	npm run dev

build: install ## Build the client into client/dist
	npm run build

start: ## Run the production server (expects a build)
	npm start

prod: build start ## Build, then run the production server on :4000

test: install ## Run the test suite
	npm test

simulate: install ## Fake students: make simulate CODE=ABC234 [STUDENTS=30] [MINUTES=3]
	@test -n "$(CODE)" || { echo "Usage: make simulate CODE=<session code> [STUDENTS=30] [MINUTES=3]"; exit 1; }
	npm run simulate -- $(CODE) $(STUDENTS) $(MINUTES)

clean: ## Remove build output and installed dependencies
	rm -rf node_modules server/node_modules client/node_modules client/dist

reset: ## Delete the local database (all sessions)
	rm -rf data

help: ## Show this help
	@grep -E '^[a-z]+:.*## ' $(MAKEFILE_LIST) | awk -F ':.*## ' '{printf "  make %-10s %s\n", $$1, $$2}'
