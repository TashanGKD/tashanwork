/** @jsxImportSource react */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  Cpu,
  Database,
  FileText,
  Gavel,
  Megaphone,
  PlugZap,
  Search,
  Sparkles,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { t } from "../../../../i18n";
import { TASHAN_DIGITAL_EMPLOYEES, type TashanDigitalEmployee } from "../../../../app/tashan-workbench";
import { Button } from "@/components/ui/button";

import { PluginsView, type PluginsExtensionsStore } from "./plugins-view";

export type ExtensionsSection = "all" | "mcp" | "skills" | "plugins";

type SuggestedPlugin = {
  name: string;
  packageName: string;
  description: string;
  tags: string[];
  aliases?: string[];
  installMode?: "simple" | "guided";
  steps?: Array<{
    title: string;
    description: string;
    command?: string;
    url?: string;
    path?: string;
    note?: string;
  }>;
};

export type ExtensionsViewProps = {
  busy: boolean;
  selectedWorkspaceRoot: string;
  isRemoteWorkspace: boolean;
  canEditPlugins: boolean;
  canUseGlobalScope: boolean;
  accessHint?: string | null;
  suggestedPlugins: SuggestedPlugin[];
  extensions: PluginsExtensionsStore;
  mcpConnectedAppsCount: number;
  /** The MCP view (quick-connect grid + configured servers). Skills are injected into it. */
  mcpView: ReactNode;
  /** The native Skills catalog, embedded as a secondary tab under digital employees. */
  skillsView?: ReactNode;
  /** Organization marketplace content, rendered in the same Extensions pane. */
  cloudMarketplaceView?: ReactNode;
  onRefresh: () => void;
  initialSection?: ExtensionsSection;
  setSectionRoute?: (tab: "mcp" | "skills" | "plugins") => void;
  showHeader?: boolean;
};

const categoryIcons: Record<string, typeof Sparkles> = {
  "企业知识库": Database,
  "研究与内容": FileText,
  "数据洞察": BarChart3,
  "经营分析": BarChart3,
  "采购协同": BriefcaseBusiness,
  "销售与商务": Users,
  "审批与合规": Gavel,
  "协同执行": Workflow,
  "营销与增长": Megaphone,
};

const sectionToView = (section?: ExtensionsSection) => {
  if (section === "mcp" || section === "skills" || section === "plugins") return section;
  return "employees";
};

export function ExtensionsView(props: ExtensionsViewProps) {
  const [view, setView] = useState<"employees" | "skills" | "mcp" | "plugins">(
    sectionToView(props.initialSection),
  );
  const [selectedEmployee, setSelectedEmployee] = useState<TashanDigitalEmployee | null>(null);
  const pluginCount = useMemo(
    () => props.extensions.pluginList().length,
    [props.extensions],
  );
  const onboardedCount = TASHAN_DIGITAL_EMPLOYEES.filter((employee) => employee.status === "已上岗").length;

  useEffect(() => {
    setView(sectionToView(props.initialSection));
  }, [props.initialSection]);

  const selectView = (next: typeof view) => {
    setView(next);
    if (next === "employees") return;
    props.setSectionRoute?.(next);
  };

  return (
    <section className="w-full max-w-6xl space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-dls-hover px-3 py-1 text-xs font-medium text-dls-secondary">
            <Sparkles size={13} />
            <span>{onboardedCount} 名数字员工已上岗</span>
          </div>
          {props.mcpConnectedAppsCount > 0 ? (
            <div className="inline-flex items-center gap-2 rounded-full bg-green-3 px-3 py-1">
              <div className="size-2 rounded-full bg-green-9" />
              <span className="text-xs font-medium text-green-11">
                {t("extensions.app_count", { count: props.mcpConnectedAppsCount })}
              </span>
            </div>
          ) : null}
        </div>
        <Button variant="outline" onClick={props.onRefresh}>
          {t("common.refresh")}
        </Button>
      </div>

      <div className="flex w-fit flex-wrap rounded-2xl border border-dls-border bg-dls-surface p-1 shadow-sm">
        {([
          ["employees", "数字员工"],
          ["skills", "技能库"],
          ["mcp", "MCP 工具"],
          ["plugins", "原生插件"],
        ] as const).map(([key, label]) => (
          <Button
            key={key}
            variant={view === key ? "secondary" : "ghost"}
            size="sm"
            className="rounded-xl"
            onClick={() => selectView(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {view === "employees" ? (
        <>
          <div className="rounded-2xl border border-dls-border bg-dls-surface p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-dls-text">数字员工</h2>
                <p className="mt-1 text-sm text-dls-secondary">按业务角色组合提示词、技能、MCP、权限和模型偏好。</p>
              </div>
              <div className="flex gap-2">
                <Button className="rounded-xl" size="sm" onClick={() => selectView("skills")}>
                  <BookOpen size={14} />
                  管理技能
                </Button>
                <Button className="rounded-xl" variant="outline" size="sm" onClick={() => selectView("mcp")}>
                  <PlugZap size={14} />
                  连接工具
                </Button>
              </div>
            </div>
            <div className="relative mt-4">
              <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dls-secondary" />
              <input
                className="w-full rounded-2xl border border-dls-border bg-dls-hover py-3 pl-11 pr-4 text-sm text-dls-text placeholder:text-dls-secondary focus:outline-none focus:ring-2 focus:ring-[rgba(var(--dls-accent-rgb),0.14)]"
                placeholder="AI 搜索：输入业务角色、资料类型或工具能力"
                readOnly
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {TASHAN_DIGITAL_EMPLOYEES.map((employee) => {
              const Icon = categoryIcons[employee.category] ?? Sparkles;
              return (
                <article
                  key={employee.name}
                  className="group flex min-h-[228px] flex-col rounded-2xl border border-dls-border bg-dls-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-dls-accent/40 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={employee.avatar}
                      alt=""
                      className="size-11 rounded-full border border-dls-border bg-dls-hover object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[15px] font-semibold text-dls-text">{employee.name}</h3>
                        <span className="shrink-0 rounded-full bg-dls-hover px-2 py-0.5 text-[10px] font-medium text-dls-secondary">
                          {employee.status}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-dls-secondary">{employee.title}</p>
                    </div>
                  </div>

                  <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-dls-hover px-2.5 py-1 text-[11px] font-medium text-dls-secondary">
                    <Icon size={12} />
                    {employee.category}
                  </div>
                  <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-dls-secondary">{employee.description}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {employee.skills.slice(0, 3).map((skill) => (
                      <span key={skill} className="rounded-full border border-dls-border bg-dls-hover px-2 py-0.5 text-[11px] text-dls-secondary">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                    <Button
                      className="rounded-xl"
                      size="sm"
                      variant={employee.status === "已上岗" ? "secondary" : "default"}
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      {employee.status === "已上岗" ? "配置" : "上岗"}
                    </Button>
                    <Button className="rounded-xl" size="sm" variant="outline" onClick={() => setSelectedEmployee(employee)}>
                      详情
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          {selectedEmployee ? (
            <EmployeeDetailPanel
              employee={selectedEmployee}
              onClose={() => setSelectedEmployee(null)}
              onOpenSkills={() => selectView("skills")}
              onOpenMcp={() => selectView("mcp")}
            />
          ) : null}
        </>
      ) : view === "skills" ? (
        props.skillsView ?? (
          <div className="rounded-xl border border-dashed border-dls-border px-5 py-10 text-center text-sm text-dls-secondary">
            技能库暂不可用。
          </div>
        )
      ) : view === "mcp" ? (
        props.mcpView
      ) : (
        <details className="group" open>
          <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-2 text-sm font-medium text-dls-secondary transition-colors hover:text-dls-text">
            <Cpu size={14} />
            <span>原生插件配置</span>
            <span className="text-[11px] text-dls-secondary">({pluginCount})</span>
          </summary>
          <div className="mt-3">
            <PluginsView
              extensions={props.extensions}
              busy={props.busy}
              selectedWorkspaceRoot={props.selectedWorkspaceRoot}
              canEditPlugins={props.canEditPlugins}
              canUseGlobalScope={props.canUseGlobalScope}
              accessHint={props.accessHint}
              suggestedPlugins={props.suggestedPlugins}
            />
          </div>
        </details>
      )}

    </section>
  );
}

function EmployeeDetailPanel(props: {
  employee: TashanDigitalEmployee;
  onClose: () => void;
  onOpenSkills: () => void;
  onOpenMcp: () => void;
}) {
  const sections = [
    ["挂载 Skills", props.employee.skills],
    ["挂载 MCP", props.employee.mcps],
    ["权限策略", props.employee.permissions],
  ] as const;

  return (
    <div className="rounded-[24px] border border-dls-border bg-dls-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <img src={props.employee.avatar} alt="" className="size-16 rounded-2xl border border-dls-border bg-dls-hover object-cover" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight text-dls-text">{props.employee.name}</h3>
              <span className="rounded-full bg-dls-hover px-2.5 py-1 text-[11px] font-medium text-dls-secondary">{props.employee.status}</span>
            </div>
            <p className="mt-1 text-sm text-dls-secondary">{props.employee.role}</p>
            <div className="mt-2 font-mono text-[11px] text-dls-secondary">{props.employee.packageName}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="rounded-xl" onClick={props.onClose} aria-label="关闭详情">
          <X size={16} />
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {sections.map(([title, items]) => (
          <div key={title} className="rounded-2xl border border-dls-border bg-dls-hover/50 p-4">
            <div className="text-sm font-semibold text-dls-text">{title}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {items.map((item) => (
                <span key={item} className="rounded-full border border-dls-border bg-dls-surface px-2 py-0.5 text-[11px] text-dls-secondary">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-dls-border bg-dls-hover/50 p-4">
          <div className="text-sm font-semibold text-dls-text">模型偏好</div>
          <div className="mt-2 text-sm text-dls-secondary">{props.employee.modelPreference}</div>
        </div>
        <div className="rounded-2xl border border-dls-border bg-dls-hover/50 p-4">
          <div className="text-sm font-semibold text-dls-text">Persona Prompt</div>
          <div className="mt-2 line-clamp-3 text-xs leading-relaxed text-dls-secondary">{props.employee.prompt}</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button className="rounded-xl" size="sm" onClick={props.onOpenSkills}>查看技能库</Button>
        <Button className="rounded-xl" size="sm" variant="outline" onClick={props.onOpenMcp}>查看 MCP 工具</Button>
      </div>
    </div>
  );
}
