const functions = require('@google-cloud/functions-framework');
const {
  NewEmptyRouter,
  SimpleRouterBuilder
} = require('simple-router-builder');

const redis = require('./redis');
const runtime = require('./runtime');

const tokenRouter = NewEmptyRouter();

tokenRouter.get('/channels', async (_req, res, next) => {
  try {
    await redis.ready;
    res.status(200).json({
      input: redis.inputChannel,
      output: redis.outputChannel
    });
  } catch (error) {
    next(error);
  }
});

tokenRouter.post('/run', async (req, res, next) => {
  try {
    const abortController = new AbortController();
    req.once('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
    });

    const result = await runtime.run(abortController.signal);
    res.status(result.code === 0 ? 200 : 500).json(result);
  } catch (error) {
    if (error.code === 'FLOW_ACTIVE') {
      res.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
});

const handler = new SimpleRouterBuilder()
  .withChildRouter('/token', tokenRouter)
  .withRootHandler('200')
  .build();

functions.http('bootstrapClaudeToken', handler);

module.exports = { bootstrapClaudeToken: handler };
