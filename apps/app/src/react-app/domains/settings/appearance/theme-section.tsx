/** @jsxImportSource react */
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import type { AppearanceViewProps } from "../pages/appearance-view";
import {
  LayoutSectionItem,
  LayoutSectionItemDescription,
  LayoutSectionItemFootnote,
  LayoutSectionItemHeader,
  LayoutSectionItemTitle,
} from "../settings-layout";

type ThemeMode = AppearanceViewProps["themeMode"];

interface ThemeSectionProps
  extends Pick<AppearanceViewProps, "busy" | "themeMode" | "setThemeMode"> {}

export function ThemeSection(props: ThemeSectionProps) {
  return (
    <LayoutSectionItem className="items-center">
      <LayoutSectionItemHeader className="w-full">
        <LayoutSectionItemTitle>{t("settings.theme_title")}</LayoutSectionItemTitle>
        <LayoutSectionItemDescription>{t("settings.appearance_hint")}</LayoutSectionItemDescription>
      </LayoutSectionItemHeader>

      <ThemePicker
        className="pt-1"
        busy={props.busy}
        themeMode={props.themeMode}
        setThemeMode={props.setThemeMode}
      />

      <LayoutSectionItemFootnote>{t("settings.theme_system_hint")}</LayoutSectionItemFootnote>
    </LayoutSectionItem>
  );
}

interface ThemePickerProps {
  className?: string;
  busy: boolean;
  themeMode: ThemeMode;
  setThemeMode: (value: ThemeMode) => void;
}

function ThemePicker(props: ThemePickerProps) {
  return (
    <ToggleGroup
      value={[props.themeMode]}
      onValueChange={(value) => {
        if (value[0] === null) {
          return;
        }

        props.setThemeMode(value[0] as ThemeMode);
      }}
      disabled={props.busy}
      className={cn("w-full gap-6 max-w-xl", props.className)}
    >
      <ThemePickerItem
        value="system"
        label={t("settings.theme_system")}
      >
        <ThemePreview value="system" />
        <ThemePickerLabel>{t("settings.theme_system")}</ThemePickerLabel>
      </ThemePickerItem>
      <ThemePickerItem
        value="light"
        label={t("settings.theme_light")}
      >
        <ThemePreview value="light" className="bg-white" />
        <ThemePickerLabel>{t("settings.theme_light")}</ThemePickerLabel>
      </ThemePickerItem>
      <ThemePickerItem
        value="dark"
        label={t("settings.theme_dark")}
      >
        <ThemePreview value="dark" className="bg-zinc-950" />
        <ThemePickerLabel>{t("settings.theme_dark")}</ThemePickerLabel>
      </ThemePickerItem>
    </ToggleGroup>
  );
}

interface ThemePickerItemProps {
  value: ThemeMode;
  label: string;
  children: ReactNode;
}

function ThemePickerItem(props: ThemePickerItemProps) {
  return (
    <ToggleGroupItem
      value={props.value}
      aria-label={props.label}
      className="group/theme h-auto flex-1 flex-col gap-3 rounded-sm p-0 hover:bg-transparent aria-pressed:bg-transparent"
    >
      {props.children}
    </ToggleGroupItem>
  );
}

interface ThemePreviewProps {
  value: ThemeMode;
  className?: string;
}

function ThemePreview(props: ThemePreviewProps) {
  const isDark = props.value === "dark";
  const shell = isDark ? "bg-zinc-900" : "bg-zinc-50";
  const panel = isDark ? "bg-zinc-800" : "bg-white";
  const muted = isDark ? "bg-zinc-700" : "bg-zinc-200";
  const text = isDark ? "bg-zinc-500" : "bg-zinc-300";

  return (
    <div
      className={cn(
        "aspect-4/3 w-full overflow-hidden rounded-xl border transition-shadow group-data-pressed/theme:ring-2 group-data-pressed/theme:ring-primary group-data-pressed/theme:ring-offset-2 group-data-pressed/theme:ring-offset-background group-hover/theme:ring-1 group-hover/theme:ring-primary/40 group-hover/theme:ring-offset-2 group-hover/theme:ring-offset-background",
        props.className,
      )}
    >
      {props.value === "system" && (
        <div className="flex h-full">
          <ThemePreviewMock dark={false} />
          <ThemePreviewMock dark />
        </div>
      )}
      {props.value !== "system" ? (
        <div className={cn("h-full p-3", shell)}>
          <div className={cn("flex h-full overflow-hidden rounded-lg border", isDark ? "border-zinc-700" : "border-zinc-200")}>
            <div className={cn("w-1/3 border-r p-2", panel, isDark ? "border-zinc-700" : "border-zinc-200")}>
              <div className={cn("mb-3 h-2 w-10 rounded-full", text)} />
              <div className={cn("mb-2 h-5 rounded-md", muted)} />
              <div className={cn("mb-2 h-5 rounded-md opacity-70", muted)} />
              <div className={cn("h-5 rounded-md opacity-50", muted)} />
            </div>
            <div className="flex-1 p-3">
              <div className={cn("mb-3 h-3 w-24 rounded-full", text)} />
              <div className={cn("mb-2 h-2 w-full rounded-full", muted)} />
              <div className={cn("mb-5 h-2 w-4/5 rounded-full", muted)} />
              <div className={cn("ml-auto mt-auto h-8 w-28 rounded-2xl", panel)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemePreviewMock(props: { dark: boolean }) {
  const shell = props.dark ? "bg-zinc-950" : "bg-white";
  const panel = props.dark ? "bg-zinc-900" : "bg-zinc-50";
  const muted = props.dark ? "bg-zinc-800" : "bg-zinc-200";
  const text = props.dark ? "bg-zinc-600" : "bg-zinc-300";
  return (
    <div className={cn("h-full flex-1 p-2", shell)}>
      <div className={cn("h-full rounded-lg p-2", panel)}>
        <div className={cn("mb-2 h-2 w-10 rounded-full", text)} />
        <div className={cn("mb-2 h-4 rounded-md", muted)} />
        <div className={cn("mb-2 h-4 rounded-md opacity-70", muted)} />
        <div className={cn("mt-4 h-2 w-2/3 rounded-full", text)} />
      </div>
    </div>
  );
}

interface ThemePickerLabelProps {
  children: string;
}

function ThemePickerLabel(props: ThemePickerLabelProps) {
  return (
    <span className="text-sm text-muted-foreground group-data-pressed/theme:text-foreground">
      {props.children}
    </span>
  );
}
