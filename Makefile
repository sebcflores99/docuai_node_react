.PHONY: help up down logs build rebuild restart clean stop ps shell-backend shell-postgres

help:
	@echo "DocuAI Docker Compose Commands"
	@echo "=============================="
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  up              Start services in foreground (Ctrl+C to stop)"
	@echo "  down            Stop and remove containers"
	@echo "  up-d            Start services in background (detached)"
	@echo "  logs            View logs from all services (follow mode)"
	@echo "  logs-[service]  View logs from specific service (e.g., logs-backend)"
	@echo "  build           Build Docker images"
	@echo "  rebuild         Rebuild Docker images (no cache)"
	@echo "  restart         Restart all services"
	@echo "  stop            Stop services without removing containers"
	@echo "  ps              Show running containers"
	@echo "  clean           Stop services and remove volumes (WARNING: data loss)"
	@echo "  shell-backend   Open shell in backend container"
	@echo "  shell-postgres  Open psql shell in postgres container"

up:
	docker-compose up

up-d:
	docker-compose up -d
	@echo "Services started in background. Use 'make logs' to view logs."

down:
	docker-compose down

stop:
	docker-compose stop

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

build:
	docker-compose build

rebuild:
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
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		echo "Cleaned up."; \
	else \
		echo "Cancelled."; \
	fi
