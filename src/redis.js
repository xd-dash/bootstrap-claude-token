const { createClient } = require('redis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const inputChannel = process.env.CLAUDE_INPUT_CHANNEL || 'claude-token:input';
const outputChannel = process.env.CLAUDE_OUTPUT_CHANNEL || 'claude-token:output';

const publisher = createClient({ url: redisUrl });
const subscriber = publisher.duplicate();

let activeInputHandler = null;

for (const client of [publisher, subscriber]) {
  client.on('error', (error) => {
    process.stderr.write(`redis: ${error.message}\n`);
  });
}

const ready = (async () => {
  await publisher.connect();
  await subscriber.connect();
  await subscriber.subscribe(inputChannel, (message) => {
    const handler = activeInputHandler;
    if (handler) {
      handler(message);
    }
  });
})();

function setInputHandler(handler) {
  activeInputHandler = handler;
  return () => {
    if (activeInputHandler === handler) {
      activeInputHandler = null;
    }
  };
}

async function publish(event) {
  await ready;
  await publisher.publish(outputChannel, JSON.stringify({
    channel: outputChannel,
    data: event
  }));
}

module.exports = {
  inputChannel,
  outputChannel,
  publish,
  ready,
  setInputHandler
};
