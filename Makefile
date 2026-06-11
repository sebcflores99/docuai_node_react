.PHONY: help setup up up-d down logs build rebuild restart clean stop ps urls \
        shell-backend shell-postgres logs-backend logs-postgres logs-weaviate logs-frontend

help:
	@echo "DocuAI — Local Docker Compose Commands"
	@echo "======================================"
	@echo ""
	@echo "Quick start:  make up-d   (then open http://localhost:3000)"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  setup           Create .env for local demo (mock AI, no API keys)"
	@echo "  up              Start services in foreground (Ctrl+C to stop)"
	@echo "  up-d            Start services in background (detached)"
	@echo "  down            Stop and remove containers"
	@echo "  urls            Print the app URLs"
	@echo "  logs            View logs from all services (follow mode)"
	@echo "  logs-[service]  View logs from a service (backend|postgres|weaviate|frontend)"
	@echo "  build           Build Docker images"
	@echo "  rebuild         Rebuild Docker images (no cache)"
	@echo "  restart         Restart all services"
	@echo "  stop            Stop services without removing containers"
	@echo "  ps              Show running containers"
	@echo "  clean           Stop services and remove volumes (WARNING: data loss)"
	@echo "  shell-backend   Open a shell in the backend container"
	@echo "  shell-postgres  Open psql in the postgres container"

# Bootstrap a demo-ready .env. Uses mock LLM + mock embeddings so the whole
# stack runs offline with no API keys. A random JWT secret is generated.
setup: .env
.env:
	@echo "Creating .env for local demo (mock providers, no API keys needed)..."
	@SECRET=$$(openssl rand -hex 32 2>/dev/null || echo "dev-only-change-me"); \
	printf '%s\n' \
	  "# Auto-generated for local demo. Mock providers run fully offline." \
	  "# To use real models, set OPENAI_API_KEY (or ANTHROPIC_API_KEY) and" \
	  "# switch LLM_PROVIDER / EMBEDDING_PROVIDER to openai|anthropic." \
	  "OPENAI_API_KEY=" \
	  "ANTHROPIC_API_KEY=" \
	  "JWT_SECRET=$$SECRET" \
	  "JWT_EXPIRES_IN=7d" \
	  "LLM_PROVIDER=mock" \
	  "EMBEDDING_PROVIDER=mock" \
	  > .env
	@echo ".env created."

up: .env
	docker-compose up

up-d: .env
	docker-compose up -d
	@echo ""
	$(MAKE) urls

down:
	docker-compose down

stop:
	docker-compose stop

urls:
	@echo "DocuAI is starting. Once healthy:"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:8000/api/health"
	@echo "  Weaviate:  http://localhost:8080/v1/.well-known/ready"

logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-postgres:
	docker-compose logs -f postgres

logs-weaviate:
	docker-compose logs -f weaviate

logs-frontend:
	docker-compose logs -f frontend

build: .env
	docker-compose build

rebuild: .env
	docker-compose build --no-cache

restart:
	docker-compose restart

ps:
	docker-compose ps

shell-backend:
	docker-compose exec backend sh

shell-postgres:
	docker-compose exec postgres psql -U postgres -d docuai

clean:
	@echo "WARNING: This will remove all containers and volumes (data loss)!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [ "$$REPLY" = "y" ] || [ "$$REPLY" = "Y" ]; then \
	docker-compose down -v; \
	echo "Cleaned up."; \
	else \
	echo "Cancelled."; \
	fi
