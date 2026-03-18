const esbuild = require('esbuild');
const fs = require('fs').promises;
const path = require('path');

async function build() {
  try {
    await fs.copyFile('./src/html/index.html', './index.html');
    await fs.copyFile('./src/html/style.css', './style.css');

    await esbuild.build({
      entryPoints: ['./src/main.js'],
      bundle: true,
      minify: true,
      sourcemap: true,
      outfile: './main.js',              
      define: { 'process.env.NODE_ENV': '"production"' },
    });

    const srcAssets = path.join(__dirname, 'src', 'assets');
    const dstAssets = path.join(__dirname, '.', 'assets');

    try {
      await fs.access(srcAssets); 
    } catch {
      console.log('No assets directory to copy.');
      return; 
    }

    await fs.mkdir(dstAssets, { recursive: true });

    const files = await fs.readdir(srcAssets);
    await Promise.all(files.map(async (file) => {
      const srcFile = path.join(srcAssets, file);
      const dstFile = path.join(dstAssets, file);
      await fs.copyFile(srcFile, dstFile);
      console.log(`Copied ${file} to assets`);
    }));

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();