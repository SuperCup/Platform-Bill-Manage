# 在线部署说明

本项目为**纯静态前端**（`web/` 目录），无需构建，可直接部署到 **Netlify** 或 **GitHub Pages**。

## 方式一：Netlify（推荐，步骤最少）

1. 登录 [Netlify](https://app.netlify.com/)
2. **Add new site** → **Import an existing project** → 选择 **GitHub** → 授权并选中仓库 `SuperCup/Platform-Bill-Manage`
3. 构建设置（仓库已含 `netlify.toml`，一般会自动识别）：
   - **Build command**：留空
   - **Publish directory**：`web`
4. 点击 **Deploy site**
5. 部署完成后获得地址，例如：`https://xxx.netlify.app`

可选：在 Netlify **Domain settings** 中绑定自定义域名。

---

## 方式二：GitHub Pages

仓库已包含工作流：`.github/workflows/deploy-pages.yml`（推送 `main` 分支时自动部署）。

### 首次启用（只需一次）

1. 打开 GitHub 仓库：https://github.com/SuperCup/Platform-Bill-Manage  
2. **Settings** → **Pages**  
3. **Build and deployment** → **Source** 选择 **GitHub Actions**  
4. 保存后，在 **Actions** 页签查看 `Deploy to GitHub Pages` 是否成功  

### 访问地址

项目站点（Project site）默认地址为：

**https://supercup.github.io/Platform-Bill-Manage/**

常用入口：

| 模块 | 链接 |
|------|------|
| 首页 | https://supercup.github.io/Platform-Bill-Manage/ |
| 到店营销 | https://supercup.github.io/Platform-Bill-Manage/#/marketing |
| 即时零售 | https://supercup.github.io/Platform-Bill-Manage/#/retail |
| PMS | https://supercup.github.io/Platform-Bill-Manage/#/pms |

> 路由使用 hash（`#/marketing`），无需额外 SPA 重定向配置。

---

## 本地预览（与线上一致）

```bash
cd web
python -m http.server 8080
```

浏览器打开：http://localhost:8080/

---

## 常见问题

**Q：必须用静态服务器吗？**  
A：是。页面使用 ES Module（`import`），直接双击 `index.html` 可能因浏览器安全策略无法加载脚本；Netlify / GitHub Pages / 本地 `http.server` 均可。

**Q：两种方式可以同时用吗？**  
A：可以。同一仓库可同时连接 Netlify 与 GitHub Pages，互不影响。
