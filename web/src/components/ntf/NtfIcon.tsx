"use client";

// Maps the prototype's Tabler class names (`ti-…`) used in NTFDATA to icon components.
import {
  IconBell, IconBuildingCommunity, IconBuildingPlus, IconCircleCheck, IconEye, IconFlag, IconFlagCheck, IconHeart, IconHeartDown, IconHeartExclamation,
  IconHomePlus, IconHomeSearch, IconLink, IconLockOpen, IconMessageCircle, IconRefresh, IconTag, IconTargetArrow, IconUserCheck, IconUserPlus, type IconProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

const ICONS: Record<string, ComponentType<IconProps>> = {
  "ti-eye": IconEye, "ti-heart": IconHeart, "ti-heart-down": IconHeartDown, "ti-heart-exclamation": IconHeartExclamation,
  "ti-home-plus": IconHomePlus, "ti-home-search": IconHomeSearch, "ti-link": IconLink, "ti-message-circle": IconMessageCircle,
  "ti-target-arrow": IconTargetArrow, "ti-user-plus": IconUserPlus,
  // реальные уведомления (lib/notifications/client.ts)
  "ti-lock-open": IconLockOpen, "ti-flag": IconFlag, "ti-flag-check": IconFlagCheck, "ti-user-check": IconUserCheck, "ti-circle-check": IconCircleCheck,
  "ti-building-community": IconBuildingCommunity, "ti-building-plus": IconBuildingPlus, "ti-refresh": IconRefresh, "ti-tag": IconTag,
};

export function NtfIcon({ icon, size = 17 }: { icon: string; size?: number }) {
  const Icon = ICONS[icon] ?? IconBell;
  return <Icon size={size} />;
}
