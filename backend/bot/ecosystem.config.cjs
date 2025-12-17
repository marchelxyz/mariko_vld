module.exports = {
  apps: [
    {
      name: 'hachapuri-mariko-bot',
      script: 'main-bot.cjs',
      cwd: __dirname,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    },
  ],
};
