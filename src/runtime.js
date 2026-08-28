const { spawn } = require('node:child_process');
const path = require('node:path');

const redis = require('./redis');

let active = false;

function decodeInput(message) {
  try {
    const value = JSON.parse(message);
    if (value && typeof value.input === 'string') {
      return value.input;
    }
  } catch {
    // Raw redis-cli PUBLISH payloads are valid input.
  }
  return message;
}

function commandSpec() {
  if (process.env.CLAUDE_COMMAND) {
    const args = process.env.CLAUDE_ARGS_JSON
      ? JSON.parse(process.env.CLAUDE_ARGS_JSON)
      : [];
    return { command: process.env.CLAUDE_COMMAND, args };
  }

  return {
    command: path.join(process.cwd(), 'node_modules', '.bin', 'claude'),
    args: ['setup-token']
  };
}

async function run(requestSignal) {
  if (active) {
    const error = new Error('token flow already active');
    error.code = 'FLOW_ACTIVE';
    throw error;
  }

  await redis.ready;
  active = true;

  const { command, args } = commandSpec();
  const child = spawn(command, args, {
    cwd: '/tmp',
    env: {
      ...process.env,
      TERM: process.env.TERM || 'xterm-256color'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  const publishChunk = (stream) => (chunk) => {
    void redis.publish({
      type: 'output',
      stream,
      data: chunk.toString('utf8')
    });
  };

  child.stdout.on('data', publishChunk('stdout'));
  child.stderr.on('data', publishChunk('stderr'));

  const clearInput = redis.setInputHandler((message) => {
    if (!child.stdin.destroyed) {
      child.stdin.write(`${decodeInput(message)}\n`);
    }
  });

  await redis.publish({
    type: 'started',
    inputChannel: redis.inputChannel,
    outputChannel: redis.outputChannel
  });

  const abort = () => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  };

  if (requestSignal) {
    if (requestSignal.aborted) {
      abort();
    } else {
      requestSignal.addEventListener('abort', abort, { once: true });
    }
  }

  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });

    await redis.publish({ type: 'exit', ...result });
    return result;
  } finally {
    clearInput();
    active = false;
    if (requestSignal) {
      requestSignal.removeEventListener('abort', abort);
    }
  }
}

module.exports = { run };
