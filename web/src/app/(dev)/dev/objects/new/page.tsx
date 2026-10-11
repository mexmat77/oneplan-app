"use client";

// Добавление объекта. По умолчанию — мастер «Объект из файлов» (`ImportWizard`: прайс-лист + планы этажей → объект собирается сам);
// `?manual=1` — ручной мастер прототипа (§1.21, `OnePlan v2.dc.html` 1791–1912), он остаётся доступен по ссылке «Заполнить вручную».
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ImportWizard } from "@/components/dev/wizard/ImportWizard";
import { NewObjectWizard } from "@/components/dev/wizard/NewObjectWizard";

function Inner() {
  const sp = useSearchParams();
  return sp.get("manual") === "1" ? <NewObjectWizard /> : <ImportWizard />;
}
export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
