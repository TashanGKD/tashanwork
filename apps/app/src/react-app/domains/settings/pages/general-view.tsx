/** @jsxImportSource react */
import {
  ArrowRight,
  ArrowUpRight,
  Cloud,
  Cog,
  FolderLock,
  LifeBuoy,
  MessageCircle,
  Paintbrush,
  Puzzle,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";

import { t } from "../../../../i18n";
import type { SettingsTab } from "../../../../app/types";
import { Button } from "@/components/ui/button";

export type GeneralSettingsViewProps = {
  onNavigateTab: (tab: SettingsTab) => void;
  developerMode: boolean;
  onSendFeedback: () => void;
  onJoinDiscord: () => void;
  onReportIssue: () => void;
};

const workspaceCards: { tab: SettingsTab; icon: typeof Sparkles; title: string; desc: string }[] = [
  { tab: "preferences", icon: Cog, title: "偏好设置", desc: "默认模型、推理显示和上下文压缩。" },
  { tab: "permissions", icon: FolderLock, title: "权限", desc: "授权文件夹和文件访问边界。" },
  { tab: "extensions", icon: Puzzle, title: "数字员工", desc: "角色、插件、MCP、技能包和权限策略。" },
  { tab: "advanced", icon: Wrench, title: "高级", desc: "运行时、执行引擎和开发者选项。" },
];

const globalCards: { tab: SettingsTab; icon: typeof Sparkles; title: string; desc: string }[] = [
  { tab: "ai", icon: Sparkles, title: "模型配置", desc: "连接企业模型、私有模型或 OpenAI 兼容 API。" },
  { tab: "cloud-account", icon: Cloud, title: "云端与组织", desc: "账号、组织和云端连接。" },
  { tab: "appearance", icon: Paintbrush, title: "外观", desc: "主题、字号和显示效果。" },
  { tab: "environment", icon: Terminal, title: "环境变量", desc: "本地密钥、变量和运行路径。" },
  { tab: "updates", icon: RefreshCcw, title: "更新", desc: "应用版本和更新通道。" },
  { tab: "recovery", icon: ShieldCheck, title: "恢复", desc: "重置引导和清理本地数据。" },
];

function SettingsCard(props: {
  icon: typeof Sparkles;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="flex items-center gap-3 rounded-2xl border border-dls-border bg-dls-surface p-4 text-left transition-colors hover:bg-dls-hover"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-dls-border bg-dls-hover">
        <props.icon size={16} className="text-dls-secondary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-dls-text">{props.title}</div>
        <div className="text-[11px] text-dls-secondary">{props.desc}</div>
      </div>
      <ArrowRight size={14} className="shrink-0 text-dls-secondary" />
    </button>
  );
}

export function GeneralSettingsView(props: GeneralSettingsViewProps) {
  return (
    <div className="w-full max-w-3xl space-y-8">
      {/* Project-space settings */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dls-secondary">
          项目空间
        </div>
        <div className="grid grid-cols-2 gap-2">
          {workspaceCards.map((card) => (
            <SettingsCard
              key={card.tab}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              onClick={() => props.onNavigateTab(card.tab)}
            />
          ))}
        </div>
      </div>

      {/* Global settings */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dls-secondary">
          全局
        </div>
        <div className="grid grid-cols-2 gap-2">
          {globalCards.map((card) => (
            <SettingsCard
              key={card.tab}
              icon={card.icon}
              title={card.title}
              desc={card.desc}
              onClick={() => props.onNavigateTab(card.tab)}
            />
          ))}
        </div>
      </div>

      {/* Feedback */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-dls-secondary">
          帮助
        </div>
        <div className="rounded-2xl border border-dls-border bg-dls-surface p-4">
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <LifeBuoy size={14} className="text-dls-secondary" />
                <div className="text-[13px] font-medium text-dls-text">{t("settings.feedback_title")}</div>
              </div>
              <div className="mt-1 max-w-[58ch] text-[11px] text-dls-secondary">{t("settings.feedback_desc")}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={props.onSendFeedback}
              >
                <MessageCircle size={12} />
                {t("settings.send_feedback")}
                <ArrowUpRight size={11} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={props.onJoinDiscord}
              >
                {t("settings.join_discord")}
                <ArrowUpRight size={11} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={props.onReportIssue}
              >
                {t("settings.report_issue")}
                <ArrowUpRight size={11} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
