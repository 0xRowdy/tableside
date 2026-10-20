// Root preinstall guard: installs run with pnpm only. npm is stopped earlier,
// before it installs anything, by `engines.npm` and `engine-strict` in .npmrc;
// this catches Bun and anything else that runs install scripts.
const agent = process.env.npm_config_user_agent ?? '';
if (!agent.startsWith('pnpm/')) {
  console.error(`\nThis repo installs with pnpm (got ${agent.split(' ')[0] || 'an unknown client'}). Run \`corepack enable\`, then \`pnpm install\` from the repo root.\n`);
  process.exit(1);
}
