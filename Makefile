.PHONY: init build up down logs

init:
	@cp -n .env.example .env || true
	docker compose up --build -d
	@echo ""
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:8000/api/health"

build:
	docker compose build

up:
	docker compose up -d
	@echo ""
	@echo "Frontend: http://localhost:3000"
	@echo "Backend:  http://localhost:8000/api/health"

down:
	docker compose down

logs:
	docker compose logs -f