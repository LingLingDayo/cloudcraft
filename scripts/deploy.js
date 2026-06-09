import { execSync } from 'child_process';
import { writeFileSync, existsSync, rmSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function run(cmd, cwd = rootDir) {
  return execSync(cmd, { cwd, stdio: 'inherit' });
}

function getOutput(cmd, cwd = rootDir) {
  return execSync(cmd, { cwd, encoding: 'utf8' }).trim();
}

const distDir = path.resolve(rootDir, 'dist');
const gitDir = path.resolve(distDir, '.git');

function cleanGitDir() {
  if (existsSync(gitDir)) {
    console.log('正在清理临时 Git 仓库...');
    rmSync(gitDir, { recursive: true, force: true });
  }
}

try {
  console.log('正在获取远程仓库 URL...');
  const remoteUrl = getOutput('git remote get-url origin');
  console.log(`远程仓库 URL: ${remoteUrl}`);

  console.log('正在执行打包...');
  // 设置环境变量，指示打包使用 /cloudcraft/ 作为 base 路径
  process.env.DEPLOY_BASE = 'true';
  run('npm run build');

  if (!existsSync(distDir)) {
    throw new Error('未找到打包生成的 dist 目录！');
  }

  cleanGitDir();

  console.log('正在初始化临时 Git 仓库并推送...');
  run('git init', distDir);

  run('git checkout -b gh-pages', distDir);
  run('git add -A', distDir);
  run('git commit -m "deploy: force deploy page"', distDir);
  
  console.log(`正在强制推送至 ${remoteUrl} 的 gh-pages 分支...`);
  run(`git push -f ${remoteUrl} gh-pages`, distDir);

  console.log('部署成功！');
} catch (error) {
  console.error('部署失败:', error);
  cleanGitDir();
  process.exit(1);
}

cleanGitDir();
