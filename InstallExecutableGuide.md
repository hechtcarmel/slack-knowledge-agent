# Executable Installation Guide

This guide provides comprehensive instructions for creating a standalone executable version of the Slack Knowledge Agent that bundles Node.js, all dependencies, and both frontend and backend components into a single distributable file.

## Overview

The Slack Knowledge Agent can be packaged as a standalone executable that users can simply download and run without needing to install Node.js, pnpm, or any dependencies. When launched, the executable will:

- Start the backend API server on localhost:3000
- Serve the frontend web interface 
- Automatically open the user's default browser
- Provide a complete, self-contained experience

## Table of Contents

- [Prerequisites](#prerequisites)
- [Method 1: pkg + Static Serving (Recommended)](#method-1-pkg--static-serving-recommended)
- [Method 2: Electron Desktop App](#method-2-electron-desktop-app)
- [Method 3: Docker Container](#method-3-docker-container)
- [Configuration Management](#configuration-management)
- [Cross-Platform Distribution](#cross-platform-distribution)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Prerequisites

### Development Environment
- **Node.js 20+**: Required for building the executable
- **pnpm 8+**: Package manager used by the project
- **Git**: For version control and deployment scripts

### Platform-Specific Tools
- **Windows**: No additional tools required
- **macOS**: Xcode Command Line Tools (for native modules)
- **Linux**: Build essentials (`build-essential` on Ubuntu/Debian)

### Verify Prerequisites
```bash
node --version    # Should be 20.x or higher
pnpm --version    # Should be 8.x or higher
git --version     # Any recent version
```

## Method 1: pkg + Static Serving (Recommended)

This method creates a single executable that includes the Node.js runtime, all dependencies, and serves both the API and web interface. It's the most efficient approach for this application.

### Step 1: Prepare the Project Structure

First, modify the backend to serve static files in production mode:

1. **Update Backend Server Configuration**

Create or modify `backend/src/server-executable.ts`:

```typescript
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createApplication } from './core/app/ApplicationFactory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startExecutableServer() {
  try {
    const app = await createApplication({
      environment: process.env.NODE_ENV || 'production'
    });

    // Serve static frontend files
    const staticPath = path.join(__dirname, '../static');
    app.use(express.static(staticPath));

    // Fallback to index.html for SPA routing
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(staticPath, 'index.html'));
    });

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
      console.log(`🚀 Slack Knowledge Agent running on http://localhost:${port}`);
      console.log(`📖 Open your browser to start using the application`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startExecutableServer();
```

2. **Create Build Script**

Add to `backend/scripts/build-executable.js`:

```javascript
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function buildExecutable() {
  console.log('🏗️ Building Slack Knowledge Agent executable...');

  // 1. Build frontend
  console.log('📦 Building frontend...');
  execSync('cd frontend && pnpm run build', { stdio: 'inherit' });

  // 2. Build backend
  console.log('📦 Building backend...');
  execSync('cd backend && pnpm run build', { stdio: 'inherit' });

  // 3. Copy frontend dist to backend static folder
  console.log('📁 Copying frontend assets...');
  const frontendDist = path.join(process.cwd(), 'frontend/dist');
  const backendStatic = path.join(process.cwd(), 'backend/dist/static');
  
  if (fs.existsSync(backendStatic)) {
    fs.rmSync(backendStatic, { recursive: true });
  }
  fs.mkdirSync(backendStatic, { recursive: true });
  
  // Copy all frontend assets
  execSync(`cp -r ${frontendDist}/* ${backendStatic}/`, { stdio: 'inherit' });

  // 4. Create executable with pkg
  console.log('🔨 Creating executable...');
  const platforms = ['node20-win-x64', 'node20-macos-x64', 'node20-linux-x64'];
  
  for (const platform of platforms) {
    console.log(`Building for ${platform}...`);
    execSync(`npx pkg backend/dist/server-executable.js --target ${platform} --output dist/slack-knowledge-agent-${platform}`, 
      { stdio: 'inherit' });
  }

  console.log('✅ Executable build complete! Check the dist/ folder.');
}

buildExecutable().catch(console.error);
```

### Step 2: Configure pkg

Add pkg configuration to `backend/package.json`:

```json
{
  "pkg": {
    "scripts": ["dist/**/*.js"],
    "assets": ["dist/static/**/*"],
    "targets": [
      "node20-win-x64",
      "node20-macos-x64", 
      "node20-linux-x64"
    ],
    "outputPath": "../dist"
  }
}
```

### Step 3: Install Dependencies

```bash
# Install pkg globally
npm install -g pkg

# Install build dependencies
pnpm add -D pkg concurrently cross-env
```

### Step 4: Build the Executable

Add build scripts to root `package.json`:

```json
{
  "scripts": {
    "build:executable": "node backend/scripts/build-executable.js",
    "build:win": "npm run build:executable && pkg backend/dist/server-executable.js --targets node20-win-x64 --out-path dist",
    "build:mac": "npm run build:executable && pkg backend/dist/server-executable.js --targets node20-macos-x64 --out-path dist", 
    "build:linux": "npm run build:executable && pkg backend/dist/server-executable.js --targets node20-linux-x64 --out-path dist",
    "build:all": "npm run build:executable"
  }
}
```

Run the build:

```bash
# Build for all platforms
pnpm run build:all

# Or build for specific platform
pnpm run build:win    # Windows
pnpm run build:mac    # macOS
pnpm run build:linux  # Linux
```

### Step 5: Create Platform Launchers

#### Windows Launcher (.bat)

Create `launchers/windows/start-slack-knowledge-agent.bat`:

```batch
@echo off
title Slack Knowledge Agent
echo Starting Slack Knowledge Agent...
echo.

REM Check if config exists, create if not
if not exist "config.env" (
    echo Creating default configuration file...
    copy config.env.template config.env
    echo.
    echo Please edit config.env with your Slack and LLM API keys
    echo Then run this launcher again.
    pause
    exit /b
)

REM Start the server
slack-knowledge-agent-win.exe
echo.
echo Opening browser...
start http://localhost:3000

REM Keep window open
echo.
echo Server is running. Close this window to stop the application.
pause
```

#### macOS Launcher (.command)

Create `launchers/macos/start-slack-knowledge-agent.command`:

```bash
#!/bin/bash
cd "$(dirname "$0")"

echo "Starting Slack Knowledge Agent..."

# Check if config exists
if [ ! -f "config.env" ]; then
    echo "Creating default configuration file..."
    cp config.env.template config.env
    echo ""
    echo "Please edit config.env with your Slack and LLM API keys"
    echo "Then run this launcher again."
    read -p "Press Enter to exit..."
    exit 1
fi

# Start the server
./slack-knowledge-agent-macos &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Open browser
echo "Opening browser..."
open http://localhost:3000

# Wait for user to stop
echo ""
echo "Server is running. Press Enter to stop the application."
read -p ""

# Kill the server
kill $SERVER_PID
echo "Application stopped."
```

#### Linux Launcher (.sh)

Create `launchers/linux/start-slack-knowledge-agent.sh`:

```bash
#!/bin/bash
cd "$(dirname "$0")"

echo "Starting Slack Knowledge Agent..."

# Check if config exists
if [ ! -f "config.env" ]; then
    echo "Creating default configuration file..."
    cp config.env.template config.env
    echo ""
    echo "Please edit config.env with your Slack and LLM API keys"
    echo "Then run this launcher again."
    read -p "Press Enter to exit..."
    exit 1
fi

# Start the server
./slack-knowledge-agent-linux &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Open browser
echo "Opening browser..."
if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3000
elif command -v gnome-open > /dev/null; then
    gnome-open http://localhost:3000
else
    echo "Please open http://localhost:3000 in your browser"
fi

# Wait for user to stop
echo ""
echo "Server is running. Press Ctrl+C to stop the application."
wait $SERVER_PID
```

Make scripts executable:
```bash
chmod +x launchers/macos/start-slack-knowledge-agent.command
chmod +x launchers/linux/start-slack-knowledge-agent.sh
```

## Method 2: Electron Desktop App

For users who prefer a desktop application experience, Electron provides a more integrated solution.

### Step 1: Install Electron Dependencies

```bash
pnpm add -D electron electron-builder
```

### Step 2: Create Electron Main Process

Create `electron/main.js`:

```javascript
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

async function createWindow() {
  // Start the backend server
  const serverPath = path.join(__dirname, '../backend/dist/server.js');
  serverProcess = spawn('node', [serverPath], {
    env: { ...process.env, NODE_ENV: 'production' }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`Server Error: ${data}`);
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    show: false
  });

  // Load the web interface
  await mainWindow.loadURL('http://localhost:3000');

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### Step 3: Configure Electron Builder

Add to `package.json`:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "electron:dev": "electron .",
    "electron:build": "electron-builder",
    "build:electron": "pnpm run build && electron-builder"
  },
  "build": {
    "appId": "com.yourcompany.slack-knowledge-agent",
    "productName": "Slack Knowledge Agent",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "electron/**/*",
      "backend/dist/**/*",
      "frontend/dist/**/*"
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

### Step 4: Build Electron App

```bash
# Build the application
pnpm run build

# Build Electron executable
pnpm run build:electron
```

## Method 3: Docker Container

For maximum compatibility and isolation, Docker provides a containerized solution.

### Step 1: Create Dockerfile

Create `Dockerfile.standalone`:

```dockerfile
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN pnpm run build

# Expose port
EXPOSE 3000

# Start command
CMD ["pnpm", "run", "start"]
```

### Step 2: Create Docker Compose for Standalone

Create `docker-compose.standalone.yml`:

```yaml
version: '3.8'

services:
  slack-knowledge-agent:
    build:
      context: .
      dockerfile: Dockerfile.standalone
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Step 3: Create Launcher Scripts

#### Docker Windows Launcher

Create `launchers/docker/start-docker.bat`:

```batch
@echo off
title Slack Knowledge Agent (Docker)

echo Checking Docker installation...
docker --version >nul 2>&1
if errorlevel 1 (
    echo Docker is not installed or not running.
    echo Please install Docker Desktop from https://docker.com
    pause
    exit /b
)

echo Starting Slack Knowledge Agent...
docker-compose -f docker-compose.standalone.yml up -d

echo Waiting for application to start...
timeout /t 10

echo Opening browser...
start http://localhost:3000

echo.
echo Application is running in Docker.
echo To stop: docker-compose -f docker-compose.standalone.yml down
pause
```

## Configuration Management

### Environment Configuration Template

Create `config.env.template`:

```env
# Slack Configuration (Required)
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_USER_TOKEN=xoxp-your-user-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here

# LLM Configuration (At least one required)
OPENAI_API_KEY=sk-your-openai-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here

# LLM Settings
DEFAULT_LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini

# Server Configuration
PORT=3000
NODE_ENV=production

# Memory Configuration
MEMORY_ENABLED=true
MEMORY_MAX_TOKENS=200000
MEMORY_MAX_MESSAGES=200
MEMORY_SESSION_TTL_MINUTES=60

# Query Configuration
MAX_HISTORY_DAYS=90
DEFAULT_QUERY_LIMIT=50
MAX_QUERY_LIMIT=200
```

### Configuration Loading

Modify the executable server to load configuration from external file:

```typescript
// In server-executable.ts
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load configuration from external file
const configPath = path.join(process.cwd(), 'config.env');
if (fs.existsSync(configPath)) {
  dotenv.config({ path: configPath });
} else {
  console.warn('⚠️  No config.env file found. Using defaults.');
}
```

## Cross-Platform Distribution

### Distribution Structure

```
slack-knowledge-agent-v1.0.0/
├── windows/
│   ├── slack-knowledge-agent.exe
│   ├── start-slack-knowledge-agent.bat
│   ├── config.env.template
│   └── README.txt
├── macos/
│   ├── slack-knowledge-agent
│   ├── start-slack-knowledge-agent.command
│   ├── config.env.template
│   └── README.txt
├── linux/
│   ├── slack-knowledge-agent
│   ├── start-slack-knowledge-agent.sh
│   ├── config.env.template
│   └── README.txt
└── docker/
    ├── docker-compose.yml
    ├── start-docker.bat
    ├── start-docker.sh
    ├── config.env.template
    └── README.txt
```

### Packaging Script

Create `scripts/package-distribution.js`:

```javascript
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';

async function createDistribution() {
  const version = '1.0.0';
  const distDir = 'distribution';
  
  // Create distribution directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // Copy executables and launchers
  const platforms = ['windows', 'macos', 'linux'];
  
  for (const platform of platforms) {
    const platformDir = path.join(distDir, platform);
    fs.mkdirSync(platformDir);
    
    // Copy executable
    const exeName = platform === 'windows' ? 'slack-knowledge-agent.exe' : 'slack-knowledge-agent';
    fs.copyFileSync(`dist/${exeName}`, path.join(platformDir, exeName));
    
    // Copy launcher
    fs.copyFileSync(`launchers/${platform}/start-*`, platformDir);
    
    // Copy config template
    fs.copyFileSync('config.env.template', path.join(platformDir, 'config.env.template'));
    
    // Create README
    const readme = createPlatformREADME(platform);
    fs.writeFileSync(path.join(platformDir, 'README.txt'), readme);
  }

  // Create ZIP archives
  for (const platform of platforms) {
    await createZip(`slack-knowledge-agent-${platform}-v${version}.zip`, path.join(distDir, platform));
  }

  console.log('✅ Distribution packages created successfully!');
}

function createPlatformREADME(platform) {
  return `Slack Knowledge Agent v1.0.0 - ${platform.toUpperCase()}

QUICK START:
1. Copy config.env.template to config.env
2. Edit config.env with your API keys
3. Run the launcher script

REQUIREMENTS:
- Your Slack bot must be installed in your workspace
- You need either OpenAI or Anthropic API keys

SUPPORT:
Visit https://github.com/your-repo for documentation and support.
`;
}

createDistribution().catch(console.error);
```

## Troubleshooting

### Common Issues

#### "Cannot find module" errors with pkg
**Problem**: pkg can't bundle dynamic imports or certain dependencies.

**Solution**: 
```javascript
// Instead of dynamic import
const module = await import('./module.js');

// Use static require or webpack-style imports
const module = require('./module.js');
```

#### Frontend assets not loading
**Problem**: Static files aren't served correctly.

**Solution**: Verify the static path configuration:
```typescript
const staticPath = path.join(__dirname, '../static');
console.log('Static path:', staticPath);
console.log('Static path exists:', fs.existsSync(staticPath));
```

#### Port already in use
**Problem**: Another application is using port 3000.

**Solution**: Add port detection to the launcher:
```javascript
const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}
```

#### Configuration not loading
**Problem**: Environment variables aren't being read.

**Solution**: Add debugging to configuration loading:
```typescript
console.log('Config file path:', configPath);
console.log('Config file exists:', fs.existsSync(configPath));
console.log('Loaded variables:', Object.keys(process.env).filter(k => k.startsWith('SLACK_')));
```

### Platform-Specific Issues

#### Windows
- **Issue**: Windows Defender blocks executable
- **Solution**: Sign the executable or add installation instructions for allowlisting

#### macOS
- **Issue**: "App can't be opened because it's from an unidentified developer"
- **Solution**: Code sign the app or provide instructions for bypassing Gatekeeper:
  ```bash
  xattr -d com.apple.quarantine slack-knowledge-agent
  ```

#### Linux
- **Issue**: Missing executable permissions
- **Solution**: Ensure chmod +x is applied during build or in launcher scripts

## Best Practices

### Security Considerations

1. **API Key Protection**
   - Never bundle API keys in the executable
   - Use external configuration files
   - Provide clear warnings about API key security

2. **Network Security**
   - Only bind to localhost by default
   - Use HTTPS for production deployments
   - Validate all configuration inputs

3. **Update Mechanism**
   - Implement version checking
   - Provide clear update instructions
   - Consider auto-update capabilities

### Performance Optimization

1. **Bundle Size**
   ```bash
   # Analyze bundle size
   npx pkg-analyze backend/dist/server-executable.js
   
   # Minimize dependencies
   pnpm audit --prod
   ```

2. **Memory Usage**
   - Set appropriate memory limits in production
   - Monitor memory usage during builds
   - Optimize static asset sizes

3. **Startup Time**
   - Minimize initialization code
   - Use lazy loading where possible
   - Provide startup progress indicators

### User Experience

1. **Error Handling**
   - Provide clear error messages
   - Include troubleshooting steps
   - Log errors for debugging

2. **Documentation**
   - Include comprehensive README files
   - Provide video tutorials
   - Create FAQ section

3. **Configuration**
   - Use sensible defaults
   - Validate configuration on startup
   - Provide configuration templates

### Maintenance

1. **Automated Builds**
   ```yaml
   # GitHub Actions example
   name: Build Executables
   on:
     release:
       types: [published]
   
   jobs:
     build:
       runs-on: ${{ matrix.os }}
       strategy:
         matrix:
           os: [windows-latest, macos-latest, ubuntu-latest]
       
       steps:
         - uses: actions/checkout@v3
         - uses: actions/setup-node@v3
           with:
             node-version: '20'
         - run: npm install -g pnpm
         - run: pnpm install
         - run: pnpm run build:executable
         - uses: actions/upload-artifact@v3
           with:
             name: executables
             path: dist/
   ```

2. **Testing Strategy**
   - Test executables on each target platform
   - Automate integration testing
   - Validate configuration loading

3. **Distribution**
   - Use GitHub Releases for distribution
   - Provide checksums for security
   - Maintain download statistics

## Conclusion

Creating a standalone executable for the Slack Knowledge Agent provides users with a simple, one-click installation experience while maintaining the full functionality of the web-based application. The pkg method is recommended for most use cases due to its efficiency and simplicity, while Electron offers a more desktop-integrated experience for users who prefer traditional desktop applications.

Choose the method that best fits your distribution strategy and user requirements. All approaches maintain the security, configurability, and functionality of the original application while significantly reducing the technical barrier to entry for end users.

For additional support and updates, refer to the main project documentation and repository issues.