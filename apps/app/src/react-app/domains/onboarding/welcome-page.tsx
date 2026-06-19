/** @jsxImportSource react */
import type { ReactNode } from "react";
import { ShareIcon, UserGroupIcon } from "@heroicons/react/24/solid";
import { Bot, Code2, Database, FileCheck2, KeyRound, Workflow } from "lucide-react";
import { PaperGrainGradient } from "@openwork/ui/react";

import {
  Page,
  PageBackground,
  PageDescription,
  PageHeader,
  PageTitle,
  PageTitlebarRegion,
} from "@/components/page";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollAreaViewport } from "@/components/ui/scroll-area";

const capabilities = [
  {
    icon: Bot,
    title: "数字员工协作",
    desc: "让不同角色的 AI 员工承担调研、写作、数据和运营任务。",
  },
  {
    icon: Workflow,
    title: "任务流编排",
    desc: "把目标拆成阶段、待办、工具调用和人工确认点。",
  },
  {
    icon: Database,
    title: "资料库索引",
    desc: "围绕本地文件建立可追溯的企业知识工作区。",
  },
  {
    icon: FileCheck2,
    title: "权限确认",
    desc: "文件、命令、浏览器和外部工具调用进入可审计流程。",
  },
  {
    icon: Code2,
    title: "沙箱执行",
    desc: "基于 Tashan CLI 执行代码、文件和浏览器自动化任务。",
  },
  {
    icon: KeyRound,
    title: "模型接入",
    desc: "支持 OpenAI 兼容 API、私有模型和企业模型配置。",
  },
];

function ShowcasePanel() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
          企业知识工作流，
          <br />
          由数字员工执行。
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {capabilities.map((cap) => {
          const Icon = cap.icon;
          return (
          <div
            key={cap.title}
            className="flex flex-col gap-2.5 rounded-xl border border-border p-3"
          >
            <Icon className="size-4 text-muted-foreground" />
            <div className="text-sm font-medium leading-tight text-foreground">
              {cap.title}
            </div>
            <div className="text-xs leading-snug text-muted-foreground">
              {cap.desc}
            </div>
          </div>
        )})}
        <div className="flex flex-col items-start gap-2.5 rounded-xl border border-border p-3">
            <ShareIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="flex flex-col gap-1.5">
              <div className="text-sm font-medium text-foreground">
              技能工具市场
              </div>
              <div className="text-xs leading-snug text-muted-foreground">
              汇总可复用 Skills、MCP、插件和企业工具接入。
              </div>
            </div>
          </div>
        <div className="flex flex-col items-start gap-2.5 rounded-xl border border-border p-3">
          <UserGroupIcon className="size-4 shrink-0 text-muted-foreground" />
          <div className="flex flex-col gap-1.5">
            <div className="text-sm font-medium text-foreground">
              组织与审计
            </div>
            <div className="text-xs leading-snug text-muted-foreground">
              管理工作区、模型、权限、日志和私有化部署。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type WelcomePageProps = {
  onGetStarted: () => void;
  getStartedLabel?: string;
  busy?: boolean;
  error?: string | null;
  manualFolder?: string;
  onManualFolderChange?: (value: string) => void;
  onUseManualFolder?: () => void;
  showManualFolder?: boolean;
};

type OnboardingStepProps = {
  number: string;
  title: string;
  children: ReactNode;
};

function OnboardingStep({ number, title, children }: OnboardingStepProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-sm font-medium text-foreground">
        {number}
      </div>
      <div className="flex flex-col gap-0.5 pt-1">
        <div className="text-base font-medium text-foreground">{title}</div>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export function WelcomePage({
  onGetStarted,
  getStartedLabel,
  busy,
  error,
  manualFolder,
  onManualFolderChange,
  onUseManualFolder,
  showManualFolder,
}: WelcomePageProps) {
  return (
    <Page className="min-h-screen">
      <PageBackground />

      <PageTitlebarRegion />

      <ScrollArea className="relative z-10">
        <ScrollAreaViewport>
          <div className="flex min-h-screen">
            {/* ---- Left: onboarding steps ---- */}
            <div className="flex w-full flex-col items-center justify-center px-8 py-16 lg:w-[45%] lg:px-12">
              <div className="flex w-full max-w-md flex-col gap-10">
                {/* Header */}
                <PageHeader className="text-left">
                  <PageTitle>TashanWork</PageTitle>
                  <PageDescription>本地优先的企业知识工作流、数字员工和私有化执行底座。</PageDescription>
                </PageHeader>

                {/* Steps */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      开始使用
                    </h2>
                  </div>
                  <OnboardingStep number="1" title="选择工作区">
                    授权一个本地文件夹，作为资料、任务和产物的边界。
                  </OnboardingStep>
                  <OnboardingStep number="2" title="连接模型">
                    使用 OpenAI 兼容 API 或企业私有模型驱动数字员工。
                  </OnboardingStep>
                  <OnboardingStep number="3" title="执行与确认">
                    审阅计划、批准敏感工具调用，并保留执行记录。
                  </OnboardingStep>
                </div>

                <div className="space-y-2">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={onGetStarted}
                    disabled={busy}
                  >
                    {busy ? "正在创建工作区..." : (getStartedLabel || "选择工作区文件夹")}
                  </Button>
                  {error ? (
                    <p className="text-center text-xs text-destructive">{error}</p>
                  ) : null}
                  {showManualFolder ? (
                    <div className="rounded-xl border border-dashed border-border p-3">
                      <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                        Daytona folder path
                        <input
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus:border-ring"
                          value={manualFolder ?? ""}
                          onChange={(event) => onManualFolderChange?.(event.target.value)}
                          placeholder="/workspace/my-project"
                        />
                      </label>
                      <Button
                        className="mt-2 w-full"
                        variant="outline"
                        onClick={onUseManualFolder}
                        disabled={busy || !manualFolder?.trim()}
                      >
                        使用这个文件夹
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* ---- Right: shader outer card > white inner card ---- */}
            <div className="hidden lg:flex lg:w-[55%] lg:items-center lg:justify-center lg:p-6">
              <div className="relative w-full max-w-xl overflow-hidden rounded-3xl">
                {/* Shader background */}
                <div className="absolute inset-0 z-0">
                  <PaperGrainGradient
                    className="size-full bg-white"
                    speed={0}
                    scale={1}
                    rotation={0}
                    offsetX={0}
                    offsetY={0}
                    softness={0.5}
                    intensity={0.5}
                    noise={0.25}
                    shape="corners"
                    frame={37706.748}
                    colors={["#0E33D9", "#FF7E2E", "#FFE340", "#000000"]}
                    colorBack="#00000000"
                  />
                </div>

                {/* Inner white card */}
                <div className="relative z-10 m-3 rounded-2xl bg-background p-7">
                  <ShowcasePanel />
                </div>
              </div>
            </div>
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </Page>
  );
}
