export default {
  apps: [
    {
      name: "bot",
      script: "index.js",
      watch: ["src", "config", "index.js", "package.json"],
      ignore_watch: ["database", "assets", "statuses", "plugins", "node_modules"],
      watch_options: {
        followSymlinks: false
      },
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
