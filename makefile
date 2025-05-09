.PHONY: dev start stop restart redis-cli clean help

# Default environment variables for local development
export REDIS_HOST=localhost
export REDIS_PASSWORD=redis123
export REDIS_URL=redis://:$(REDIS_PASSWORD)@$(REDIS_HOST):6379

# Check if docker-compose or docker compose is available
DOCKER_COMPOSE := $(shell command -v docker-compose 2> /dev/null || echo "docker compose")

help:
	@echo "Available commands:"
	@echo "  make dev         - Start development server with Bun"
	@echo "  make start       - Start Redis container in detached mode"
	@echo "  make stop        - Stop Redis container"
	@echo "  make restart     - Restart Redis container"
	@echo "  make redis-cli   - Open Redis CLI in the container"
	@echo "  make clean       - Remove Redis container and volume"

dev: start
	@echo "Starting development server with Redis at $(REDIS_HOST)"
	@echo "Redis URL: $(REDIS_URL)"
	@bun run dev

start:
	@echo "Starting Redis container..."
	@$(DOCKER_COMPOSE) up -d
	@echo "Redis is running at $(REDIS_HOST):6379"
	@echo "Environment variables to use in your app:"
	@echo "  REDIS_URL=$(REDIS_URL)"
	@echo "  REDIS_HOST=$(REDIS_HOST)"
	@echo "  REDIS_PASSWORD=$(REDIS_PASSWORD)"

stop:
	@echo "Stopping Redis container..."
	@$(DOCKER_COMPOSE) down

restart: stop start

redis-cli:
	@docker exec -it ecommerce_redis redis-cli -a $(REDIS_PASSWORD)

clean:
	@echo "Removing Redis container and volume..."
	@$(DOCKER_COMPOSE) down -v

# Add a .env file for easy usage with Bun
.env:
	@echo "Creating .env file..."
	@echo "REDIS_URL=$(REDIS_URL)" > .env
	@echo "REDIS_HOST=$(REDIS_HOST)" >> .env
	@echo "REDIS_PASSWORD=$(REDIS_PASSWORD)" >> .env
	@echo ".env file created"

setup: start .env
	@echo "Setup complete!"
