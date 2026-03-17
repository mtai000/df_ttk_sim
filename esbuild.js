const esbuild = require('esbuild');
const fs = require('fs').promises;
const path = require('path');

async function build() {
  try {
    await fs.mkdir('./dist', { recursive: true });

    await fs.copyFile('./index.html', './dist/index.html');
    await fs.copyFile('./style.css', './dist/style.css');

    await esbuild.build({
      entryPoints: ['./src/main.js'],
      bundle: true,
      minify: true,
      sourcemap: true,
      outfile: './dist/main.js',              
      define: { 'process.env.NODE_ENV': '"production"' },
    });

    const srcAssets = path.join(__dirname, 'src', 'assets');
    const dstAssets = path.join(__dirname, 'dist', 'assets');

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
      console.log(`Copied ${file} to dist/assets`);
    }));

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();