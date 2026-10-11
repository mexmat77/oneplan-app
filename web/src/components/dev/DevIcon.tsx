"use client";

// Tabler webfont class names used in the v2 mocks (`ti-…`) → icon components.
import {
  IconBell, IconBuildingPlus, IconCheck, IconClockHour4, IconFile, IconPhoto, IconRefresh, IconTag, type IconProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

const ICONS: Record<string, ComponentType<IconProps>> = {
  "ti-check": IconCheck, "ti-clock-hour-4": IconClockHour4, "ti-tag": IconTag, "ti-refresh": IconRefresh,
  "ti-photo": IconPhoto, "ti-file": IconFile, "ti-building-plus": IconBuildingPlus,
};

export function DevIcon({ icon, size = 17 }: { icon: string; size?: number }) {
  const Icon = ICONS[icon] ?? IconBell;
  return <Icon size={size} />;
}
