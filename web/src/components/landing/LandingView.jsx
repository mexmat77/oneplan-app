// СГЕНЕРИРОВАНО `scripts/gen-landing.mjs` из прототипа «OnePlan Главная.dc.html» — не править руками, править генератор/прототип.
// Разметка лендинга 1:1 с прототипом (строки 28–423). Стили — строки CSS прототипа через `S()`.
import { Fragment } from "react";
import { A, S } from "./landingStyle";
import { Ti } from "./LandingIcon";
import { LogoMark } from "@/components/Logo";

export function LandingView({ v }) {
  const { t, p, langBtns, isR, isD, pickR, pickD, switchAud, togRStyle, togDStyle, glowStyle, ctaStyle, noteStyle, eyebrowStyle, hlStyle, steps, faqs, stepNumStyle, otherBtnStyle, heroBoard, chTyping1, chMsg1, chTyping2, chMsg2, chLink, devIsBoard, devIsDocs, devIsPub, tabBoardStyle, tabDocsStyle, tabPubStyle, devTabBoard, devTabDocs, devTabPub, pubCards, docs, spotIcon, legalOpen, legalTitle, legalParas, openKvkk, openPriv, closeLegal, stopProp, selNo, selRooms, selM2, selPrice, selStatus, selChip, mockObjects, pFeatsA, pFeatsB, gotoApp, scrollToForm, pickRoleR, pickRoleD, roleRStyle, roleDStyle, formGlowStyle, leadFormShow, leadDone, leadName, leadCo, leadPhone, leadMail, leadMsg, onLeadName, onLeadCo, onLeadMail, onLeadMsg, onLeadPhone, leadPhoneFmt, leadInputStyle, leadPhoneStyle, leadMailStyle, toggleLeadC, leadChk, leadBtnStyle, submitLead } = v;
  return (
    <div style={S("min-height:100vh;background:#fff;position:relative;overflow-x:hidden")}>
    
      <div style={S("position:sticky;top:0;z-index:30;background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-bottom:1px solid #eef1f6;height:62px;display:flex;align-items:center;gap:12px;padding:0 clamp(16px,5vw,48px)")}>
        <div style={S("display:flex;align-items:center;gap:9px;font-weight:800;font-size:19px;color:#14243f;flex:none")}><LogoMark size={26} /> OnePlan</div>
        <div style={S("flex:1")}></div>
        <div style={S("display:flex;gap:3px;flex:none;background:#f0f2f6;border-radius:9px;padding:3px")}>{(langBtns).map((lb, lb_i) => (<Fragment key={lb_i}><span onClick={lb.onClick} style={S(lb.style)}>{lb.label}</span></Fragment>))}</div>
        <button onClick={gotoApp} style={S("font-size:13px;font-weight:700;border-radius:10px;padding:9px 17px;cursor:pointer;border:1px solid #14243f;background:#14243f;color:#fff;flex:none;white-space:nowrap")} className="lph-1">{t.login}</button>
      </div>
    
      <div style={S("position:relative")}>
        <div style={S(glowStyle)}></div>
    
        <div style={S("position:relative;z-index:1;max-width:1000px;margin:0 auto;padding:clamp(40px,6vw,72px) clamp(16px,5vw,48px) 0;text-align:center")}>
          <div style={S("font-size:12.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#8a93a2;margin-bottom:18px")}>{t.umbrella}</div>
          <div style={S("display:inline-flex;gap:5px;background:#f0f2f6;border:1px solid #e6e9f0;border-radius:14px;padding:5px;margin-bottom:28px;max-width:100%")}>
            <button onClick={pickR} style={S(togRStyle)}><Ti n={"ti-users-group"} /> {t.r.tag}</button>
            <button onClick={pickD} style={S(togDStyle)}><Ti n={"ti-building-skyscraper"} /> {t.d.tag}</button>
          </div>
          <h1 style={S("font-size:clamp(30px,5.6vw,56px);font-weight:800;color:#14243f;letter-spacing:-.035em;line-height:1.06;max-width:860px;margin:0 auto 18px;text-wrap:balance")}>{p.t1} <span style={S(hlStyle)}>{p.hl}</span> {p.t2}</h1>
          <p style={S("font-size:clamp(15px,2.2vw,19px);color:#5a6472;line-height:1.6;max-width:640px;margin:0 auto 28px;text-wrap:pretty")}>{p.sub}</p>
          <div style={S("display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:16px")}>
            <button onClick={scrollToForm} style={S(ctaStyle)} className="lph-2"><Ti n={"ti-send"} /> {p.cta}</button>
            <button onClick={gotoApp} style={S("font-size:15px;font-weight:700;border-radius:12px;padding:14px 26px;cursor:pointer;border:1px solid #d5dce6;background:#fff;color:#14243f;white-space:nowrap")} className="lph-3">{t.login}</button>
          </div>
          <span style={S("display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#0f9d6b;background:#e4f6ee;border-radius:100px;padding:6px 14px")}><Ti n={"ti-gift"} /> {t.badge}</span>
        </div>
    
        <div style={S("position:relative;z-index:1;max-width:920px;margin:clamp(36px,5vw,56px) auto 0;padding:0 clamp(16px,5vw,48px)")}>
          <div style={S("border:1px solid #e6e9f0;border-radius:16px;overflow:hidden;box-shadow:0 30px 70px rgba(20,36,63,.14);background:#fff")}>
            <div style={S("height:40px;background:#f0f2f6;border-bottom:1px solid #e6e9f0;display:flex;align-items:center;gap:6px;padding:0 15px")}><span style={S("width:11px;height:11px;border-radius:50%;background:#e5484d")}></span><span style={S("width:11px;height:11px;border-radius:50%;background:#f0ad00")}></span><span style={S("width:11px;height:11px;border-radius:50%;background:#43a047")}></span><span style={S("flex:1")}></span><span style={S("font-size:11px;color:#9aa4b5")}>one-plan.pro</span></div>
    
            {(isR) ? (<>
            <div style={S("background:#fff;padding:clamp(16px,3vw,28px);display:flex;flex-direction:column;gap:12px;animation:opRise .35s ease both")}>
              <div style={S("display:flex;align-items:center;gap:9px;flex-wrap:wrap")}>
                <span style={S("font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#9c7420")}>{t.m_base}</span>
                <span style={S("font-size:10.5px;font-weight:700;color:#0f9d6b;background:#e4f6ee;border-radius:100px;padding:3px 9px")}><Ti n={"ti-lock"} style={S("margin-right:4px")} />{t.m_closed}</span>
                <span style={S("flex:1")}></span>
                <span style={S("display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#14243f;background:#e9d9ba;border-radius:9px;padding:7px 12px;white-space:nowrap")}><Ti n={"ti-plus"} /> {t.m_add}</span>
              </div>
              <div style={S("display:flex;align-items:center;gap:9px;background:#f4f6f9;border:1px solid #e2e7ef;border-radius:10px;padding:10px 13px;font-size:12.5px;color:#6b7688")}><Ti n={"ti-search"} style={S("color:#9aa4b5")} /> {t.m_query}</div>
              <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:9px")}>
                {(mockObjects).map((o, o_i) => (<Fragment key={o_i}>
                <div style={S(`display:flex;align-items:center;gap:11px;background:#fff;border:1px solid #e6e9f0;border-radius:12px;padding:10px 12px;animation:opRise .3s ease both;animation-delay:${o.dl}`)}>
                  <span style={S(`width:38px;height:38px;border-radius:9px;background:${o.thumbBg};flex:none;display:flex;align-items:center;justify-content:center;color:rgba(20,36,63,.4);font-size:16px`)}><Ti n={"ti-building"} /></span>
                  <span style={S("flex:1;min-width:0;display:flex;flex-direction:column;gap:2px")}>
                    <span style={S("font-size:12.5px;font-weight:700;color:#14243f;font-family:'Manrope',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{o.name}</span>
                    <span style={S("font-size:11px;color:#8a93a2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{o.sub}</span>
                  </span>
                  <span style={S("display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex:none")}>
                    <span style={S("font-size:12.5px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif")}>{o.price}</span>
                    <span style={S("display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:#9c7420")}><span style={S(`width:16px;height:16px;border-radius:50%;background:${o.agentBg};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:8.5px;font-weight:800`)}>{o.agent}</span> {t.m_write}</span>
                  </span>
                </div>
                </Fragment>))}
              </div>
              <div style={S("display:flex;flex-direction:column;gap:7px;margin-top:2px")}>
                {(chTyping1) ? (<>
                <div style={S("display:flex;align-items:flex-end;gap:8px")}>
                  <span style={S("position:relative;width:26px;height:26px;border-radius:50%;background:#7d9fdd;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex:none")}>SE<span style={S("position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;background:#34c383;border:2px solid #fff")}></span></span>
                  <span style={S("display:inline-flex;align-items:center;gap:4px;background:#f0f2f6;border-radius:12px 12px 12px 4px;padding:10px 13px")}><span style={S("width:6px;height:6px;border-radius:50%;background:#8a93a2;animation:opBlink 1s infinite")}></span><span style={S("width:6px;height:6px;border-radius:50%;background:#8a93a2;animation:opBlink 1s infinite;animation-delay:.2s")}></span><span style={S("width:6px;height:6px;border-radius:50%;background:#8a93a2;animation:opBlink 1s infinite;animation-delay:.4s")}></span></span>
                </div>
                </>) : null}
                {(chMsg1) ? (<>
                <div style={S("display:flex;align-items:flex-end;gap:8px")}>
                  <span style={S("position:relative;width:26px;height:26px;border-radius:50%;background:#7d9fdd;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex:none")}>SE<span style={S("position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;background:#34c383;border:2px solid #fff")}></span></span>
                  <span style={S("background:#f0f2f6;border-radius:12px 12px 12px 4px;padding:8px 13px;font-size:12px;color:#14243f;line-height:1.4;animation:opRise .25s ease both")}>{t.m_chat}</span>
                </div>
                </>) : null}
                {(chTyping2) ? (<>
                <div style={S("display:flex;align-items:flex-end;gap:8px;justify-content:flex-end")}>
                  <span style={S("display:inline-flex;align-items:center;gap:4px;background:rgba(201,163,91,.18);border-radius:12px 12px 4px 12px;padding:10px 13px")}><span style={S("width:6px;height:6px;border-radius:50%;background:#9c7420;animation:opBlink 1s infinite")}></span><span style={S("width:6px;height:6px;border-radius:50%;background:#9c7420;animation:opBlink 1s infinite;animation-delay:.2s")}></span><span style={S("width:6px;height:6px;border-radius:50%;background:#9c7420;animation:opBlink 1s infinite;animation-delay:.4s")}></span></span>
                  <span style={S("width:26px;height:26px;border-radius:50%;background:#c9a35b;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex:none")}>AK</span>
                </div>
                </>) : null}
                {(chMsg2) ? (<>
                <div style={S("display:flex;align-items:flex-end;gap:8px;justify-content:flex-end")}>
                  <span style={S("background:rgba(201,163,91,.18);border-radius:12px 12px 4px 12px;padding:8px 13px;font-size:12px;color:#14243f;line-height:1.4;animation:opRise .25s ease both")}>{t.m_chat2}</span>
                  <span style={S("width:26px;height:26px;border-radius:50%;background:#c9a35b;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex:none")}>AK</span>
                </div>
                </>) : null}
                {(chLink) ? (<>
                <div style={S("display:flex;justify-content:flex-end;padding-right:34px")}>
                  <span style={S("display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid rgba(201,163,91,.55);border-radius:9px;padding:6px 11px;font-size:11.5px;font-weight:700;color:#9c7420;animation:opRise .25s ease both")}><Ti n={"ti-link"} /> one-plan.pro/s/deniz-24</span>
                </div>
                </>) : null}
              </div>
              <div style={S("display:flex;align-items:center;gap:8px;font-size:11px;color:#8a93a2")}><Ti n={"ti-users"} style={S("color:#c9a35b")} /> {t.m_community}</div>
            </div>
            </>) : null}
    
            {(isD) ? (<>
            <div style={S("background:#fff;padding:clamp(16px,3vw,28px);display:flex;flex-direction:column;gap:12px;animation:opRise .35s ease both")}>
              <div style={S("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                <span style={S("font-size:12px;font-weight:700;color:#14243f;font-family:'Manrope',sans-serif")}>MEGAPOLIS · B</span>
                <span style={S("font-size:10.5px;font-weight:700;color:#0f9d6b;background:#e4f6ee;border-radius:100px;padding:3px 9px;white-space:nowrap")}>{t.m_selling}</span>
                <span style={S("flex:1")}></span>
                <span style={S("display:inline-flex;gap:4px")}>
                  <span onClick={devTabBoard} style={S(tabBoardStyle)}>{t.m_board}</span>
                  <span onClick={devTabDocs} style={S(tabDocsStyle)}>{t.m_docs}</span>
                  <span onClick={devTabPub} style={S(tabPubStyle)}>{t.m_pub}</span>
                </span>
              </div>
              {(devIsBoard) ? (<>
              <div style={S("display:flex;flex-direction:column;gap:5px")}>
                {(heroBoard).map((row, row_i) => (<Fragment key={row_i}>
                <div style={S("display:flex;align-items:center;gap:5px")}>
                  <span style={S("width:16px;font-size:9.5px;color:#9aa4b5;text-align:right;flex:none")}>{row.floor}</span>
                  <span style={S("flex:1;display:grid;grid-template-columns:repeat(14,1fr);gap:5px")}>
                    {(row.cells).map((c, c_i) => (<Fragment key={c_i}><span onClick={c.onClick} style={S(c.st)} className="lph-4"></span></Fragment>))}
                  </span>
                </div>
                </Fragment>))}
              </div>
              <div style={S("display:flex;align-items:center;gap:10px;background:#f4f6f9;border:1px solid #e2e7ef;border-radius:10px;padding:9px 13px;flex-wrap:wrap")}>
                <span style={S("font-size:11px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif;white-space:nowrap")}>№ {selNo}</span>
                <span style={S("font-size:11px;color:#5a6472;white-space:nowrap")}>{selRooms}</span>
                <span style={S("font-size:11px;color:#5a6472;white-space:nowrap")}>{selM2} m²</span>
                <span style={S("font-size:11px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif;white-space:nowrap")}>{selPrice}</span>
                <span style={S("flex:1")}></span>
                <span style={S(selChip)}>{selStatus}</span>
              </div>
              <div style={S("display:flex;align-items:center;gap:11px;font-size:10.5px;color:#6b7688;flex-wrap:wrap")}>
                <span style={S("display:inline-flex;align-items:center;gap:5px")}><span style={S("width:8px;height:8px;border-radius:3px;background:#34c383")}></span>{t.m_avail}</span>
                <span style={S("display:inline-flex;align-items:center;gap:5px")}><span style={S("width:8px;height:8px;border-radius:3px;background:#f0ad00")}></span>{t.m_res}</span>
                <span style={S("display:inline-flex;align-items:center;gap:5px")}><span style={S("width:8px;height:8px;border-radius:3px;background:#4d7cfe")}></span>{t.m_proc}</span>
                <span style={S("display:inline-flex;align-items:center;gap:5px")}><span style={S("width:8px;height:8px;border-radius:3px;background:#cfd6e0")}></span>{t.m_sold}</span>
                <span style={S("display:inline-flex;align-items:center;gap:5px")}><span style={S("width:8px;height:8px;border-radius:3px;background:#8b5cf6")}></span>{t.m_hold}</span>
                <span style={S("flex:1")}></span>
                <span style={S("display:inline-flex;align-items:center;gap:6px")}><Ti n={"ti-bolt"} style={S("color:#4d7cfe")} /> {t.m_live}</span>
              </div>
              </>) : null}
              {(devIsDocs) ? (<>
              <div style={S("display:flex;flex-direction:column;gap:9px;animation:opRise .3s ease both")}>
                <div style={S("display:flex;gap:6px;flex-wrap:wrap")}>
                  <span style={S("font-size:10.5px;font-weight:700;color:#14243f;background:#e3ebfd;border-radius:100px;padding:4px 11px")}>{t.m_doc_all}</span>
                  <span style={S("font-size:10.5px;font-weight:700;color:#8a93a2;background:#f0f2f6;border-radius:100px;padding:4px 11px")}>{t.m_doc_contracts}</span>
                  <span style={S("font-size:10.5px;font-weight:700;color:#8a93a2;background:#f0f2f6;border-radius:100px;padding:4px 11px")}>{t.m_doc_plans}</span>
                  <span style={S("font-size:10.5px;font-weight:700;color:#8a93a2;background:#f0f2f6;border-radius:100px;padding:4px 11px")}>{t.m_doc_site}</span>
                </div>
                {(docs).map((doc, doc_i) => (<Fragment key={doc_i}>
                <div style={S("display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e6e9f0;border-radius:10px;padding:9px 12px")}>
                  <span style={S(`width:32px;height:32px;border-radius:8px;background:${doc.bg};color:${doc.c};display:flex;align-items:center;justify-content:center;font-size:16px;flex:none`)}><Ti n={doc.i} /></span>
                  <span style={S("flex:1;min-width:0;display:flex;flex-direction:column;gap:1px")}>
                    <span style={S("font-size:12px;font-weight:700;color:#14243f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{doc.n}</span>
                    <span style={S("font-size:10.5px;color:#8a93a2")}>{doc.m}</span>
                  </span>
                  <span style={S("width:26px;height:26px;border-radius:8px;background:#f0f2f6;color:#5a6472;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex:none")}><Ti n={"ti-download"} /></span>
                </div>
                </Fragment>))}
              </div>
              </>) : null}
              {(devIsPub) ? (<>
              <div style={S("display:flex;flex-direction:column;gap:10px;animation:opRise .3s ease both")}>
                <div style={S("background:linear-gradient(135deg,#31435f,#1d2a42);border-radius:12px;padding:14px 16px;color:#fff;display:flex;align-items:center;gap:10px;flex-wrap:wrap")}>
                  <span style={S("min-width:0")}>
                    <span style={S("display:block;font-size:15px;font-weight:800;font-family:'Manrope',sans-serif;letter-spacing:-.01em;white-space:nowrap")}>MEGAPOLIS RESIDENCE</span>
                    <span style={S("display:block;font-size:11px;color:rgba(255,255,255,.7);margin-top:1px;white-space:nowrap")}>Antalya · Altıntaş · 406 {t.m_units}</span>
                  </span>
                  <span style={S("flex:1")}></span>
                  <span style={S("display:inline-flex;gap:6px")}><span style={S("font-size:10px;font-weight:700;background:rgba(255,255,255,.16);border-radius:100px;padding:3px 9px")}>TAPU</span><span style={S("font-size:10px;font-weight:700;background:rgba(255,255,255,.16);border-radius:100px;padding:3px 9px")}>VNJ</span></span>
                </div>
                <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:10px")}>
                  {(pubCards).map((pc, pc_i) => (<Fragment key={pc_i}>
                  <div style={S("border:1px solid #e6e9f0;border-radius:14px;overflow:hidden;background:#fff")}>
                    <div style={S("aspect-ratio:16/10;position:relative;background:#dfe6f0")}>
                      {(pc.img) ? (<><img src={A(pc.img)} style={S("width:100%;height:100%;object-fit:cover;display:block")} alt="" /></>) : null}
                      <span style={S(pc.stageStyle)}>{pc.stage}</span>
                      {(pc.live) ? (<><span style={S("position:absolute;top:8px;right:8px;font-size:8.5px;font-weight:800;background:#e5484d;color:#fff;border-radius:100px;padding:3px 8px;display:inline-flex;align-items:center;gap:4px")}><span style={S("width:5px;height:5px;border-radius:50%;background:#fff;animation:opBlink 1s infinite")}></span>LIVE</span></>) : null}
                      {(pc.iskan) ? (<><span style={S("position:absolute;left:8px;bottom:8px;font-size:8.5px;font-weight:800;background:#0f9d6b;color:#fff;border-radius:100px;padding:3px 8px")}>İskan ✓</span></>) : null}
                    </div>
                    <div style={S("padding:10px 12px")}>
                      <div style={S("font-size:12.5px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{pc.name}</div>
                      <div style={S("font-size:10px;color:#8a93a2;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}><Ti n={"ti-map-pin"} /> {pc.loc}</div>
                      <div style={S("display:flex;gap:4px;flex-wrap:wrap;margin-top:7px")}>
                        {(pc.chips).map((ch, ch_i) => (<Fragment key={ch_i}><span style={S(ch.st)}>{ch.l}</span></Fragment>))}
                      </div>
                      <div style={S("display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#5a6472;margin-top:9px")}><span style={S("white-space:nowrap")}>{t.m_soldp} · {pc.sold}</span><span style={S("white-space:nowrap")}>{pc.onsale} {t.m_onsale}</span></div>
                      <div style={S("height:4px;border-radius:2px;background:#eef1f6;margin-top:3px")}><div style={S(pc.soldBar)}></div></div>
                      <div style={S("display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#5a6472;margin-top:7px")}><span style={S("white-space:nowrap")}>{t.m_ready}</span><span style={S("font-weight:800;color:#0f9d6b;white-space:nowrap")}>{pc.ready}</span></div>
                      <div style={S("height:4px;border-radius:2px;background:#eef1f6;margin-top:3px")}><div style={S(pc.readyBar)}></div></div>
                      <div style={S("display:flex;justify-content:space-between;gap:8px;font-size:9.5px;color:#8a93a2;margin-top:9px;border-top:1px solid #f0f2f6;padding-top:7px")}><span style={S("white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{pc.builder}</span><span style={S("white-space:nowrap")}>{pc.units} {t.m_rooms_n}</span></div>
                    </div>
                  </div>
                  </Fragment>))}
                </div>
                <div style={S("display:flex;align-items:center;gap:9px;background:#f4f6f9;border:1px dashed #c9d2e0;border-radius:10px;padding:9px 13px")}>
                  <Ti n={"ti-link"} style={S("color:#4d7cfe;flex:none")} /><span style={S("flex:1;min-width:0;font-size:12.5px;color:#14243f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>one-plan.pro/megapolis</span>
                  <span style={S("font-size:11px;font-weight:700;color:#4d7cfe;flex:none")}>{t.m_copy}</span>
                  <span style={S("width:26px;height:26px;border-radius:8px;background:#25d366;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;flex:none")}><Ti n={"ti-brand-whatsapp"} /></span>
                </div>
              </div>
              </>) : null}
            </div>
            </>) : null}
    
          </div>
          <div style={S("display:flex;justify-content:center;margin-top:18px")}>
            <span style={S(noteStyle)}><Ti n={"ti-shield-check"} style={S("font-size:16px;flex:none")} /> {p.note}</span>
          </div>
        </div>
      </div>
    
      <div style={S("background:#f6f8fb;border-top:1px solid #eef1f6;border-bottom:1px solid #eef1f6;margin-top:clamp(56px,8vw,104px)")}>
      <div style={S("max-width:1120px;margin:0 auto;padding:clamp(44px,6vw,76px) clamp(16px,5vw,48px)")}>
        <div style={S("text-align:center;margin-bottom:clamp(30px,4vw,48px)")}>
          <span style={S(eyebrowStyle)}>{t.feat_eyebrow}</span>
          <h2 style={S("font-size:clamp(24px,4vw,36px);font-weight:800;color:#14243f;letter-spacing:-.025em;line-height:1.1;text-wrap:balance")}>{p.feat_title}</h2>
        </div>
        <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(430px,100%),1fr));gap:16px")}>
          <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:16px")}>
            {(pFeatsA).map((f, f_i) => (<Fragment key={f_i}>
            <div style={S("background:#fff;border:1px solid #e6e9f0;border-radius:18px;padding:clamp(20px,2.6vw,26px);text-align:center;transition:transform .18s,box-shadow .18s")} className="lph-5">
              <span style={S(f.iconStyle)}><Ti n={f.icon} /></span>
              <div style={S("font-size:16.5px;font-weight:800;color:#14243f;letter-spacing:-.01em;margin-bottom:7px;text-wrap:balance")}>{f.t}</div>
              <div style={S("font-size:13.5px;color:#6b7688;line-height:1.55;text-wrap:pretty;max-width:240px;margin:0 auto")}>{f.d}</div>
            </div>
            </Fragment>))}
          </div>
          <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(200px,100%),1fr));gap:16px")}>
            {(pFeatsB).map((f, f_i) => (<Fragment key={f_i}>
            <div style={S("background:#fff;border:1px solid #e6e9f0;border-radius:18px;padding:clamp(20px,2.6vw,26px);text-align:center;transition:transform .18s,box-shadow .18s")} className="lph-5">
              <span style={S(f.iconStyle)}><Ti n={f.icon} /></span>
              <div style={S("font-size:16.5px;font-weight:800;color:#14243f;letter-spacing:-.01em;margin-bottom:7px;text-wrap:balance")}>{f.t}</div>
              <div style={S("font-size:13.5px;color:#6b7688;line-height:1.55;text-wrap:pretty;max-width:240px;margin:0 auto")}>{f.d}</div>
            </div>
            </Fragment>))}
          </div>
        </div>
      </div>
      </div>
    
      <div style={S("max-width:1060px;margin:0 auto;padding:clamp(48px,7vw,84px) clamp(16px,5vw,48px) 0")}>
        <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));gap:clamp(24px,4vw,52px);align-items:center")}>
          <div>
            <span style={S(eyebrowStyle)}>{p.spot_eyebrow}</span>
            <h2 style={S("font-size:clamp(22px,3.4vw,32px);font-weight:800;color:#14243f;letter-spacing:-.025em;line-height:1.15;margin-bottom:12px;text-wrap:balance")}>{p.spot_title}</h2>
            <p style={S("font-size:15px;color:#5a6472;line-height:1.65;margin-bottom:18px;text-wrap:pretty")}>{p.spot_d}</p>
            <span style={S(noteStyle)}><Ti n={spotIcon} style={S("font-size:16px;flex:none")} /> {p.spot_note}</span>
          </div>
          <div>
            {(isR) ? (<>
            <div style={S("background:#fff;border:1px solid #e6e9f0;border-radius:18px;box-shadow:0 24px 60px rgba(20,36,63,.12);overflow:hidden;animation:opRise .35s ease both")}>
              <div style={S("display:flex;align-items:center;gap:9px;padding:14px 18px;border-bottom:1px solid #eef1f6")}>
                <span style={S("width:34px;height:34px;border-radius:9px;background:rgba(201,163,91,.16);color:#9c7420;display:flex;align-items:center;justify-content:center;font-size:16px;flex:none")}><Ti n={"ti-folders"} /></span>
                <span style={S("font-size:14px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif")}>{t.m_sel_title}</span>
                <span style={S("flex:1")}></span>
                <span style={S("font-size:11px;font-weight:700;color:#9c7420;background:rgba(201,163,91,.16);border-radius:100px;padding:4px 10px;white-space:nowrap")}>{t.m_sel_n}</span>
              </div>
              <div style={S("padding:12px 18px;display:flex;flex-direction:column;gap:9px")}>
                {(mockObjects).map((o, o_i) => (<Fragment key={o_i}>
                <div style={S("display:flex;align-items:center;gap:10px")}>
                  <span style={S(`width:30px;height:30px;border-radius:8px;background:${o.thumbBg};flex:none;display:flex;align-items:center;justify-content:center;color:rgba(20,36,63,.4);font-size:13px`)}><Ti n={"ti-building"} /></span>
                  <span style={S("flex:1;min-width:0;font-size:12px;font-weight:700;color:#14243f;font-family:'Manrope',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>{o.name}</span>
                  <span style={S("font-size:12px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif;flex:none")}>{o.price}</span>
                  <span style={S("width:22px;height:22px;border-radius:7px;background:rgba(201,163,91,.16);color:#9c7420;display:inline-flex;align-items:center;justify-content:center;font-size:12px;flex:none")}><Ti n={"ti-folder-check"} /></span>
                </div>
                </Fragment>))}
              </div>
              <div style={S("padding:0 18px 16px;display:flex;flex-direction:column;gap:10px")}>
                <div style={S("display:flex;align-items:center;gap:9px;background:#f4f6f9;border:1px dashed #c9d2e0;border-radius:10px;padding:9px 13px")}>
                  <Ti n={"ti-link"} style={S("color:#9c7420;flex:none")} /><span style={S("flex:1;min-width:0;font-size:12.5px;color:#14243f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>one-plan.pro/s/anna-24</span>
                  <span style={S("font-size:11px;font-weight:700;color:#4d7cfe;flex:none")}>{t.m_copy}</span>
                  <span style={S("width:26px;height:26px;border-radius:8px;background:#25d366;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;flex:none")}><Ti n={"ti-brand-whatsapp"} /></span>
                </div>
                <div style={S("display:flex;align-items:center;gap:7px;font-size:11.5px;color:#8a93a2")}><Ti n={"ti-user-check"} style={S("color:#9c7420")} /> {t.m_sel_client}</div>
              </div>
            </div>
            </>) : null}
            {(isD) ? (<>
            <div style={S("background:#fff;border:1px solid #e6e9f0;border-radius:18px;box-shadow:0 24px 60px rgba(20,36,63,.12);overflow:hidden;animation:opRise .35s ease both")}>
              <div style={S("background:linear-gradient(135deg,#31435f,#1d2a42);padding:22px 18px;color:#fff")}>
                <div style={S("display:flex;gap:6px;margin-bottom:10px")}><span style={S("font-size:10px;font-weight:700;background:rgba(255,255,255,.16);border-radius:100px;padding:3px 9px")}>TAPU</span><span style={S("font-size:10px;font-weight:700;background:rgba(255,255,255,.16);border-radius:100px;padding:3px 9px")}>VNJ</span></div>
                <div style={S("font-size:18px;font-weight:800;font-family:'Manrope',sans-serif;letter-spacing:-.01em")}>MEGAPOLIS RESIDENCE</div>
                <div style={S("font-size:11.5px;color:rgba(255,255,255,.7);margin-top:3px")}>Antalya · Altıntaş</div>
              </div>
              <div style={S("display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid #eef1f6")}>
                <div style={S("text-align:center;padding:13px 8px;border-right:1px solid #eef1f6")}><div style={S("font-size:16px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif")}>406</div><div style={S("font-size:10.5px;color:#8a93a2")}>{t.m_units}</div></div>
                <div style={S("text-align:center;padding:13px 8px;border-right:1px solid #eef1f6")}><div style={S("font-size:16px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif")}>50%</div><div style={S("font-size:10.5px;color:#8a93a2")}>{t.m_soldl}</div></div>
                <div style={S("text-align:center;padding:13px 8px")}><div style={S("font-size:16px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif")}>5 km</div><div style={S("font-size:10.5px;color:#8a93a2")}>{t.m_sea}</div></div>
              </div>
              <div style={S("padding:14px 18px")}>
                <div style={S("display:flex;align-items:center;gap:9px;background:#f4f6f9;border:1px dashed #c9d2e0;border-radius:10px;padding:9px 13px")}>
                  <Ti n={"ti-link"} style={S("color:#4d7cfe;flex:none")} /><span style={S("flex:1;min-width:0;font-size:12.5px;color:#14243f;white-space:nowrap;overflow:hidden;text-overflow:ellipsis")}>one-plan.pro/megapolis</span>
                  <span style={S("font-size:11px;font-weight:700;color:#4d7cfe;flex:none")}>{t.m_copy}</span>
                  <span style={S("width:26px;height:26px;border-radius:8px;background:#25d366;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;flex:none")}><Ti n={"ti-brand-whatsapp"} /></span>
                </div>
              </div>
            </div>
            </>) : null}
          </div>
        </div>
      </div>
    
      <div style={S("max-width:1120px;margin:0 auto;padding:clamp(48px,7vw,84px) clamp(16px,5vw,48px) 0")}>
        <div style={S("text-align:center;margin-bottom:clamp(26px,4vw,40px)")}>
          <h2 style={S("font-size:clamp(22px,3.4vw,32px);font-weight:800;color:#14243f;letter-spacing:-.025em;line-height:1.1")}>{t.how_title}</h2>
        </div>
        <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:16px")}>
          {(steps).map((st, st_i) => (<Fragment key={st_i}>
          <div style={S("text-align:center;padding:8px 12px")}>
            <span style={S(stepNumStyle)}>{st.n}</span>
            <div style={S("font-size:16.5px;font-weight:800;color:#14243f;margin-bottom:6px")}>{st.t}</div>
            <div style={S("font-size:13.5px;color:#6b7688;line-height:1.55;max-width:230px;margin:0 auto;text-wrap:pretty")}>{st.d}</div>
          </div>
          </Fragment>))}
        </div>
      </div>
    
      <div style={S("max-width:760px;margin:0 auto;padding:clamp(48px,7vw,84px) clamp(16px,5vw,48px) 0")}>
        <div style={S("text-align:center;margin-bottom:clamp(24px,3vw,36px)")}>
          <h2 style={S("font-size:clamp(22px,3.4vw,32px);font-weight:800;color:#14243f;letter-spacing:-.025em;line-height:1.1")}>{t.faq_title}</h2>
        </div>
        <div style={S("display:flex;flex-direction:column;gap:10px")}>
          {(faqs).map((q, q_i) => (<Fragment key={q_i}>
          <div onClick={q.toggle} style={S("background:#fff;border:1px solid #e6e9f0;border-radius:14px;padding:16px 20px;cursor:pointer;transition:border-color .15s")} className="lph-6">
            <div style={S("display:flex;align-items:center;gap:12px")}>
              <span style={S("flex:1;font-size:15px;font-weight:700;color:#14243f;font-family:'Manrope',sans-serif")}>{q.q}</span>
              <Ti n={"ti-chevron-down"} style={S(q.chev)} />
            </div>
            <div style={S(q.aStyle)}>{q.a}</div>
          </div>
          </Fragment>))}
        </div>
      </div>
    
      <div style={S("max-width:1120px;margin:clamp(44px,6vw,72px) auto 0;padding:0 clamp(16px,5vw,48px)")}>
        <div style={S("display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;background:#f6f8fb;border:1px solid #e6e9f0;border-radius:16px;padding:18px 22px;text-align:center")}>
          <span style={S("font-size:14.5px;color:#5a6472;white-space:nowrap")}>{p.other_q}</span>
          <button onClick={switchAud} style={S(otherBtnStyle)} className="lph-2">{p.other_btn} <Ti n={"ti-arrow-right"} /></button>
        </div>
      </div>
    
      <div id="lp-lead" style={S("max-width:820px;margin:0 auto;padding:clamp(48px,7vw,88px) clamp(16px,5vw,48px) clamp(56px,8vw,88px)")}>
        <div style={S("position:relative;background:#14243f;border-radius:24px;padding:clamp(26px,4vw,46px);overflow:hidden;color:#fff")}>
          <div style={S(formGlowStyle)}></div>
          <div style={S("position:relative")}>
          {(leadFormShow) ? (<>
          <div style={S("text-align:center;max-width:480px;margin:0 auto 22px")}>
            <h2 style={S("font-size:clamp(22px,3.4vw,29px);font-weight:800;letter-spacing:-.02em;margin-bottom:8px")}>{t.form_title}</h2>
            <p style={S("font-size:14.5px;color:#aeb9cc;line-height:1.5")}>{t.form_sub}</p>
          </div>
          <div style={S("display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:22px")}>
            <button onClick={pickRoleR} style={S(roleRStyle)}><Ti n={"ti-users-group"} /> {t.r.role}</button>
            <button onClick={pickRoleD} style={S(roleDStyle)}><Ti n={"ti-building-skyscraper"} /> {t.d.role}</button>
          </div>
          <div style={S("display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px")}>
            <div><label style={S("font-size:12px;color:#8fa0bd;display:block;margin-bottom:6px")}>{t.f_name} <span style={S("color:#ff8b8b")}>*</span></label><input value={leadName} onChange={onLeadName} style={S(leadInputStyle)} /></div>
            <div><label style={S("font-size:12px;color:#8fa0bd;display:block;margin-bottom:6px")}>{t.f_co}</label><input value={leadCo} onChange={onLeadCo} style={S(leadInputStyle)} /></div>
            <div><label style={S("font-size:12px;color:#8fa0bd;display:block;margin-bottom:6px")}>{t.f_phone} <span style={S("color:#ff8b8b")}>*</span></label><div style={S("position:relative")}><span style={S("position:absolute;left:14px;top:50%;transform:translateY(-50%);font-size:14px;font-weight:700;color:#fff;pointer-events:none")}>+90</span><input type="tel" inputMode="numeric" placeholder="5xx xxx xx xx" value={leadPhoneFmt} onChange={onLeadPhone} style={S(leadPhoneStyle)} /></div></div>
            <div><label style={S("font-size:12px;color:#8fa0bd;display:block;margin-bottom:6px")}>{t.f_email} <span style={S("color:#ff8b8b")}>*</span></label><input type="email" value={leadMail} onChange={onLeadMail} style={S(leadMailStyle)} /><div style={S("font-size:11px;color:#8fa0bd;margin-top:5px")}>{t.f_email_note}</div></div>
          </div>
          <div style={S("margin-top:12px")}><label style={S("font-size:12px;color:#8fa0bd;display:block;margin-bottom:6px")}>{t.f_msg}</label><input value={leadMsg} onChange={onLeadMsg} style={S(leadInputStyle)} /></div>
          <div onClick={toggleLeadC} style={S("display:flex;gap:10px;align-items:flex-start;cursor:pointer;margin:18px 0 6px")}><span style={S(leadChk)}><Ti n={"ti-check"} style={S("font-size:13px")} /></span><span style={S("font-size:12.5px;color:#c7d0e0;line-height:1.45")}>{t.f_consent} · <a onClick={openKvkk} style={S("color:#8fb0e8;cursor:pointer;text-decoration:underline")}>KVKK</a></span></div>
          <button onClick={submitLead} style={S(leadBtnStyle)}>{t.f_submit}</button>
          <div style={S("font-size:12.5px;color:#8fa0bd;margin-top:14px;text-align:center")}><Ti n={"ti-gift"} style={S("margin-right:5px")} />{t.free_note}</div>
          </>) : null}
          {(leadDone) ? (<>
          <div style={S("text-align:center;padding:20px 4px")}>
            <span style={S("width:66px;height:66px;border-radius:50%;background:rgba(15,157,107,.2);color:#3ddc97;display:inline-flex;align-items:center;justify-content:center;font-size:33px;margin-bottom:16px")}><Ti n={"ti-check"} /></span>
            <div style={S("font-size:24px;font-weight:800;margin-bottom:8px")}>{t.done_t}</div>
            <div style={S("font-size:15px;color:#aeb9cc;line-height:1.55")}>{t.done_d}</div>
          </div>
          </>) : null}
          </div>
        </div>
      </div>
    
      {(legalOpen) ? (<>
      <div onClick={closeLegal} style={S("position:fixed;inset:0;background:rgba(11,18,32,.55);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px")}>
        <div onClick={stopProp} style={S("background:#fff;border-radius:18px;max-width:660px;width:100%;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 40px 100px rgba(0,0,0,.35);animation:opRise .25s ease both")}>
          <div style={S("display:flex;align-items:center;gap:10px;padding:18px 22px;border-bottom:1px solid #eef1f6;flex:none")}>
            <span style={S("font-size:17px;font-weight:800;color:#14243f;font-family:'Manrope',sans-serif;flex:1;min-width:0")}>{legalTitle}</span>
            <span onClick={closeLegal} style={S("width:30px;height:30px;border-radius:9px;background:#f0f2f6;color:#5a6472;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:15px;flex:none")} className="lph-7"><Ti n={"ti-x"} /></span>
          </div>
          <div style={S("padding:18px 22px 22px;overflow-y:auto")}>
            {(legalParas).map((lp, lp_i) => (<Fragment key={lp_i}>
            <p style={S("font-size:13.5px;color:#3d4a5f;line-height:1.68;margin-bottom:12px;text-wrap:pretty")}>{lp}</p>
            </Fragment>))}
            <p style={S("font-size:12px;color:#8a93a2;margin-top:4px")}>{t.legal_upd}</p>
          </div>
        </div>
      </div>
      </>) : null}
    
      <div style={S("border-top:1px solid #eef1f6;display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 16px 34px")}>
        <LogoMark size={24} />
        <span style={S("font-size:11.5px;color:#9aa1ac;max-width:460px;line-height:1.5;text-align:center;text-wrap:pretty")}>{t.app_note}</span>
        <span style={S("display:inline-flex;gap:10px;flex-wrap:wrap;justify-content:center")}>
          <a href="#" style={S("display:inline-flex;align-items:center;gap:7px;border:1px solid #e6e9f0;color:#5a6472;border-radius:9px;padding:7px 13px;font-size:12px;font-weight:700;text-decoration:none")} className="lph-6" onClick={(e) => e.preventDefault()}><Ti n={"ti-brand-apple-filled"} style={S("font-size:16px")} /> App Store</a>
          <a href="#" style={S("display:inline-flex;align-items:center;gap:7px;border:1px solid #e6e9f0;color:#5a6472;border-radius:9px;padding:7px 13px;font-size:12px;font-weight:700;text-decoration:none")} className="lph-6" onClick={(e) => e.preventDefault()}><Ti n={"ti-brand-google-play"} style={S("font-size:15px")} /> Google Play</a>
        </span>
        <span style={S("display:inline-flex;gap:14px;flex-wrap:wrap;justify-content:center")}><a onClick={openKvkk} style={S("font-size:11.5px;color:#8a93a2;text-decoration:underline;cursor:pointer")}>KVKK</a><a onClick={openPriv} style={S("font-size:11.5px;color:#8a93a2;text-decoration:underline;cursor:pointer")}>{t.f_priv}</a></span>
        <span style={S("font-size:12px;color:#9aa1ac")}>© 2026 ONETEAM İNŞAAT LTD. ŞTİ.</span>
      </div>
    </div>
  );
}
