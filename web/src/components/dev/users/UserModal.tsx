"use client";

// User form modal «Новый пользователь / Изменить пользователя» (prototype lines 1940–1991; logic 3223, 3320, 3343–3380, 4065–4090).
// Mount only while open — the form state is initialised from the store on mount.
import { useState } from "react";
import { IconCopy, IconRefresh, IconSearch, IconShieldLock, IconUserPlus, IconX } from "@tabler/icons-react";
import { Modal } from "@/components/ui/Modal";
import { useDevT } from "@/i18n/dev";
import type { DevUser } from "@/lib/dev/types";
import { getDev, nextUserId, upsertUser, useDev } from "@/store/dev";
import { copyText, genPassword, useRoleFlags } from "./shared";

type Role = DevUser["role"];
type Props = { coId: number | null; editId?: number | null; onClose: () => void };

export function UserModal({ coId, editId = null, onClose }: Props) {
  const { t } = useDevT();
  const CO = t.co;
  const roles = t.roles as Record<string, string>;
  const { companies, projects } = useDev();
  const { role: viewRole, ufShowCompanies } = useRoleFlags();

  const [init] = useState(() => {
    const u = editId != null ? getDev().users.find((x) => x.id === editId) : undefined;
    return u
      ? { role: u.role as Role, name: u.fio, mail: u.mail, access: Array.isArray(u.access) ? u.access.slice() : [], cos: (u.companyIds || []).slice(), until: u.until && u.until !== "—" ? u.until : "", platform: !!u.platform }
      : { role: "editor" as Role, name: "", mail: "", access: [] as number[], cos: coId ? [coId] : [], until: "", platform: false };
  });
  const [role, setRoleState] = useState<Role>(init.role);
  const [name, setName] = useState(init.name);
  const [tried, setTried] = useState(false); // попытка сохранить с пустыми обязательными полями — подсветка
  const mailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const badSt = (bad: boolean) => (bad ? { borderColor: "#dc2626", background: "#fdecec" } : undefined);
  const [mail, setMail] = useState(init.mail);
  const [access, setAccess] = useState<number[]>(init.access);
  const [cos, setCos] = useState<number[]>(init.cos);
  const [platform, setPlatform] = useState(init.platform);
  const [pass, setPass] = useState("");
  const [copied, setCopied] = useState(false);
  const [coSearch, setCoSearch] = useState("");
  const [roleInfo, setRoleInfo] = useState(false);

  const setRole = (r: Role) => {
    setRoleState(r);
    if (r === "admin" && cos.length > 1) setCos(cos.slice(0, 1));
    if (r !== "client") setAccess([]);
  };
  const singleCo = role === "admin";
  const toggleCo = (id: number) => setCos((c) => (singleCo ? [id] : c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const toggleObj = (id: number) => setAccess((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
  const gen = () => { setPass(genPassword()); setCopied(false); };
  const copy = () => { if (!pass) return; copyText(pass); setCopied(true); setTimeout(() => setCopied(false), 1600); };

  const q = coSearch.trim().toLowerCase();
  const coFiltered = companies.filter((c) => !q || (c.name || "").toLowerCase().includes(q));
  const coSorted = coFiltered.slice().sort((a, b) => ((cos.includes(a.id) ? 0 : 1) - (cos.includes(b.id) ? 0 : 1)) || (a.name || "").localeCompare(b.name || ""));
  const coAll = companies.length > 0 && cos.length >= companies.length;
  const coSome = cos.length > 0 && !coAll;
  const toggleAllCo = () => setCos(cos.length >= companies.length ? [] : companies.map((c) => c.id));
  const showSelectAll = !singleCo && companies.length > 1;
  const coEmpty = coFiltered.length === 0 && companies.length > 0;

  const selCoIds = cos.length ? cos : coId ? [coId] : [];
  const objIds = selCoIds.flatMap((cid) => companies.find((c) => c.id === cid)?.objIds ?? []);
  const objName = (id: number) => projects.find((p) => p.id === id)?.name ?? `#${id}`;
  const showObjects = role === "client" && objIds.length > 0;
  const showPlatform = role === "editor" && viewRole === "superadmin";

  const save = () => {
    if (!name.trim() || !mailOk(mail)) { setTried(true); return; }
    let cids = cos.slice();
    if (role === "admin") cids = cids.slice(0, 1);
    if (!cids.length && coId) cids = [coId];
    const acc: DevUser["access"] = role === "client" ? (access.length ? access.slice() : "all") : "all";
    const until = role === "client" ? init.until.trim() || "—" : "—";
    const plat = role === "editor" ? platform : false;
    const base = { companyIds: cids, role, fio: name.trim() || "—", mail: mail.trim() || "—", access: acc, until, platform: plat };
    const prev = editId != null ? getDev().users.find((x) => x.id === editId) : undefined;
    upsertUser(prev ? { ...prev, ...base } : { id: nextUserId(), ...base, active: true });
    onClose();
  };

  const box = (on: boolean) => `flex cursor-pointer items-center gap-[9px] rounded-[10px] border px-[11px] py-[9px] text-[13.5px] ${on ? "border-blue bg-blue-tint" : "border-line bg-surface"}`;
  const tick = (on: boolean, round = false) => `flex h-[18px] w-[18px] flex-none items-center justify-center border text-[12px] text-white ${round ? "rounded-full" : "rounded-[5px]"} ${on ? "border-blue bg-blue" : "border-[#c5cbd6] bg-transparent"}`;
  const label = (text: string) => <label className="mb-[6px] block text-[13px] text-text-2">{text}</label>;
  const input = "w-full rounded-[10px] border border-line px-3 py-[11px] text-[14px] outline-none focus:border-blue";

  return (
    <Modal open onClose={onClose} width={540} z={130} overlay={0.5} padding="26px" sheet={false} anim="none">
      <div className="mb-[18px] flex items-center gap-3">
        <h3 className="flex-1 text-[19px] font-extrabold text-ink">{editId != null ? CO.edit_title : CO.nu_title}</h3>
        <button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] bg-bg-2 text-[17px] text-text-2"><IconX size={17} /></button>
      </div>

      <div className="mb-[9px] flex items-center gap-2">
        <label className="text-[13px] text-text-2">{CO.nu_role}</label>
        <button type="button" onClick={() => setRoleInfo((v) => !v)} title={CO.role_more} className={`flex h-5 w-5 flex-none cursor-pointer items-center justify-center rounded-full border text-[12px] font-extrabold ${roleInfo ? "border-blue bg-blue text-white" : "border-[#cdd5e2] bg-surface text-muted"}`}>?</button>
      </div>
      <div className="mb-[11px] flex flex-wrap gap-[9px]">
        {(["admin", "editor", "client"] as Role[]).map((r) => (
          <button key={r} type="button" onClick={() => setRole(r)} className={`min-w-[110px] flex-1 cursor-pointer whitespace-nowrap rounded-[11px] border-[1.5px] px-[14px] py-3 text-center text-[14px] font-bold ${role === r ? "border-blue bg-[#f5f8ff] text-ink" : "border-line bg-surface text-text-2"}`}>{roles[r]}</button>
        ))}
      </div>
      {roleInfo && (
        <div className="mb-4 rounded-[11px] bg-[#f0f4ff] px-[14px] py-3">
          {(["admin", "editor", "client"] as Role[]).map((r) => (
            <div key={r} className="mb-[5px] text-[12px] leading-[1.45] text-[#4a5568]"><b className="text-ink">{roles[r]}</b> — {(CO as unknown as Record<string, string>)[`role_${r}_d`]}</div>
          ))}
        </div>
      )}

      <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <div>{label(CO.nu_name)}<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" className={input} style={badSt(tried && !name.trim())} /></div>
        <div>{label(CO.nu_mail)}<input value={mail} onChange={(e) => setMail(e.target.value)} type="email" placeholder="user@mail.com" className={input} style={badSt(tried && !mailOk(mail))} /></div>
      </div>

      <div className="mb-4">
        {label(CO.nu_pass)}
        <div className="flex flex-wrap gap-[9px]">
          <input value={pass} onChange={(e) => { setPass(e.target.value); setCopied(false); }} placeholder="••••••••" className="min-w-[150px] flex-1 rounded-[10px] border border-line px-3 py-[11px] font-mono text-[15px] tracking-[.03em] outline-none focus:border-blue" />
          <button type="button" onClick={gen} className="inline-flex flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-blue bg-blue-tint px-[15px] text-[13px] font-bold text-[#2f5fe0] hover:bg-[#e0e9ff]"><IconRefresh size={15} /> {CO.nu_gen}</button>
          {!!pass && <button type="button" onClick={copy} className="inline-flex flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-line bg-surface px-[14px] text-[13px] font-semibold text-text-2 hover:bg-[#f6f8fb]"><IconCopy size={15} /> {copied ? CO.nu_copied : CO.nu_copy}</button>}
        </div>
        <div className="mt-[7px] text-[11.5px] text-muted">{CO.nu_pass_hint}</div>
      </div>

      {ufShowCompanies && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2"><label className="flex-1 text-[13px] text-text-2">{CO.nu_companies}</label><span className="text-[11.5px] text-muted">{CO.nu_co_sel}: {cos.length} / {companies.length}</span></div>
          <div className="mb-[9px] flex gap-2">
            <div className="relative flex-1">
              <IconSearch size={14} className="pointer-events-none absolute left-[10px] top-1/2 -translate-y-1/2 text-[#9aa1ac]" />
              <input value={coSearch} onChange={(e) => setCoSearch(e.target.value)} placeholder={CO.nu_co_search} className="w-full rounded-[10px] border border-line py-[9px] pl-[31px] pr-[10px] text-[13px] outline-none focus:border-blue" />
            </div>
            {showSelectAll && (
              <button type="button" onClick={toggleAllCo} className={`flex flex-none cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[10px] border px-[13px] py-[9px] text-[13px] font-semibold ${coAll ? "border-blue bg-blue-tint text-[#2f5fe0]" : "border-line bg-surface text-text-2"}`}>
                <span className={`flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] border text-[11px] text-white ${coAll || coSome ? "border-blue bg-blue" : "border-[#c5cbd6] bg-transparent"}`}>{coAll ? "✓" : coSome ? "–" : ""}</span>{CO.nu_co_all}
              </button>
            )}
          </div>
          <div className="max-h-[210px] overflow-auto rounded-[12px] border border-line-2 bg-[#fbfcfe] p-[9px]">
            {coEmpty ? (
              <div className="px-[10px] py-[18px] text-center text-[13px] text-[#9aa1ac]">{CO.nu_co_empty}</div>
            ) : (
              <div className="grid gap-[9px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(178px,1fr))" }}>
                {coSorted.map((c) => { const on = cos.includes(c.id); return (
                  <div key={c.id} onClick={() => toggleCo(c.id)} className={box(on)}><span className={tick(on, singleCo)}>{on ? "✓" : ""}</span><span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{c.name}</span></div>
                ); })}
              </div>
            )}
          </div>
          <div className="mt-2 text-[11.5px] text-muted">{CO.nu_companies_hint}</div>
        </div>
      )}

      {showObjects && (
        <div className="mb-4">
          <label className="mb-2 block text-[13px] text-text-2">{CO.nu_access}</label>
          <div className="grid gap-[9px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))" }}>
            {objIds.map((id) => { const on = access.includes(id); return (
              <div key={id} onClick={() => toggleObj(id)} className={box(on)}><span className={tick(on)}>{on ? "✓" : ""}</span><span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{objName(id)}</span></div>
            ); })}
          </div>
        </div>
      )}

      {showPlatform && (
        <div className="mb-4">
          <div onClick={() => setPlatform((v) => !v)} className={`flex cursor-pointer items-start gap-[11px] rounded-[12px] border-[1.5px] px-[14px] py-[13px] ${platform ? "border-blue bg-[#f5f8ff]" : "border-line bg-surface"}`}>
            <span className={`mt-[1px] flex h-5 w-5 flex-none items-center justify-center rounded-[6px] border-[1.5px] text-[12px] text-white ${platform ? "border-blue bg-blue" : "border-[#c5cbd6] bg-transparent"}`}>{platform ? "✓" : ""}</span>
            <div>
              <div className="mb-[2px] flex items-center gap-[5px] text-[13.5px] font-bold text-ink"><IconShieldLock size={15} className="text-blue" />{CO.plat_flag}</div>
              <div className="text-[11.5px] leading-[1.4] text-muted">{CO.plat_hint}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-[10px]">
        <button type="button" onClick={onClose} className="cursor-pointer rounded-[10px] border border-line bg-surface px-[18px] py-[11px] text-[14px] font-semibold text-text-2">{CO.cancel}</button>
        <button type="button" onClick={save} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] bg-blue px-5 py-[11px] text-[14px] font-bold text-white"><IconUserPlus size={16} /> {CO.save}</button>
      </div>
    </Modal>
  );
}
