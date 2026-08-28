# bootstrap-claude-token

Minimal x86-64 Linux container for running Claude Code's interactive
`setup-token` flow with Podman.

## Requirements

- x86-64 Linux
- Podman
- GNU Make
- an interactive terminal

## Run

```sh
make
```

This builds the image and starts:

```text
claude setup-token
```

interactively. In a headless environment, copy the authorization URL printed by
Claude Code into a browser, complete the authorization flow, then paste the
requested response back into the terminal.

The resulting OAuth token is printed to the terminal. Treat it as a reusable
credential. Do not commit it, pipe it into logs, or upload it as an artifact.

To use it with `anthropics/claude-code-action`, store the value in GitHub as:

```text
CLAUDE_CODE_OAUTH_TOKEN
```

## Other targets

```sh
make version
make shell
make clean
make help
```

The defaults are:

```text
ENGINE=podman
IMAGE=claude-setup-token
PLATFORM=linux/amd64
```

They can be overridden, for example:

```sh
make ENGINE=docker
```
