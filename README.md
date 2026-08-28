# bootstrap-claude-token

Redis-mediated Claude Code `setup-token` runner for Google Cloud Functions /
Cloud Run functions using the Node.js Functions Framework.

The service no longer requires its own container lifecycle. Claude Code is an
npm dependency and is launched as a child process owned by the HTTP request.

## Runtime model

```text
client
  |
  | POST /token/run
  v
bootstrap-claude-token
  |
  | spawn claude setup-token
  |
  +---- stdout/stderr ----> Redis output channel ----> logma-serverless ----> SSE
  |
  <---- stdin ------------ Redis input channel <----- redis-cli / control plane
```

The `POST /token/run` request owns the child process for its full lifetime.
The function does not rely on work continuing after the HTTP request returns.

Only one token flow is allowed per function instance at a time.

## Redis configuration

Environment variables:

```text
REDIS_URL=redis://host:6379
CLAUDE_INPUT_CHANNEL=claude-token:input
CLAUDE_OUTPUT_CHANNEL=claude-token:output
```

On process initialization the service creates its Redis clients and subscribes
to the input channel. Handlers wait for that initialization before starting a
token flow.

Messages published to the input channel may be either raw text:

```sh
redis-cli PUBLISH claude-token:input 'authorization-response'
```

or JSON:

```json
{"input":"authorization-response"}
```

Claude stdout/stderr and lifecycle events are published to the output channel
using the envelope expected by `xd-dash/logma-serverless`:

```json
{
  "channel": "claude-token:output",
  "data": {
    "type": "output",
    "stream": "stdout",
    "data": "..."
  }
}
```

That lets Logma expose the flow directly through its existing SSE `/events`
endpoint.

## Local Functions Framework

Start Redis, then:

```sh
npm install

export REDIS_URL=redis://127.0.0.1:6379
export CLAUDE_INPUT_CHANNEL=claude-token:input
export CLAUDE_OUTPUT_CHANNEL=claude-token:output

npm start
```

Inspect the configured channels:

```sh
curl http://127.0.0.1:8080/token/channels
```

Start a token flow:

```sh
curl -X POST http://127.0.0.1:8080/token/run
```

The request remains open until `claude setup-token` exits.

## Google Cloud Functions / Cloud Run functions

The exported HTTP function name is:

```text
bootstrapClaudeToken
```

Use Node.js 22 or newer and configure the Redis environment variables above.
For Gen2, configure an invocation timeout long enough for a human authorization
flow and keep instance request concurrency at 1 if the deployment must enforce
the same single-flow invariant at the platform boundary.

## SSE output with logma-serverless

A Logma deployment can subscribe to the output channel:

```text
/events?channel=claude-token:output
```

The token itself can pass through this channel. Treat Redis and the SSE endpoint
as credential-bearing infrastructure: keep them private/authenticated, do not
persist output, and do not copy SSE payloads into ordinary application logs.

## Integration automation

The `automation` branch contains:

```text
.github/workflows/token-flow-pseudo-dispatch.yml
.github/requests/token-flow.env
```

Updating the request file is the pseudo-dispatch operation.

The integration test:

1. downloads the Redis server from `xd-dash/sus-redis`;
2. starts this service through the Node Functions Framework;
3. starts `xd-dash/logma-serverless` as the SSE bridge;
4. verifies both Redis subscriptions with `redis-cli PUBSUB NUMSUB`;
5. starts the token lifecycle;
6. sends the simulated authorization response with `redis-cli PUBLISH`;
7. verifies the token-shaped output arrived over Logma SSE; and
8. ends the Logma runtime through its Redis `control:shutdown` channel.

The test uses `test/fixtures/fake-claude.js`; CI never performs a real
Anthropic authorization flow or emits a real credential.

## Legacy container path

`Containerfile` and the Makefile are retained as a local fallback for directly
running `claude setup-token` under Podman or Docker. They are no longer the
primary runtime architecture.
