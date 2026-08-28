process.stdout.write('authorization-url:https://example.test/auth\n');
process.stdout.write('paste-response:');

process.stdin.setEncoding('utf8');
process.stdin.once('data', (input) => {
  process.stdout.write(`oauth-token:test-${input.trim()}\n`);
  process.exit(0);
});
