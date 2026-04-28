const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4000/Blog/",
    trace: "on-first-retry"
  },
  webServer: {
    command: "bundle exec jekyll serve --host 127.0.0.1 --port 4000",
    url: "http://127.0.0.1:4000/Blog/",
    reuseExistingServer: true,
    timeout: 120000
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] }
    }
  ]
});
