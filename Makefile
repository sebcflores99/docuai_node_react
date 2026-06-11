.PHONY: help init build up down ps

help:
	@echo "DocuAI — Local Docker Commands"
	@echo "==============================="
	@echo ""
	@echo "First time:  make init   (build + start, then open http://localhost:3000)"
	@echo ""
	@echo "Targets:"
	@echo "  init    Build images and start the stack (first run)"
	@echo "  build   Build Docker images"
	@echo "  up      Start the stack in the background"
	@echo "  down    Stop and remove containers"
	@echo "  ps      Show running containers"

# Auto-create a demo .env (mock providers, no API keys; random JWT secret)
# so the stack runs fully offline. Used by init/build/up.
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

init: .env
	docker compose up --build -d
	@echo ""
	@echo "DocuAI is starting. Once healthy:"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:8000/api/health"
	@echo "  Weaviate:  http://localhost:8080/v1/.well-known/ready"

build: .env
	docker compose build

up: .env
	docker compose up -d
	@echo ""
	@echo "DocuAI is starting. Once healthy:"
	@echo "  Frontend:  http://localhost:3000"
	@echo "  Backend:   http://localhost:8000/api/health"
	@echo "  Weaviate:  http://localhost:8080/v1/.well-known/ready"

down:
	docker compose down

ps:
	docker compose ps
