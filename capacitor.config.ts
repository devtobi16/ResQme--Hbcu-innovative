import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.resqme',
  appName: 'ResQMe Safety App',
  webDir: 'dist',
  server: {
    url: 'https://8c486308-41f7-48df-b54f-855d46ef6334.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
