/** @jsxImportSource react */
import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, Cpu, Database, Info, RefreshCcw, Server } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { OpenworkRuntimeConfigStatus, OpenworkServerStatus } from "@/app/lib/openwork-server";
import { isDesktopRuntime } from "@/app/utils";
import { t } from "@/i18n";
import {
  SettingsInset,
  SettingsNotice,
  SettingsStatusBadge,
} from "../settings-section";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItem,
  LayoutSectionItemDescription,
  LayoutSectionItemFootnote,
  LayoutSectionItemHeader,
  LayoutSectionItemHeaderActions,
  LayoutSectionItemTitle,
  LayoutSectionTitle,
} from "../settings-layout";

type SettingsTone = ComponentProps<typeof SettingsStatusBadge>["tone"];

interface RuntimeStatusCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  tone: SettingsTone;
  detailLines?: string[];
}

function RuntimeStatusCard(props: RuntimeStatusCardProps) {
  return (
    <SettingsInset className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gray-6/60 bg-gray-1/70 text-gray-12">
          {props.icon}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-12">{props.title}</div>
          <div className="text-xs text-gray-9">{props.description}</div>
        </div>
      </div>
      <SettingsStatusBadge className="inline-flex min-h-0 justify-start px-0 py-0" tone={props.tone} label={props.statusLabel} />
      {props.detailLines?.length ? (
        <div className="space-y-1 border-t border-gray-6/50 pt-2 text-[11px] text-gray-9">
          {props.detailLines.map((line) => (
            <div key={line} className="truncate" title={line}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
    </SettingsInset>
  );
}

interface AdvancedRuntimeSectionProps {
  clientStatusLabel: string;
  clientTone: SettingsTone;
  clientDetailLines: string[];
  openworkStatusLabel: string;
  openworkTone: SettingsTone;
  openworkDetailLines: string[];
}

export function AdvancedRuntimeSection(props: AdvancedRuntimeSectionProps) {
  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.runtime_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>{t("settings.runtime_desc")}</LayoutSectionDescription>
      </LayoutSectionHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <RuntimeStatusCard
          icon={<Cpu size={18} />}
          title={t("settings.opencode_engine_label")}
          description={t("settings.opencode_engine_desc")}
          statusLabel={props.clientStatusLabel}
          tone={props.clientTone}
          detailLines={props.clientDetailLines}
        />
        <RuntimeStatusCard
          icon={<Server size={18} />}
          title={t("settings.openwork_server_label")}
          description={t("settings.openwork_server_desc")}
          statusLabel={props.openworkStatusLabel}
          tone={props.openworkTone}
          detailLines={props.openworkDetailLines}
        />
      </div>
    </LayoutSection>
  );
}

interface AdvancedRuntimeMigrationSectionProps {
  busy: boolean;
  canMigrate: boolean;
  migrationBusy: boolean;
  migrationStatus: string | null;
  configStatus: OpenworkRuntimeConfigStatus | null;
  configStatusBusy: boolean;
  configStatusError: string | null;
  onRefresh: () => Promise<void>;
  onMigrate: () => Promise<void>;
}

function formatKeys(keys: string[]) {
  return keys.length ? keys.join(", ") : "none";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function countRecord(value: unknown) {
  return isRecord(value) ? Object.keys(value).length : 0;
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function providerModelCount(config: Record<string, unknown>) {
  const providers = isRecord(config.provider) ? config.provider : {};
  return Object.values(providers).reduce<number>((total, provider) => {
    if (!isRecord(provider)) return total;
    return total + countRecord(provider.models);
  }, 0);
}

function RuntimeConfigSummary(props: { config: Record<string, unknown> }) {
  const config = props.config;
  const providers = countRecord(config.provider);
  const models = providerModelCount(config);
  const agents = countRecord(config.agent);
  const plugins = countArray(config.plugin);
  const mcps = countRecord(config.mcp);
  const permissions = countRecord(config.permission);
  const disabledProviders = countArray(config.disabled_providers);
  const defaultAgent = typeof config.default_agent === "string" ? config.default_agent : "not set";

  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">默认数字员工</div>
        <div className="mt-1 truncate font-mono text-[11px] text-gray-12" title={defaultAgent}>{defaultAgent}</div>
      </div>
      <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">提供商 / 模型</div>
        <div className="mt-1 font-mono text-[11px] text-gray-12">{providers} providers, {models} models</div>
      </div>
      <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">员工 / 插件</div>
        <div className="mt-1 font-mono text-[11px] text-gray-12">{agents} agents, {plugins} plugins</div>
      </div>
      <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">MCP / 权限</div>
        <div className="mt-1 font-mono text-[11px] text-gray-12">{mcps} MCPs, {permissions} permission keys</div>
      </div>
      {disabledProviders ? (
        <div className="rounded-lg border border-gray-6 bg-gray-2/60 p-2 sm:col-span-2 lg:col-span-4">
        <div className="text-[10px] uppercase tracking-wide text-gray-8">停用的提供商</div>
          <div className="mt-1 font-mono text-[11px] text-gray-12">{disabledProviders}</div>
        </div>
      ) : null}
    </div>
  );
}

function RuntimeConfigSourceBlock(props: {
  title: string;
  description: string;
  path?: string;
  exists?: boolean;
  keys: string[];
  config: Record<string, unknown>;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-6 bg-gray-1/70 p-3">
      <div>
        <div className="font-medium text-gray-12">{props.title}</div>
        <div className="text-[11px] text-gray-9">{props.description}</div>
        {props.path ? <div className="mt-1 break-all font-mono text-[11px] text-gray-8">{props.path}</div> : null}
        {props.exists !== undefined ? <div className="text-[11px] text-gray-9">{props.exists ? "Found" : "Not found"}</div> : null}
        <div className="text-[11px] text-gray-9">Keys: {formatKeys(props.keys)}</div>
      </div>
      <RuntimeConfigSummary config={props.config} />
      <details className="rounded-lg bg-gray-3 p-2">
        <summary className="cursor-pointer text-[11px] font-medium text-gray-11">Show raw JSON</summary>
        <pre className="mt-2 max-h-56 overflow-auto font-mono text-[11px] text-gray-11">
          {JSON.stringify(props.config, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export function AdvancedRuntimeMigrationSection(props: AdvancedRuntimeMigrationSectionProps) {
  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>Tashan CLI 配置来源</LayoutSectionTitle>
        <LayoutSectionDescription>
          查看 TashanWork 运行时注入的配置，以及项目空间自身配置。
        </LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>迁移运行时托管配置</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>
            将旧版运行时配置迁移到本地运行数据库，减少项目空间里的系统配置残留。
          </LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void props.onRefresh()}
              disabled={props.busy || props.configStatusBusy || !props.canMigrate}
            >
              <RefreshCcw size={14} className={props.configStatusBusy ? "animate-spin" : ""} />
              刷新
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void props.onMigrate()}
              disabled={props.busy || props.migrationBusy || !props.canMigrate}
            >
              <Database size={14} />
              {props.migrationBusy ? "迁移中..." : "迁移"}
            </Button>
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
        {props.migrationStatus ? <SettingsNotice>{props.migrationStatus}</SettingsNotice> : null}
        {props.configStatusError ? <SettingsNotice>{props.configStatusError}</SettingsNotice> : null}
        {props.configStatus ? (
          <div className="space-y-3 rounded-xl border border-gray-6 bg-gray-1/60 p-3 text-xs text-gray-10">
            <div className="space-y-2 rounded-xl border border-blue-6/50 bg-blue-2/40 p-3">
              <div className="font-medium text-gray-12">当前注入的 Tashan CLI 配置</div>
              <div className="text-[11px] text-gray-9">
                这是 TashanWork 在运行时注入的配置对象，包含默认值和本地运行数据库中的设置。
              </div>
              <RuntimeConfigSummary config={props.configStatus.effectiveRuntime ?? props.configStatus.runtime} />
              <details className="rounded-lg bg-gray-3 p-2">
                <summary className="cursor-pointer text-[11px] font-medium text-gray-11">查看原始 JSON</summary>
                <pre className="mt-2 max-h-72 overflow-auto font-mono text-[11px] text-gray-11">
                  {JSON.stringify(props.configStatus.effectiveRuntime ?? props.configStatus.runtime, null, 2)}
                </pre>
              </details>
            </div>
            {props.configStatus.sources ? (
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-gray-12">Tashan CLI 配置拆解</div>
                  <div className="text-[11px] text-gray-9">
                    Tashan CLI 会读取项目和用户级配置；TashanWork 另外注入运行时配置。
                  </div>
                </div>
                <RuntimeConfigSourceBlock
                  title="项目配置"
                  description="项目空间自有的 Tashan CLI 配置。"
                  path={props.configStatus.sources.projectOpencode.path}
                  exists={props.configStatus.sources.projectOpencode.exists}
                  keys={props.configStatus.sources.projectOpencode.keys}
                  config={props.configStatus.sources.projectOpencode.config}
                />
                <RuntimeConfigSourceBlock
                  title="用户级配置"
                  description="用户主目录下的 Tashan CLI 配置。"
                  path={props.configStatus.sources.globalOpencode.path}
                  exists={props.configStatus.sources.globalOpencode.exists}
                  keys={props.configStatus.sources.globalOpencode.keys}
                  config={props.configStatus.sources.globalOpencode.config}
                />
                <RuntimeConfigSourceBlock
                  title="TashanWork 运行数据库"
                  description="存放在项目文件之外的运行时托管配置。"
                  keys={props.configStatus.sources.runtimeDatabase.keys}
                  config={props.configStatus.sources.runtimeDatabase.config}
                />
                <RuntimeConfigSourceBlock
                  title="TashanWork 注入配置"
                  description="TashanWork 在运行时注入给 Tashan CLI 的配置对象。"
                  keys={props.configStatus.sources.injected.keys}
                  config={props.configStatus.sources.injected.config}
                />
              </div>
            ) : null}
            <div>
              <div className="font-medium text-gray-12">运行数据库</div>
              <div>已保存键：{formatKeys(props.configStatus.runtimeKeys)}</div>
            </div>
            <div>
              <div className="font-medium text-gray-12">旧版运行时元数据</div>
              <div className="break-all">{props.configStatus.legacyOpenwork.path}</div>
              {props.configStatus.legacyOpenwork.error ? (
                <div className="text-amber-11">{props.configStatus.legacyOpenwork.error}; 迁移前请先修复此文件。</div>
              ) : null}
              <div>可迁移键：{formatKeys(props.configStatus.legacyOpenwork.keys)}</div>
            </div>
            <div>
              <div className="font-medium text-gray-12">用户级 Tashan CLI 配置</div>
              <div className="break-all">{props.configStatus.userOpencode.path}</div>
              <div>{props.configStatus.userOpencode.exists ? "已找到" : "未找到"}</div>
              <div>用户配置键：{formatKeys(props.configStatus.userOpencode.keys)}</div>
              <div>可迁移键：{formatKeys(props.configStatus.userOpencode.migratableKeys)}</div>
            </div>
            <div>
              <div className="font-medium text-gray-12">运行数据库 JSON</div>
              <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-gray-3 p-2 font-mono text-[11px] text-gray-11">
                {JSON.stringify(props.configStatus.runtime, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </LayoutSectionItem>
    </LayoutSection>
  );
}

interface AdvancedOpencodeSectionProps {
  busy: boolean;
  enabled: boolean;
  onToggle: () => void;
}

export function AdvancedOpencodeSection(props: AdvancedOpencodeSectionProps) {
  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>
          {t("settings.opencode_section_label")}
        </LayoutSectionTitle>
        <LayoutSectionDescription>{t("settings.opencode_engine_desc")}</LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("settings.enable_exa")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>{t("settings.enable_exa_desc")}</LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Switch
              aria-label={t("settings.enable_exa")}
              checked={props.enabled}
              disabled
              onCheckedChange={props.onToggle}
            />
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
        <Alert>
          <Info />
          <AlertDescription>{t("settings.exa_unavailable")}</AlertDescription>
        </Alert>
        <LayoutSectionItemFootnote>{t("settings.exa_restart_hint")}</LayoutSectionItemFootnote>
      </LayoutSectionItem>
    </LayoutSection>
  );
}

interface AdvancedFeatureFlagsSectionProps {
  busy: boolean;
  microsandboxCreateSandboxEnabled: boolean;
  onToggleMicrosandboxCreateSandbox: () => void;
}

export function AdvancedFeatureFlagsSection(props: AdvancedFeatureFlagsSectionProps) {
  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>Feature flags</LayoutSectionTitle>
        <LayoutSectionDescription>Experimental controls for sandbox and workspace behaviors.</LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>Create Sandbox uses microsandbox image</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>
            When enabled, Create Sandbox launches the detached worker with the microsandbox image flow instead of the default Docker image flow.
          </LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Switch
              aria-label="Create Sandbox uses microsandbox image"
              checked={props.microsandboxCreateSandboxEnabled}
              disabled={props.busy || !isDesktopRuntime()}
              onCheckedChange={props.onToggleMicrosandboxCreateSandbox}
            />
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
      </LayoutSectionItem>
    </LayoutSection>
  );
}

interface AdvancedDeveloperSectionProps {
  busy: boolean;
  developerMode: boolean;
  opencodeDevModeEnabled: boolean;
  deepLinkOpen: boolean;
  deepLinkInput: string;
  deepLinkBusy: boolean;
  deepLinkStatus: string | null;
  onToggleDeveloperMode: () => void;
  onToggleDeepLink: () => void;
  onDeepLinkInput: (input: string) => void;
  onSubmitDeepLink: () => Promise<void>;
}

export function AdvancedDeveloperSection(props: AdvancedDeveloperSectionProps) {
  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.developer")}</LayoutSectionTitle>
      </LayoutSectionHeader>

      <LayoutSectionItem>
        <LayoutSectionItemHeader>
          <LayoutSectionItemTitle>{t("settings.developer_mode_title")}</LayoutSectionItemTitle>
          <LayoutSectionItemDescription>{t("settings.developer_mode_desc")}</LayoutSectionItemDescription>
          <LayoutSectionItemHeaderActions>
            <Switch
              aria-label={t("settings.developer_mode_title")}
              checked={props.developerMode}
              onCheckedChange={props.onToggleDeveloperMode}
            />
          </LayoutSectionItemHeaderActions>
        </LayoutSectionItemHeader>
      </LayoutSectionItem>

      {isDesktopRuntime() && props.opencodeDevModeEnabled && props.developerMode ? (
        <LayoutSectionItem>
          <LayoutSectionItemHeader>
            <LayoutSectionItemTitle>{t("settings.open_deeplink_title")}</LayoutSectionItemTitle>
            <LayoutSectionItemDescription>{t("settings.open_deeplink_desc")}</LayoutSectionItemDescription>
            <LayoutSectionItemHeaderActions>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={props.onToggleDeepLink}
                disabled={props.busy || props.deepLinkBusy}
              >
                {props.deepLinkOpen ? t("common.hide") : t("settings.open_deeplink_button")}
              </Button>
            </LayoutSectionItemHeaderActions>
          </LayoutSectionItemHeader>

          {props.deepLinkOpen ? (
            <div className="space-y-3">
              <Field>
                <FieldLabel htmlFor="advanced-debug-deep-link">{t("settings.open_deeplink_title")}</FieldLabel>
                <Textarea
                  id="advanced-debug-deep-link"
                  value={props.deepLinkInput}
                  onChange={(event) => props.onDeepLinkInput(event.currentTarget.value)}
                  rows={3}
                  placeholder="openwork://..."
                  className="font-mono text-xs"
                />
              </Field>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void props.onSubmitDeepLink()}
                  disabled={props.busy || props.deepLinkBusy || !props.deepLinkInput.trim()}
                >
                  {props.deepLinkBusy ? t("settings.opening") : t("settings.open_deeplink_action")}
                </Button>
                <div className="text-xs text-gray-8">{t("settings.deeplink_hint")}</div>
              </div>
            </div>
          ) : null}

          {props.deepLinkStatus ? <SettingsNotice>{props.deepLinkStatus}</SettingsNotice> : null}
        </LayoutSectionItem>
      ) : null}
    </LayoutSection>
  );
}

interface AdvancedConnectionSectionProps {
  busy: boolean;
  headerStatus: string;
  baseUrl: string;
  openworkServerUrl: string;
  openworkServerStatus: OpenworkServerStatus;
  openworkReconnectBusy: boolean;
  isLocalEngineRunning: boolean;
  restartBusy: boolean;
  reconnectStatus: string | null;
  reconnectError: string | null;
  restartStatus: string | null;
  restartError: string | null;
  onReconnect: () => Promise<void>;
  onRestart: () => Promise<void>;
  onStopHost: () => void;
}

export function AdvancedConnectionSection(props: AdvancedConnectionSectionProps) {
  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>{t("settings.connection_title")}</LayoutSectionTitle>
        <LayoutSectionDescription>{props.headerStatus}</LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem className="gap-3">
        <div className="break-all font-mono text-xs text-gray-8">{props.baseUrl}</div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void props.onReconnect()}
            disabled={props.busy || props.openworkReconnectBusy || !props.openworkServerUrl.trim()}
          >
            <RefreshCcw size={14} className={props.openworkReconnectBusy ? "animate-spin" : ""} />
            {props.openworkReconnectBusy ? t("settings.reconnecting") : t("settings.reconnect_server")}
          </Button>

          {props.isLocalEngineRunning ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void props.onRestart()}
              disabled={props.busy || props.restartBusy}
            >
              <RefreshCcw size={14} className={props.restartBusy ? "animate-spin" : ""} />
              {props.restartBusy ? t("settings.restarting") : t("settings.restart_openwork_server")}
            </Button>
          ) : null}

          {props.isLocalEngineRunning ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={props.onStopHost}
              disabled={props.busy}
            >
              <CircleAlert size={14} />
              {t("settings.stop_local_server")}
            </Button>
          ) : null}

          {!props.isLocalEngineRunning && props.openworkServerStatus === "connected" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={props.onStopHost}
              disabled={props.busy}
            >
              {t("settings.disconnect_server")}
            </Button>
          ) : null}
        </div>

        {props.reconnectStatus ? <SettingsNotice>{props.reconnectStatus}</SettingsNotice> : null}
        {props.reconnectError ? <SettingsNotice tone="error">{props.reconnectError}</SettingsNotice> : null}
        {props.restartStatus ? <SettingsNotice>{props.restartStatus}</SettingsNotice> : null}
        {props.restartError ? <SettingsNotice tone="error">{props.restartError}</SettingsNotice> : null}
      </LayoutSectionItem>
    </LayoutSection>
  );
}
