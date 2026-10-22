"use client";

// Поле пароля с «глазом» (22.10.2026, просьба пользователя): кнопка справа показывает/скрывает введённое — как в Google/Apple.
// Общий примитив для входа, «Задайте пароль», приглашения; в профиле свой переключатель сразу на три поля (оставлен).
import { useState, type InputHTMLAttributes } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { wrapClass?: string };

export function PasswordInput({ className = "", wrapClass = "", ...rest }: Props) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const label = show ? t.login.hidePw : t.login.showPw;
  return (
    <span className={`relative block ${wrapClass}`}>
      <input {...rest} type={show ? "text" : "password"} className={`${className} pr-[42px]`} />
      <button type="button" onClick={() => setShow((v) => !v)} title={label} aria-label={label} aria-pressed={show} tabIndex={-1}
        className="absolute right-[6px] top-1/2 flex h-[32px] w-[32px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-muted hover:bg-bg-2 hover:text-ink">
        {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
      </button>
    </span>
  );
}
