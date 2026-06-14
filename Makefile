.PHONY: help build-image up down rebuild logs ps shell

help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build-image   Build the Docker image using docker compose"
	@echo "  up            Build (if needed) and start containers in background"
	@echo "  down          Stop and remove containers"
	@echo "  rebuild       Rebuild image and restart containers"
	@echo "  logs          Follow logs for all services"
	@echo "  ps            Show compose ps"
	@echo "  shell         Run a shell in the web service container"

build-image:
	docker compose build --no-cache

up: build-image
	docker compose up -d

down:
	docker compose down

rebuild:
	docker compose down
	docker compose build --no-cache
	docker compose up -d

logs:
	docker compose logs -f

ps:
	docker compose ps

shell:
	docker compose run --rm web sh
