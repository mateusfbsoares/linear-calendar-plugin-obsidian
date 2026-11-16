const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');

// Fixed target plugins root (your requested path).
const targetPluginsRoot = '/home/mateus/Documents/PersonalOS/.obsidian/plugins';

// Use the sibling folder `linear-calendar` inside the plugins directory
const targetDir = path.join(targetPluginsRoot, 'linear-calendar');

// Determine build output file from package.json `main` (fallback to main.js)
const pkgPath = path.join(repoRoot, 'package.json');
const mainFile = (fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')).main : null) || 'main.js';
const filesToCopy = [mainFile, 'styles.css', 'manifest.json'];
const outputFile = path.join(repoRoot, mainFile);

function copyFiles() {
  fs.mkdirSync(targetDir, { recursive: true });
  for (const file of filesToCopy) {
    const source = path.join(repoRoot, file);
    const dest = path.join(targetDir, file);
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, dest);
      console.log(`Copied ${file} -> ${dest}`);
    } else {
      console.warn(`Skipping missing file: ${source}`);
    }
  }
}

function waitForBuild() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (fs.existsSync(outputFile)) {
        clearInterval(interval);
        resolve();
      }
    }, 250);
  });
}

async function main() {
  console.log('Starting dev build and deploy watcher...');

  const dev = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    cwd: repoRoot,
    shell: process.platform === 'win32',
  });

  dev.on('exit', (code) => {
    console.log(`npm run dev exited with code ${code}`);
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    console.log('Stopping watch-deploy...');
    dev.kill('SIGINT');
    process.exit(0);
  });

  await waitForBuild();
  copyFiles();

  fs.watchFile(outputFile, { interval: 250 }, (curr, prev) => {
    if (curr.mtimeMs !== prev.mtimeMs) {
      console.log('Detected build output change, deploying...');
      copyFiles();
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
