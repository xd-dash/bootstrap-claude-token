.DEFAULT_GOAL := run

IMAGE ?= claude-setup-token
ENGINE ?= podman
PLATFORM ?= linux/amd64
CONTAINERFILE ?= Containerfile

.PHONY: build run setup-token version shell clean help

build:
	$(ENGINE) build \
		--platform $(PLATFORM) \
		-t $(IMAGE) \
		-f $(CONTAINERFILE) .

run: build
	$(ENGINE) run --rm -it \
		--platform $(PLATFORM) \
		$(IMAGE)

setup-token: run

version: build
	$(ENGINE) run --rm \
		--platform $(PLATFORM) \
		$(IMAGE) --version

shell: build
	$(ENGINE) run --rm -it \
		--platform $(PLATFORM) \
		--entrypoint /bin/sh \
		$(IMAGE)

clean:
	-$(ENGINE) image rm $(IMAGE)

help:
	@printf '%s\n' \
		'make              Build and run claude setup-token interactively' \
		'make run          Same as default' \
		'make setup-token  Same as run' \
		'make version      Print installed Claude Code version' \
		'make shell        Open a shell in the image' \
		'make clean        Remove the local image' \
		'' \
		'Overrides:' \
		'  ENGINE=podman' \
		'  IMAGE=claude-setup-token' \
		'  PLATFORM=linux/amd64'
