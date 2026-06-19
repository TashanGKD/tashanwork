# Deep Research API 文档

本文档用于对外说明一套“论文搜索 + Deep Research 报告生成”接口能力，并可直接用于联调。

## 0. 服务地址

### Base URL

```tex
http://123.56.218.60:18000
```

### 页面地址

```tex
http://123.56.218.60:18000/
```

### 健康检查

```tex
GET http://123.56.218.60:18000/health
```

### Deep Research 接口

```tex
POST http://123.56.218.60:18000/api/research/ask
```

## 1. 能力概述

这套 API 提供两层能力：

### 1.1 论文搜索

用于从论文库或 arXiv 中检索候选论文，支持：

- 标题 + 摘要联合检索
- arXiv 标题检索
- arXiv 摘要检索
- arXiv 编号检索
- arXiv 多字段综合检索

### 1.2 Deep Research

用于将论文检索结果进一步整合为结构化研究报告，支持：

- 自动拆解研究关键词
- 多接口组合检索
- 去重与标准化
- 流式输出研究过程与最终报告

---

## 2. Deep Research 接口

### 请求方式

- Method: `POST`
- Content-Type: `application/json`
- Response: `text/event-stream`

### 接口路径

```tex
POST http://123.56.218.60:18000/api/research/ask
```

### 请求体

```json
{
  "prompt": "研究人工智能在教育评估中的应用",
  "model": "qwen-deep-research",
  "keyword_model": "qwen-plus",
  "page_num": 1,
  "page_size": 5,
  "endpoint_names": [
    "searchArticlesByQuery1",
    "searchArxivByTitle",
    "searchArxivByAbstract",
    "searchArxivByArxivNo1",
    "searchArxiv"
  ],
  "include_raw": false
}
```

### 完整请求示例

```bash
curl -N --location 'http://123.56.218.60:18000/api/research/ask'
  --header 'Content-Type: application/json'
  --header 'Accept: text/event-stream'
  --data '{
    "prompt": "研究人工智能在教育评估中的应用",
    "model": "qwen-deep-research",
    "keyword_model": "qwen-plus",
    "page_num": 1,
    "page_size": 5,
    "endpoint_names": [
      "searchArticlesByQuery1",
      "searchArxivByTitle",
      "searchArxivByAbstract",
      "searchArxivByArxivNo1",
      "searchArxiv"
    ],
    "include_raw": false
  }'
```

### 请求参数说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `prompt` | `string` | 是 | 用户的研究主题或问题 |
| `model` | `string` | 是 | Deep Research 模型，当前固定为 `qwen-deep-research` |
| `keyword_model` | `string` | 否 | 用于关键词拆解的模型，例如 `qwen-plus` |
| `page_num` | `number` | 否 | 检索分页页码 |
| `page_size` | `number` | 否 | 每个检索接口单次返回数量 |
| `endpoint_names` | `string[]` | 否 | 需要启用的论文检索接口列表 |
| `include_raw` | `boolean` | 否 | 是否返回原始检索结果 |

### 说明

- 请求体使用 JSON。
- 响应不是一次性 JSON，而是 SSE 流。
- 正文需要通过流式事件实时拼接。

---

## 3. Deep Research 处理流程

一次完整研究通常包括以下步骤：

1. 接收用户研究问题
2. 将中文研究主题拆解为适合检索的英文关键词
3. 调用一个或多个论文搜索接口获取候选论文
4. 对候选结果去重、标准化、筛选
5. 将候选论文作为证据输入研究模型
6. 通过 SSE 持续输出状态、引用和报告正文

---

## 4. SSE 响应事件

Deep Research 接口返回 `text/event-stream`，前端或调用方需要持续消费事件。

### 4.1 `phase`

表示当前所处研究阶段。

```json
{
  "phase": "KeywordPlanning",
  "status": "finished"
}
```

常见 `phase`：

- `KeywordPlanning`
- `PrivateSearch`
- `ResearchPlanning`
- `WebResearch`
- `answer`
- `KeepAlive`

常见 `status`：

- `typing`
- `finished`
- `streamingQueries`
- `streamingWebResult`
- `WebResultFinished`

### 4.2 `keywords`

表示系统拆出的英文关键词。

```json
{
  "keywords": ["AI in education", "intelligent assessment"],
  "keywordModel": "qwen-plus"
}
```

### 4.3 `private_search_hit`

表示某个检索接口对某个关键词的一次搜索结果。

```json
{
  "endpoint": "searchArxivByTitle",
  "keyword": "AI in education",
  "count": 2,
  "elapsedMs": 812.3
}
```

### 4.4 `private_search_summary`

表示私有论文检索阶段的汇总信息。

```json
{
  "totalResults": 10,
  "totalElapsedMs": 5230.5,
  "endpointTimings": [
    {
      "endpoint": "searchArxivByTitle",
      "calls": 5,
      "successCalls": 5,
      "failedCalls": 0,
      "totalElapsedMs": 5230.5,
      "avgElapsedMs": 1046.1
    }
  ]
}
```

### 4.5 `references`

表示研究报告最终引用的来源。

```json
{
  "references": [
    {
      "title": "Paper Title",
      "description": "Paper abstract or summary",
      "url": "https://example.com/paper"
    }
  ]
}
```

### 4.6 `delta`

表示实时报告正文片段。

```json
{
  "phase": "answer",
  "status": "typing",
  "content": "本研究重点分析了人工智能在教育评估中的应用路径。"
}
```

说明：

- `delta.content` 是前端实时拼接正文的核心字段。

### 4.7 `usage`

表示 token 消耗信息。

```json
{
  "usage": {
    "input_tokens": 100,
    "output_tokens": 200,
    "total_tokens": 300
  },
  "requestId": "request-id"
}
```

### 4.8 `done`

表示整次研究结束。

```json
{
  "ok": true,
  "answer": "完整研究报告正文",
  "totalElapsedMs": 27066.06
}
```

说明：

- `done.answer` 是最终汇总后的完整结果
- `done.totalElapsedMs` 是整次请求总耗时

### 4.9 `error`

表示流程执行失败。

```json
{
  "message": "错误信息"
}
```

---

## 5. 论文搜索接口

Deep Research 通常依赖以下论文搜索接口作为前置召回层。

### 5.1 `searchArticlesByQuery1`

用途：

- 在标题和摘要两个维度上联合检索论文

请求方式：

- `POST body`

主要参数：

- `titleAndAbs`：数组

适用场景：

- 已经拆出多组关键词
- 需要宽召回
- 适合做第一轮候选论文收集

### 5.2 `searchArxivByTitle`

用途：

- 按 arXiv 标题检索论文

请求方式：

- `POST body`

主要参数：

- `pageNum`
- `pageSize`
- `key`

适用场景：

- 主题词明确
- 需要高相关结果

### 5.3 `searchArxivByAbstract`

用途：

- 按 arXiv 摘要检索论文

请求方式：

- `POST body`

主要参数：

- `pageNum`
- `pageSize`
- `key`

适用场景：

- 研究主题描述较长
- 关键词更可能出现在摘要中
- 需要更高召回率

### 5.4 `searchArxivByArxivNo1`

用途：

- 按 arXiv 编号精确检索论文

请求方式：

- `POST body`

主要参数：

- `pageNum`
- `pageSize`
- `key`

适用场景：

- 已知具体 arXiv 编号
- 需要精确定位单篇论文

### 5.5 `searchArxiv`

用途：

- 按多个字段综合检索 arXiv 论文

支持字段：

- `arxivNo`
- `title`
- `author`
- `paperAbstract`
- `comments`
- `subjects`

请求方式：

- `POST body`

主要参数：

- `pageNum`
- `pageSize`
- `key`

适用场景：

- 搜索目标复杂
- 需要综合覆盖多个字段
- 适合作为通用检索入口

---

## 6. 推荐检索策略

如果要把论文搜索与 Deep Research 结合，建议这样用：

1. 先拆关键词
2. 用 `searchArxivByTitle` 做高相关初筛
3. 用 `searchArxivByAbstract` 或 `searchArticlesByQuery1` 做扩召回
4. 用 `searchArxiv` 做综合补充
5. 如果用户给了具体编号，再调用 `searchArxivByArxivNo1`
6. 对结果去重、排序、标准化后进入研究报告生成

---

## 7. 前端对接要点

前端接入时需要明确：

1. 请求是 `POST + JSON body`
2. 响应是 `SSE`
3. 正文要靠 `delta.content` 实时拼接
4. 状态栏建议展示：
   - `phase`
   - `status`
   - `elapsed`
   - `usage`
5. 总耗时优先取 `done.totalElapsedMs`

推荐 UI 区域：

- 顶部状态栏
- 报告正文区
- 关键词区
- 引用区
- 接口耗时区
- 原始事件日志区

---

## 8. Java 调用示例

下面示例使用 Java 11+ `HttpClient` 发起请求，并按 SSE 流逐段读取返回内容。

```java
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

public class DeepResearchSseDemo {
    public static void main(String[] args) throws Exception {
        String url = "http://123.56.218.60:18000/api/research/ask";

        String jsonBody = """
            {
              "prompt": "研究人工智能在教育评估中的应用",
              "model": "qwen-deep-research",
              "keyword_model": "qwen-plus",
              "page_num": 1,
              "page_size": 5,
              "endpoint_names": [
                "searchArticlesByQuery1",
                "searchArxivByTitle",
                "searchArxivByAbstract",
                "searchArxivByArxivNo1",
                "searchArxiv"
              ],
              "include_raw": false
            }
            """;

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(20))
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .timeout(Duration.ofMinutes(10))
                .header("Content-Type", "application/json")
                .header("Accept", "text/event-stream")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                .build();

        HttpResponse<InputStream> response = client.send(
                request,
                HttpResponse.BodyHandlers.ofInputStream()
        );

        System.out.println("HTTP Status: " + response.statusCode());
        System.out.println("Content-Type: " + response.headers().firstValue("Content-Type").orElse(""));

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {

            String line;
            String event = null;
            StringBuilder dataBuilder = new StringBuilder();

            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) {
                    if (event != null || dataBuilder.length() > 0) {
                        String data = dataBuilder.toString();
                        System.out.println("event = " + event);
                        System.out.println("data  = " + data);
                        System.out.println("-------------------------");

                        if ("done".equals(event)) {
                            break;
                        }
                    }
                    event = null;
                    dataBuilder.setLength(0);
                    continue;
                }

                if (line.startsWith("event:")) {
                    event = line.substring("event:".length()).trim();
                } else if (line.startsWith("data:")) {
                    if (dataBuilder.length() > 0) {
                        dataBuilder.append("\\n");
                    }
                    dataBuilder.append(line.substring("data:".length()).trim());
                }
            }
        }
    }
}
```

---

## 9. 常见问题

### 为什么是 JSON 请求，但又说是 SSE？

因为：

- 请求体格式是 JSON
- 响应体格式是 SSE

这两者不冲突。

### 为什么只有关键词，没有正文？

通常是因为：

- 没有正确解析 SSE
- 没有处理 `delta`
- 没有把 `delta.content` 拼接到正文中

### 为什么会先反问？

如果研究流程启用了澄清阶段，模型会先询问研究范围。
如果希望直接深入研究，需要关闭反问确认或走直达研究模式。

---

## 10. 一句话总结

这套 API 的核心模式是：

- 前面用论文搜索接口做召回
- 后面用 Deep Research 做整合
- 中间通过 SSE 把状态、证据和正文持续返回给前端
