# Hanzo Cloud Platform Makefile

# Get version from package.json
VERSION := $(shell node -p "require('./package.json').version")
REGISTRY := hanzoai
COMMIT_SHA := $(shell git rev-parse --short HEAD)

# Default target
.PHONY: help
help:
	@echo "Hanzo Cloud Platform Build Tools"
	@echo ""
	@echo "Usage:"
	@echo "  make build-images       Build multi-platform Docker images and push to registry"
	@echo "  make build-local        Build single-platform Docker images for local testing"
	@echo "  make push-images        Push Docker images to registry (redundant with build-images)"
	@echo "  make build-push-images  Build and push Docker images"
	@echo "  make update-compose     Update docker-compose files to use new images"
	@echo "  make deploy             Build, push images and update compose files"
	@echo "  make version            Display current version information"
	@echo ""
	@echo "Current version: $(VERSION) ($(COMMIT_SHA))"

# Build Docker images
.PHONY: build-images
build-images:
	@echo "Building Hanzo Cloud images v$(VERSION) ($(COMMIT_SHA))"
	docker buildx create --name cloud-builder --use --bootstrap || true
	docker buildx build --platform linux/amd64,linux/arm64 \
		-f worker/Dockerfile \
		-t $(REGISTRY)/cloud-worker:$(VERSION) \
		-t $(REGISTRY)/cloud-worker:latest \
		--push .
	docker buildx build --platform linux/amd64,linux/arm64 \
		-f web/Dockerfile \
		-t $(REGISTRY)/cloud-web:$(VERSION) \
		-t $(REGISTRY)/cloud-web:latest \
		--push .
	@echo "Successfully built images:"
	@echo "  - $(REGISTRY)/cloud-worker:$(VERSION) (multi-platform)"
	@echo "  - $(REGISTRY)/cloud-web:$(VERSION) (multi-platform)"

# Push Docker images (now handled by buildx with --push flag)
.PHONY: push-images
push-images:
	@echo "Images v$(VERSION) already pushed during build with buildx"
	@echo "If you need to push again, run build-images"

# Build local images for testing (single platform)
.PHONY: build-local
build-local:
	@echo "Building local Hanzo Cloud images v$(VERSION) ($(COMMIT_SHA))"
	docker build -f worker/Dockerfile -t $(REGISTRY)/cloud-worker:local .
	docker build -f web/Dockerfile -t $(REGISTRY)/cloud-web:local .
	@echo "Successfully built local images:"
	@echo "  - $(REGISTRY)/cloud-worker:local"
	@echo "  - $(REGISTRY)/cloud-web:local"

# Build and push images
.PHONY: build-push-images
build-push-images: build-images

# Update docker-compose files
.PHONY: update-compose
update-compose:
	@echo "Updating docker-compose files to use version $(VERSION)"
	@for file in docker-compose.yml docker-compose.dev.yml docker-compose.prod.yml docker-compose.build.yml docker-compose.dev-azure.yml; do \
		if [ -f "$$file" ]; then \
			echo "Updating $$file..."; \
			sed -i.bak -E "s|image: .*ai-platform-worker:.*|image: $(REGISTRY)/cloud-worker:$(VERSION)|g" "$$file"; \
			if grep -q "image: .*ai-platform" "$$file"; then \
				sed -i.bak -E "s|image: .*ai-platform(-web)?:.*|image: $(REGISTRY)/cloud-web:$(VERSION)|g" "$$file"; \
			fi; \
			rm -f "$$file.bak"; \
			echo "Successfully updated $$file"; \
		else \
			echo "File $$file not found, skipping"; \
		fi; \
	done
	@echo "All docker-compose files updated successfully!"

# Full deployment process
.PHONY: deploy
deploy: build-push-images update-compose
	@echo "Deployment completed successfully!"

# Display version information
.PHONY: version
version:
	@echo "Hanzo Cloud Platform"
	@echo "Version: $(VERSION)"
	@echo "Commit: $(COMMIT_SHA)"
	@echo "Registry: $(REGISTRY)"
