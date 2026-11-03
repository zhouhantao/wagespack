import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://127.0.0.1:4175', channel: 'msedge' },
  webServer: {
    command: process.env.WAGESPARK_PREVIEW
      ? 'npm exec -- vite preview --host 127.0.0.1 --port 4175 --strictPort'
      : 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175'
  }
});
