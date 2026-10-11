// Иконки лендинга: прототип использует webfont Tabler (`<i class="ti ti-send">`), у нас — те же иконки из
// `@tabler/icons-react`. `<Ti n="ti-send" style={…} />` рисует `<i>` с размером от font-size, как у webfont.
import {
  IconArrowRight, IconBolt, IconBrandAppleFilled, IconBrandGooglePlay, IconBrandWhatsapp, IconBuilding, IconBuildingSkyscraper, IconCheck,
  IconChevronDown, IconDatabase, IconDownload, IconFileDescription, IconFileTypePdf, IconFolderCheck, IconFolders, IconGift, IconHomePlus,
  IconLayoutGrid, IconLink, IconLock, IconMapPin, IconMessageCircle, IconPhoto, IconPlus, IconRefresh, IconRuler2, IconSearch, IconSend,
  IconShieldCheck, IconShieldLock, IconUserCheck, IconUsers, IconUsersGroup, IconUsersPlus, IconWorld, IconX, type Icon,
} from "@tabler/icons-react";
import type { CSSProperties } from "react";

const MAP: Record<string, Icon> = {
  "ti-arrow-right": IconArrowRight, "ti-bolt": IconBolt, "ti-brand-apple-filled": IconBrandAppleFilled, "ti-brand-google-play": IconBrandGooglePlay,
  "ti-brand-whatsapp": IconBrandWhatsapp, "ti-building": IconBuilding, "ti-building-skyscraper": IconBuildingSkyscraper, "ti-check": IconCheck,
  "ti-chevron-down": IconChevronDown, "ti-database": IconDatabase, "ti-download": IconDownload, "ti-file-description": IconFileDescription,
  "ti-file-type-pdf": IconFileTypePdf, "ti-folder-check": IconFolderCheck, "ti-folders": IconFolders, "ti-gift": IconGift, "ti-home-plus": IconHomePlus,
  "ti-layout-grid": IconLayoutGrid, "ti-link": IconLink, "ti-lock": IconLock, "ti-map-pin": IconMapPin, "ti-message-circle": IconMessageCircle,
  "ti-photo": IconPhoto, "ti-plus": IconPlus, "ti-refresh": IconRefresh, "ti-ruler-2": IconRuler2, "ti-search": IconSearch, "ti-send": IconSend,
  "ti-shield-check": IconShieldCheck, "ti-shield-lock": IconShieldLock, "ti-user-check": IconUserCheck, "ti-users": IconUsers,
  "ti-users-group": IconUsersGroup, "ti-users-plus": IconUsersPlus, "ti-world": IconWorld, "ti-x": IconX,
};

export function Ti({ n, style }: { n: string; style?: CSSProperties }) {
  const I = MAP[n.trim()];
  return <i className="lp-ti" style={style} aria-hidden="true">{I ? <I size="1em" stroke={2} /> : null}</i>;
}
