import { execSync } from 'child_process';
import { writeFileSync, existsSync, rmSync, readFileSync } from 'fs';
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

const args = process.argv.slice(2);
let deployGithub = true;
let deployCloudflare = true;

if (args.includes('--github') || args.includes('github') || args.includes('--platform=github')) {
  deployGithub = true;
  deployCloudflare = false;
} else if (args.includes('--cloudflare') || args.includes('cloudflare') || args.includes('--platform=cloudflare')) {
  deployGithub = false;
  deployCloudflare = true;
}

// 解析 --branch 参数，用于指定 Cloudflare Pages 部署的分支（例如部署到 main 生产环境分支）
let branch = '';
const branchArg = args.find(arg => arg.startsWith('--branch='));
if (branchArg) {
  branch = branchArg.split('=')[1];
} else {
  const branchIndex = args.indexOf('--branch');
  if (branchIndex !== -1 && branchIndex + 1 < args.length) {
    branch = args[branchIndex + 1];
  }
}


console.log(`部署目标: ${deployGithub ? 'GitHub Pages' : ''}${deployGithub && deployCloudflare ? ' & ' : ''}${deployCloudflare ? 'Cloudflare' : ''}`);

try {
  if (deployGithub) {
    console.log('正在为 GitHub Pages 执行打包...');
    process.env.DEPLOY_BASE = 'true';
    run('npm run build');

    if (!existsSync(distDir)) {
      throw new Error('未找到打包生成的 dist 目录！');
    }

    console.log('正在获取远程仓库 URL...');
    const remoteUrl = getOutput('git remote get-url origin');
    console.log(`远程仓库 URL: ${remoteUrl}`);

    cleanGitDir();

    console.log('正在初始化临时 Git 仓库并推送...');
    run('git init', distDir);

    run('git checkout -b gh-pages', distDir);
    run('git add -A', distDir);
    run('git commit -m "deploy: force deploy page"', distDir);
    
    console.log(`正在推送至 ${remoteUrl} 的 gh-pages 分支...`);
    run(`git push -f ${remoteUrl} gh-pages`, distDir);
  }

  if (deployCloudflare) {
    console.log('正在为 Cloudflare 执行打包...');
    delete process.env.DEPLOY_BASE;
    run('npm run build');

    if (!existsSync(distDir)) {
      throw new Error('未找到打包生成的 dist 目录！');
    }

    // 从 wrangler.jsonc 中动态读取项目名称
    let projectName = 'cloudcraft';
    try {
      const wranglerConfigPath = path.resolve(rootDir, 'wrangler.jsonc');
      if (existsSync(wranglerConfigPath)) {
        const content = readFileSync(wranglerConfigPath, 'utf8');
        const match = content.match(/"name"\s*:\s*"([^"]+)"/);
        if (match && match[1]) {
          projectName = match[1];
        }
      }
    } catch (e) {
      console.warn('无法从 wrangler.jsonc 解析项目名称，将使用默认名 cloudcraft');
    }

    console.log(`正在部署至 Cloudflare Pages (项目名: ${projectName}${branch ? `, 分支: ${branch}` : ''})...`);
    let deployCmd = `npx wrangler pages deploy ./dist --project-name=${projectName}`;
    if (branch) {
      deployCmd += ` --branch=${branch}`;
    }
    run(deployCmd);
  }

  console.log('部署成功！');
} catch (error) {
  console.error('部署失败:', error);
  cleanGitDir();
  process.exit(1);
}

cleanGitDir();
