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
	@echo "  make build-images       Build Docker images locally"
	@echo "  make push-images        Push Docker images to registry"
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
	docker build -f worker/Dockerfile -t $(REGISTRY)/cloud-worker:$(VERSION) -t $(REGISTRY)/cloud-worker:latest .
	docker build -f web/Dockerfile -t $(REGISTRY)/cloud-web:$(VERSION) -t $(REGISTRY)/cloud-web:latest .
	@echo "Successfully built images:"
	@echo "  - $(REGISTRY)/cloud-worker:$(VERSION)"
	@echo "  - $(REGISTRY)/cloud-web:$(VERSION)"

# Push Docker images
.PHONY: push-images
push-images:
	@echo "Pushing Hanzo Cloud images v$(VERSION)"
	docker push $(REGISTRY)/cloud-worker:$(VERSION)
	docker push $(REGISTRY)/cloud-worker:latest
	docker push $(REGISTRY)/cloud-web:$(VERSION)
	docker push $(REGISTRY)/cloud-web:latest
	@echo "Successfully pushed all images"

# Build and push images
.PHONY: build-push-images
build-push-images: build-images push-images

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
