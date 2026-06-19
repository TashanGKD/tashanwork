# 知网 DOM 结构参考指南

## 目录

1. [环境要求](#环境要求)
2. [搜索结果页 DOM](#搜索结果页-dom)
3. [详情页 DOM](#详情页-dom)
4. [反爬与验证码](#反爬与验证码)
5. [字段映射速查表](#字段映射速查表)
6. [常见问题](#常见问题)

## 环境要求

- Chrome 浏览器（建议最新稳定版）
- 启动参数：`google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/cnki-chrome`
- 知网已登录（手动在浏览器中完成登录）
- CDP 可访问：`curl http://127.0.0.1:9222/json` 返回页面列表

## 搜索结果页 DOM

### 新版 KNS8 结构

搜索结果页 URL 模式：`https://kns.cnki.net/kns8/defaultresult/index`

结果表格通常具有以下结构：

```html
<table class="result-table-list">
  <tbody>
    <tr>
      <td class="seq">1</td>
      <td class="name">
        <a class="title" href="/kcms/detail/...">论文标题</a>
      </td>
      <td class="author">
        <a href="...">作者1</a>;
        <a href="...">作者2</a>
      </td>
      <td class="source">
        <a href="...">期刊名称</a>
      </td>
      <td class="date">2024</td>
      <td class="data">
        <span>被引: 15</span>
        <span>下载: 200</span>
      </td>
      <td class="quote">
        <span class="icon-collect">收藏</span>
      </td>
    </tr>
  </tbody>
</table>
```

### 关键选择器

| 字段 | CSS 选择器 | 备用模式 |
|------|-----------|---------|
| 标题 | `.title`, `a[href*="/kcms/detail/"]` | `<h3>` 内的第一个 `<a>` |
| 作者 | `.author a`, `.author` | 逗号或分号分隔的作者名 |
| 期刊 | `.source a`, `.source` | 紧跟在作者后的链接 |
| 年份 | `.date`, `td:nth-child(4)` | 4 位数字模式 `\\d{4}` |
| 被引量 | 文本包含"被引"后的数字 | `被引[:：]\\s*(\\d+)` |
| 下载量 | 文本包含"下载"后的数字 | `下载[:：]\\s*(\\d+)` |
| 详情链接 | `.title` 的 `href` | `/kcms/detail/` 开头的链接 |

### 数据库类型标识

结果行 HTML 中可能包含数据库类型标识：

| 标识 | 类型 |
|------|------|
| `CJFQ` | 期刊 |
| `CMFD` | 博硕士论文 |
| `CPFD` | 会议论文 |
| `CDFD` | 博士论文 |
| `CJFD` | 期刊（旧版） |

## 详情页 DOM

详情页 URL 模式：`https://kns.cnki.net/kcms/detail/detail.aspx?dbcode=CJFQ&dbname=...&filename=...`

### 标题区

```html
<h1>论文标题</h1>
<div class="author">
  <a href="...">作者1</a><sup>1</sup>
  <a href="...">作者2</a><sup>2</sup>
</div>
<div class="orgn">
  <a href="...">机构1</a><sup>1</sup>
</div>
```

### 摘要区

```html
<h3><span>摘要</span></h3>
<p>论文摘要内容...</p>
```

### 关键词区

```html
<span>关键词：</span>
<a href="...">关键词1</a>;
<a href="...">关键词2</a>
```

### 基金区

```html
<span>基金：</span>
国家社会科学基金(编号)
```

### 出版信息

```html
<span>期刊：期刊名称</span>
<span>年期：2024年05期</span>
<span>页码：45-52</span>
<span>DOI：10.xxxx/xxxx</span>
```

## 反爬与验证码

### 验证码检测

当页面出现以下特征时，表示触发了验证码：

- DOM 中存在 `#tcaptcha_transform_dy` 元素
- 页面标题包含"验证"
- 页面内容包含"请点击"或"滑动验证"
- 响应内容为空或大幅缩短

**处理流程**：
1. 检测到验证码时，立即停止自动化操作
2. 提示用户在浏览器中手动完成验证
3. 验证完成后继续后续操作

### 反爬策略

- **频率限制**：每页操作间隔建议 2-3 秒
- **User-Agent**：保持与正常浏览器一致
- **会话保持**：使用同一 Chrome 实例，避免频繁登录
- **异常检测**：若返回 HTML 不含预期结果结构，可能触发反爬，需等待后重试

### 安全建议

- 仅在个人学术研究中适度使用
- 不用于大规模批量下载全文
- 遵守知网服务条款
- 本 Skill 仅提取公开元数据，不提供付费全文获取

## 字段映射速查表

| 字段名 | 搜索结果页 | 详情页 | 说明 |
|--------|-----------|--------|------|
| title | title 链接文本 | h1 内容 | 论文标题 |
| authors | author 单元格内链接 | .author a | 作者列表 |
| institutions | — | .orgn a | 机构列表 |
| journal | source 单元格 | "期刊:"后的文本 | 来源期刊 |
| year | date 单元格 | 年份提取 | 发表年份 |
| volume | — | "卷"提取 | 卷号 |
| issue | — | "期"提取 | 期号 |
| pages | — | "页码"提取 | 起止页码 |
| doi | — | "DOI:"提取 | DOI 号 |
| abstract | abstract_snippet | 摘要段落 | 摘要（列表页为片段） |
| keywords | — | 关键词链接 | 关键词列表 |
| funding | — | "基金:"提取 | 基金项目 |
| clc | — | "中图分类号"提取 | 分类号 |
| citations | data 单元格 | "被引"提取 | 被引用次数 |
| downloads | data 单元格 | "下载"提取 | 下载次数 |
| database_type | CJFQ/CMFD/CPFD | dbcode 参数 | 数据库类型 |
| is_online_first | "网络首发"标识 | — | 是否在线首发 |
| detail_url | title href | 当前页 URL | 详情页链接 |

## 常见问题

### Q: 解析结果为空？
A: 检查 HTML 是否完整保存。知网结果页使用 AJAX 加载，需等待页面完全加载后再保存 HTML。

### Q: 某些字段缺失？
A: 知网不同版本 DOM 结构有差异。cnki_parse_results.py 内置多种匹配模式，但仍可能因版本更新导致部分字段缺失。

### Q: 如何确认 CDP 正常工作？
A: 执行 `curl http://127.0.0.1:9222/json`，若返回 JSON 数组且包含知网页面，则正常。

### Q: 需要安装 websocat 吗？
A: curl 命令示例使用了 websocat 发送 WebSocket 消息。若未安装，可直接复制输出的 JS 代码在 Chrome 控制台执行。

## 导出相关 DOM

### 批量导出 API

知网搜索结果页支持批量导出，无需进入每篇详情页。

**关键发现**：搜索结果页 `input.cbItem` 的 `value` === 详情页 `#export-id`（同一加密 ID）。

```javascript
// 获取所有 checkbox values
const checkboxes = document.querySelectorAll('.result-table-list tbody input.cbItem');
const exportIds = Array.from(checkboxes).map(cb => cb.value);
```

**Export API**：
- URL: `POST https://kns.cnki.net/dm8/API/GetExport`
- Content-Type: `application/x-www-form-urlencoded`
- Body: `filename={exportId}&displaymode=GBTREFER,elearning,EndNote&uniplatform=NZKPT`
- Response: JSON，包含 `GBTREFER`（GB/T 7714）、`EndNote`（EndNote 格式）、`elearning`（CAJ 格式）

**ISSN 提取**：从 EndNote 格式 `%@` 字段提取

### 选择器速查

| 元素 | CSS 选择器 |
|------|-----------|
| 结果行 checkbox | `.result-table-list tbody input.cbItem` |
| 论文标题链接 | `.result-table-list tbody td.name a.fz14` |
| 导出 API URL | `#export-url` 的 value |
| 导出加密 ID | `#export-id` 的 value |
| DB Code | `#paramdbcode` 的 value |
| DB Name | `#paramdbname` 的 value |
| Filename | `#paramfilename` 的 value |
