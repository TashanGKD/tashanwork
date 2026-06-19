export const TASHAN_KNOWLEDGE_INDEX_PROMPT =
  "作为他山企业资料库数字员工，请基于当前工作区文件生成第一版知识索引方案。输出需包含：1. 资料分类与命名规则；2. 关键文件和可检索摘要字段；3. 缺失资料清单；4. 文件读取、外部目录和敏感内容的权限确认点；5. 建议生成的索引表结构；6. 下一步可执行任务流。先说明你会检查哪些文件范围，再给出可执行计划。";

export type TashanModule = "工作台" | "数字员工" | "技能库" | "资料库" | "任务流" | "管理端";

export const TASHAN_MODULES: TashanModule[] = [
  "工作台",
  "数字员工",
  "技能库",
  "资料库",
  "任务流",
  "管理端",
];

export type TashanDigitalEmployee = {
  id: string;
  name: string;
  title: string;
  pluginName: string;
  packageName: string;
  avatar: string;
  category: string;
  role: string;
  status: "已上岗" | "推荐" | "内测";
  scope: string;
  description: string;
  tags: string[];
  skills: string[];
  mcps: string[];
  permissions: string[];
  modelPreference: string;
  prompt: string;
};

export const TASHAN_DIGITAL_EMPLOYEES: TashanDigitalEmployee[] = [
  {
    id: "research-writer",
    name: "研究写作员工",
    title: "研究与内容",
    pluginName: "tashan-research-writer",
    packageName: "@tashan/plugin-research-writer",
    avatar: "assets/avatars/v1/04-presentation-specialist.png",
    category: "研究与内容",
    role: "调研、方案、竞品与汇报",
    status: "已上岗",
    scope: "当前项目空间",
    description: "把资料、目标和约束整理成可执行方案，适合客户材料、竞品分析、汇报稿和项目复盘。",
    tags: ["调研", "写作", "汇报"],
    skills: ["Deep Research", "论文检索", "幻觉检查", "AIGC痕迹检测"],
    mcps: ["工作区文件", "浏览器", "Context7"],
    permissions: ["读取项目文件", "打开网页", "生成任务清单", "人工确认外部引用"],
    modelPreference: "DeepSeek-V4-Pro",
    prompt: "作为他山企业数字员工，先确认我的业务目标和输入资料，然后给出一个可执行的任务计划，包含所需文件、工具调用、风险点和验收标准。",
  },
  {
    id: "workflow-planner",
    name: "项目管理",
    title: "协同执行",
    pluginName: "tashan-project-manager",
    packageName: "@tashan/plugin-project-manager",
    avatar: "assets/avatars/v1/10-operations-planner.png",
    category: "协同执行",
    role: "阶段拆解、确认点和执行计划",
    status: "已上岗",
    scope: "项目与会话",
    description: "把复杂知识工作拆成阶段、输入输出、工具权限、人工确认和审计记录。",
    tags: ["任务流", "计划", "协作"],
    skills: ["任务拆解", "里程碑规划", "会议纪要", "风险跟踪"],
    mcps: ["Todo", "工作区文件", "浏览器"],
    permissions: ["创建 Todo", "读取会话事件", "生成执行计划", "关键节点人工确认"],
    modelPreference: "DeepSeek-V4-Pro",
    prompt: "把当前企业知识工作任务拆成可执行任务流：阶段、负责人角色、输入输出、工具权限、人工确认点和审计记录要求。",
  },
  {
    id: "knowledge-steward",
    name: "企业知识管理",
    title: "资料库与知识索引",
    pluginName: "tashan-knowledge-navigator",
    packageName: "@tashan/plugin-knowledge-navigator",
    avatar: "assets/avatars/v1/08-knowledge-librarian.png",
    category: "企业知识库",
    role: "生成知识索引、字段和检索方案",
    status: "已上岗",
    scope: "本地工作区文件",
    description: "面向本地文件和企业资料，生成资料分类、字段摘要、缺失清单和索引表结构。",
    tags: ["资料库", "索引", "检索"],
    skills: ["资料分类", "知识索引", "字段设计", "缺失资料识别"],
    mcps: ["工作区文件", "本地文件权限", "Context7"],
    permissions: ["读取项目文件", "访问授权目录", "生成索引草案", "敏感文件人工确认"],
    modelPreference: "DeepSeek-V4-Pro",
    prompt: TASHAN_KNOWLEDGE_INDEX_PROMPT,
  },
  {
    id: "permission-auditor",
    name: "审批决策",
    title: "审批与合规",
    pluginName: "tashan-decision-support",
    packageName: "@tashan/plugin-decision-support",
    avatar: "assets/avatars/v1/05-legal-advisor.png",
    category: "审批与合规",
    role: "工具调用、人机确认和审计记录",
    status: "内测",
    scope: "工具与运行事件",
    description: "检查文件读写、浏览器访问、命令执行和外部 API 调用的确认点与留痕要求。",
    tags: ["权限", "审计", "安全"],
    skills: ["风险识别", "审批建议", "审计摘要", "制度对照"],
    mcps: ["权限事件", "工作区文件", "浏览器"],
    permissions: ["读取权限事件", "读取制度文件", "生成审计记录", "高风险操作人工确认"],
    modelPreference: "DeepSeek-V4-Pro",
    prompt: "审计这个工作区可能发生的工具调用、文件读写、浏览器访问和外部 API 使用，列出需要人工确认的权限点和演示时的安全话术。",
  },
  {
    id: "procurement-copilot",
    name: "采购管理",
    title: "采购协同",
    pluginName: "tashan-procurement-copilot",
    packageName: "@tashan/plugin-procurement-copilot",
    avatar: "assets/avatars/v1/01-procurement-specialist.png",
    category: "采购协同",
    role: "采购需求、供应商、报价和流程状态",
    status: "推荐",
    scope: "当前项目空间",
    description: "整合采购需求、供应商信息、价格记录与流程状态，提升采购协同效率。",
    tags: ["采购", "供应商", "流程"],
    skills: ["供应商比对", "报价摘要", "采购流程检查", "异常提示"],
    mcps: ["工作区文件", "表格工具", "浏览器"],
    permissions: ["读取采购资料", "读取表格", "打开供应商网页", "输出风险需人工复核"],
    modelPreference: "DeepSeek-V4-Pro",
    prompt: "作为采购管理数字员工，整理采购需求、供应商信息、报价和流程状态，输出比价表、风险点和下一步协同任务。",
  },
  {
    id: "data-insights",
    name: "数据报表",
    title: "数据洞察",
    pluginName: "tashan-data-insights",
    packageName: "@tashan/plugin-data-insights",
    avatar: "assets/avatars/v1/03-data-analyst.png",
    category: "数据洞察",
    role: "经营报表、专题分析和指标解释",
    status: "已上岗",
    scope: "项目数据文件",
    description: "自动生成经营报表与专题分析，沉淀组织通用分析能力。",
    tags: ["数据", "报表", "分析"],
    skills: ["指标口径", "异常解释", "表格摘要", "图表建议"],
    mcps: ["工作区文件", "表格工具", "浏览器"],
    permissions: ["读取数据文件", "生成分析摘要", "创建图表草案", "敏感指标人工确认"],
    modelPreference: "DeepSeek-V4-Pro",
    prompt: "作为数据报表数字员工，读取当前项目数据，输出关键指标、异常解释、图表建议和下一步分析任务。",
  },
  {
    id: "customer-specialist",
    name: "客户经营",
    title: "销售与商务",
    pluginName: "tashan-customer-specialist",
    packageName: "@tashan/plugin-customer-specialist",
    avatar: "assets/avatars/v1/02-customer-success-manager.png",
    category: "销售与商务",
    role: "客户跟进、线索沉淀和商机推进",
    status: "推荐",
    scope: "客户项目空间",
    description: "深度连接客户档案、跟进记录和销售方法，提升线索转化与客户经营效率。",
    tags: ["客户", "销售", "跟进"],
    skills: ["客户摘要", "跟进建议", "会议纪要", "商机风险"],
    mcps: ["工作区文件", "CRM MCP", "浏览器"],
    permissions: ["读取客户资料", "读取会议记录", "生成跟进任务", "外发内容人工确认"],
    modelPreference: "DeepSeek-V4-Pro",
    prompt: "作为客户经营数字员工，整理客户资料和跟进记录，输出客户摘要、机会点、风险点和下一步跟进话术。",
  },
  {
    id: "marketing-architect",
    name: "市场营销",
    title: "营销与增长",
    pluginName: "tashan-marketing-architect",
    packageName: "@tashan/plugin-marketing-architect",
    avatar: "assets/avatars/v1/09-design-assistant.png",
    category: "营销与增长",
    role: "商业嗅觉、竞品洞察和内容策划",
    status: "推荐",
    scope: "品牌与市场资料",
    description: "敏锐识别商业嗅觉雷达，帮助团队在海量噪声中锁定行业趋势和增长机会。",
    tags: ["市场", "增长", "内容"],
    skills: ["竞品分析", "内容策划", "卖点提炼", "增长假设"],
    mcps: ["浏览器", "工作区文件", "Context7"],
    permissions: ["打开网页", "读取市场资料", "生成营销草案", "发布前人工确认"],
    modelPreference: "DeepSeek-V4-Pro",
    prompt: "作为市场营销数字员工，分析当前市场资料、竞品和客户画像，输出营销主题、内容框架和增长实验建议。",
  },
];
