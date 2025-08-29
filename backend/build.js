#!/usr/bin/env node
import esbuild from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';
import { existsSync, mkdirSync } from 'fs';

// Ensure dist directory exists
if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
}

// Build the backend
esbuild.build({
  entryPoints: ['src/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/server.js',
  plugins: [nodeExternalsPlugin()],
  external: ['chokidar'],
  alias: {
    '@': './src'
  },
  sourcemap: true,
  minify: false,
  keepNames: true,
  logLevel: 'info'
}).then(() => {
  console.log('✅ Backend built successfully!');
}).catch((error) => {
  console.error('❌ Build failed:', error);
  process.exit(1);
});