FROM --platform=linux/amd64 node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g @anthropic-ai/claude-code

ENV TERM=xterm-256color

ENTRYPOINT ["claude"]
CMD ["setup-token"]
