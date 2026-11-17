// docs/development.md Toolchain
const agent = process.env.npm_config_user_agent ?? '';
if (!agent.startsWith('pnpm/')) {
  console.error(`\nThis repo installs with pnpm (got ${agent.split(' ')[0] || 'an unknown client'}). Run \`corepack enable\`, then \`pnpm install\` from the repo root.\n`);
  process.exit(1);
}
