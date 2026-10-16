// СГЕНЕРИРОВАНО `scripts/gen-landing.mjs` из прототипа «OnePlan Главная.dc.html» — не править руками, править генератор/прототип.
// Методы класса прототипа дословно. `ctx` = { state, props, setState, savePrefs, i18n, gotoApp, submit } из `Landing.tsx`.
const C = {
  unitStatus(r,c){
    const h=(r*13+c*7+3)%20;
    return h<4?'sold':h===4?'res':h===5?'proc':h===6?'hold':'avail';
  },

  unitInfo(r,c){
    const floor=8-r;
    const idx=(r+c)%3;
    const m2=[52,76,110][idx]+(c%3)*2;
    return {
      no:floor+'-'+String(c+1).padStart(2,'0'),
      rooms:['1+1','2+1','3+1'][idx],
      m2:m2,
      price:'$'+String(Math.round(m2*(1750+floor*25)/500)*500).replace(/\B(?=(\d{3})+(?!\d))/g,' '),
      stt:this.unitStatus(r,c)
    };
  },

  mkBoard(rows,cols,flip,sel){
    const colors={sold:'#cfd6e0',res:'#f0ad00',proc:'#4d7cfe',hold:'#8b5cf6',avail:'#34c383'};
    const out=[];
    for(let r=0;r<rows;r++){
      const cells=[];
      for(let c=0;c<cols;c++){
        const isFlip=flip&&flip.r===r&&flip.c===c;
        const bg=isFlip?'#f0ad00':colors[this.unitStatus(r,c)];
        const isSel=sel&&sel.r===r&&sel.c===c;
        cells.push({
          onClick:()=>this.setState({selUnit:{r,c}}),
          st:'height:16px;border-radius:4px;background:'+bg+';cursor:pointer;animation:opCell .3s ease both'+(isFlip?',opPulse 1.5s ease infinite':'')+';animation-delay:'+(r*40+c*16)+'ms'+(isFlip?',0ms':'')+';transition:transform .12s'+(isSel?';outline:2px solid #14243f;outline-offset:1px':'')
        });
      }
      out.push({floor:String(rows-r),cells});
    }
    return out;
  },

  renderVals(){
    const s=this.state;
    const t=this.i18n()[s.lang];
    const blue=this.props.accent ?? '#4d7cfe';
    const gold=this.props.gold ?? '#c9a35b';
    const goldText='#9c7420';
    const isR=s.aud==='r';
    const p=isR?t.r:t.d;
    const pa=isR?gold:blue;
    const paText=isR?goldText:blue;
    const paTint=isR?'rgba(201,163,91,.16)':'rgba(77,124,254,.12)';
    const langBtns=['RU','EN','TR'].map(l=>({label:l,onClick:()=>{this.setState({lang:l});this.savePrefs(l,s.aud);},
      style:'font-size:12px;font-weight:700;padding:5px 10px;border-radius:7px;cursor:pointer;transition:all .15s;'+(s.lang===l?'background:#fff;color:#14243f;box-shadow:0 1px 3px rgba(0,0,0,.12)':'color:#8a93a2')}));
    const bind=(k)=>(e)=>this.setState({[k]:e.target.value});
    const li=(bad)=>'width:100%;background:#1e3050;border:1px solid '+(bad?'#e5484d':'#33456a')+';border-radius:11px;padding:12px 14px;font-size:14px;color:#fff;outline:none';
    const phoneOk=/^5\d{9}$/.test(s.leadPhone);
    const mailOk=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.leadMail);
    const togBase='font-size:14px;font-weight:700;border-radius:10px;padding:11px 20px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;transition:all .15s;';
    const roleBase='font-size:13px;font-weight:700;border-radius:10px;padding:10px 18px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap;transition:all .15s;';
    const featIcons=isR?['ti-database','ti-home-plus','ti-search','ti-message-circle']:['ti-layout-grid','ti-file-description','ti-world','ti-shield-lock'];
    const iconStyle='display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;background:'+paTint+';color:'+paText+';font-size:22px;margin-bottom:14px';
    return {
      t, p, langBtns, isR, isD:!isR,
      pickR:()=>{this.setState({aud:'r',role:'r',faqOpen:0});this.savePrefs(s.lang,'r');},
      pickD:()=>{this.setState({aud:'d',role:'d',faqOpen:0});this.savePrefs(s.lang,'d');},
      switchAud:()=>{const na=isR?'d':'r';this.setState({aud:na,role:na,faqOpen:0});this.savePrefs(s.lang,na);window.scrollTo({top:0,behavior:'smooth'});},
      togRStyle:togBase+(isR?'border:none;background:'+gold+';color:#14243f;box-shadow:0 6px 18px rgba(201,163,91,.35)':'border:none;background:transparent;color:#6b7688'),
      togDStyle:togBase+(!isR?'border:none;background:'+blue+';color:#fff;box-shadow:0 6px 18px rgba(77,124,254,.3)':'border:none;background:transparent;color:#6b7688'),
      glowStyle:'position:absolute;top:-180px;left:50%;transform:translateX(-50%);width:min(1100px,140vw);height:600px;background:radial-gradient(ellipse 50% 50% at 50% 50%,'+(isR?'rgba(201,163,91,.13)':'rgba(77,124,254,.12)')+',transparent 70%);pointer-events:none;z-index:0;transition:all .4s',
      ctaStyle:'font-size:15px;font-weight:700;border-radius:12px;padding:14px 28px;cursor:pointer;border:none;background:'+pa+';color:'+(isR?'#14243f':'#fff')+';display:inline-flex;align-items:center;gap:8px;white-space:nowrap;box-shadow:0 10px 26px '+(isR?'rgba(201,163,91,.35)':'rgba(77,124,254,.3)'),
      noteStyle:'display:inline-flex;align-items:center;gap:9px;font-size:13px;font-weight:700;color:'+paText+';background:'+paTint+';border-radius:100px;padding:9px 18px;line-height:1.4;text-align:left',
      eyebrowStyle:'display:inline-block;font-size:12.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:'+paText+';margin-bottom:14px',
      hlStyle:'color:'+(isR?goldText:blue),
      steps:[{n:'1',t:t.s1_t,d:t.s1_d},{n:'2',t:t.s2_t,d:t.s2_d},{n:'3',t:t.s3_t,d:t.s3_d}],
      faqs:[1,2,3,4].map(i=>({q:p['q'+i],a:p['a'+i],
        toggle:()=>this.setState(st=>({faqOpen:st.faqOpen===i-1?-1:i-1})),
        chev:'font-size:16px;color:#8a93a2;flex:none;transition:transform .2s;'+(s.faqOpen===i-1?'transform:rotate(180deg)':''),
        aStyle:s.faqOpen===i-1?'font-size:14px;color:#5a6472;line-height:1.6;padding-top:10px;text-wrap:pretty':'display:none'})),
      stepNumStyle:'width:40px;height:40px;border-radius:50%;background:'+paTint+';color:'+paText+';display:inline-flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;font-family:Manrope,sans-serif;margin-bottom:12px',
      otherBtnStyle:'font-size:13.5px;font-weight:700;border-radius:10px;padding:10px 18px;cursor:pointer;border:1px solid '+(isR?blue:gold)+';background:#fff;color:'+(isR?blue:goldText)+';display:inline-flex;align-items:center;gap:7px;white-space:nowrap',
      heroBoard:this.mkBoard(8,14,[{r:1,c:3},{r:4,c:9},{r:6,c:2},{r:0,c:8}][s.tick%4],s.selUnit),
      chTyping1:s.tick%7===0, chMsg1:s.tick%7>=1, chTyping2:s.tick%7===2, chMsg2:s.tick%7>=3, chLink:s.tick%7>=4,
      ...(()=>{const dtab=(s.tabTouchedAt!=null&&s.tick-s.tabTouchedAt<8)?s.devTab:['board','docs','pub'][Math.floor(s.tick/3)%3];
        const ts=(a)=>(dtab===a?'color:#14243f;background:#e3ebfd':'color:#8a93a2')+';font-size:10.5px;font-weight:700;border-radius:7px;padding:4px 10px;cursor:pointer;transition:all .15s';
        return {devIsBoard:dtab==='board',devIsDocs:dtab==='docs',devIsPub:dtab==='pub',
          tabBoardStyle:ts('board'),tabDocsStyle:ts('docs'),tabPubStyle:ts('pub')};})(),
      devTabBoard:()=>this.setState(st=>({devTab:'board',tabTouchedAt:st.tick})), devTabDocs:()=>this.setState(st=>({devTab:'docs',tabTouchedAt:st.tick})), devTabPub:()=>this.setState(st=>({devTab:'pub',tabTouchedAt:st.tick})),
      ...(()=>{
        const chip=(l,bg,fg)=>({l,st:'font-size:8.5px;font-weight:700;border-radius:100px;padding:2px 7px;white-space:nowrap;background:'+bg+';color:'+fg});
        const stageSt=(bg)=>'position:absolute;top:8px;left:8px;font-size:8.5px;font-weight:800;background:'+bg+';color:#fff;border-radius:100px;padding:3px 8px';
        const bar=(clr,w)=>'height:4px;border-radius:2px;background:'+clr+';width:'+w;
        return {pubCards:[
          {img:'megapolis-photos/web-front.jpg',stage:t.st_facade,stageStyle:stageSt('#7c5cd6'),iskan:true,live:false,name:'MEGAPOLIS RESIDENCE',loc:t.loc_mega,chips:[chip(t.tg_start,'#fdf2e4','#d98a1e'),chip(t.tg_com,'#fdf2e4','#d98a1e'),chip(t.tg_cit,'#efe9fb','#7c5cd6')],sold:'39%',onsale:'127',soldBar:bar('#4d7cfe','39%'),ready:'65%',readyBar:bar('#34c383','65%'),builder:'SERVEROĞLU İnşaat',units:'211'},
          {img:'diamond-photos/IMG-20250611-WA0060.jpg',stage:t.st_land,stageStyle:stageSt('#0f9d6b'),iskan:false,live:false,name:'YÜKSELEN DIAMOND',loc:t.loc_dia,chips:[chip(t.tg_open,'#e4f6ee','#0f9d6b'),chip(t.tg_vnj,'#e3ebfd','#3a63d4'),chip(t.tg_com,'#fdf2e4','#d98a1e')],sold:'59%',onsale:'16',soldBar:bar('#4d7cfe','59%'),ready:'92%',readyBar:bar('#34c383','92%'),builder:'Yükselen İnşaat',units:'63'},
          {img:'akropolis-photos/web-ph-1.jpg',stage:t.st_frame,stageStyle:stageSt('#3a63d4'),iskan:false,live:true,name:'AKROPOLIS RESIDENCE',loc:t.loc_akr,chips:[chip(t.tg_open,'#e4f6ee','#0f9d6b'),chip(t.tg_cit,'#efe9fb','#7c5cd6'),chip(t.tg_vnj,'#e3ebfd','#3a63d4')],sold:'90%',onsale:'26',soldBar:bar('#4d7cfe','90%'),ready:'45%',readyBar:bar('#34c383','45%'),builder:'SERVEROĞLU İnşaat',units:'250'}
        ]};})(),
      docs:[
        {n:t.doc1,m:'2.4 MB · 12.07',i:'ti-file-type-pdf',c:'#e5484d',bg:'rgba(229,72,77,.1)'},
        {n:t.doc2,m:'18 MB · 03.07',i:'ti-ruler-2',c:'#4d7cfe',bg:'rgba(77,124,254,.1)'},
        {n:t.doc3,m:'1.1 MB · 28.06',i:'ti-file-type-pdf',c:'#e5484d',bg:'rgba(229,72,77,.1)'},
        {n:t.doc4,m:'340 MB · 30.06',i:'ti-photo',c:'#0f9d6b',bg:'rgba(15,157,107,.1)'}
      ],
      spotIcon:isR?'ti-users-plus':'ti-refresh',
      legalOpen:!!s.legalDoc,
      legalTitle:s.legalDoc?t[s.legalDoc+'_t']:'',
      legalParas:s.legalDoc?t[s.legalDoc+'_p']:[],
      openKvkk:()=>this.setState({legalDoc:'kvkk'}),
      openPriv:()=>this.setState({legalDoc:'priv'}),
      closeLegal:()=>this.setState({legalDoc:null}),
      stopProp:(e)=>e.stopPropagation(),
      ...(()=>{const ui=this.unitInfo(s.selUnit.r,s.selUnit.c);
        const stMap={avail:{l:t.m_avail,bg:'#34c383'},res:{l:t.m_res,bg:'#f0ad00'},proc:{l:t.m_proc,bg:'#4d7cfe'},hold:{l:t.m_hold,bg:'#8b5cf6'},sold:{l:t.m_sold,bg:'#8a93a2'}};
        return {selNo:ui.no,selRooms:ui.rooms,selM2:ui.m2,selPrice:ui.price,selStatus:stMap[ui.stt].l,
          selChip:'font-size:10px;font-weight:700;border-radius:100px;padding:3px 9px;color:#fff;background:'+stMap[ui.stt].bg};})(),
      mockObjects:[
        {name:'ANTALYA · KONYAALTI',sub:'2+1 · 78 m² · 5/12',price:'$145 000',agent:'AK',agentBg:'#c9a35b',thumbBg:'linear-gradient(135deg,#dfe6f0,#c9d4e4)',dl:'0ms'},
        {name:'ANTALYA · LARA',sub:'1+1 · 54 m² · 8/14',price:'$98 500',agent:'SE',agentBg:'#7d9fdd',thumbBg:'linear-gradient(135deg,#dcebe0,#c4dbca)',dl:'90ms'},
        {name:'ANTALYA · AKSU',sub:'3+1 · 112 m² · 2/6',price:'$210 000',agent:'MT',agentBg:'#cf8f8f',thumbBg:'linear-gradient(135deg,#efe6d8,#e0d2bc)',dl:'180ms'}
      ],
      pFeatsA:[p.f1_t,p.f2_t].map((ft,i)=>({icon:featIcons[i],t:ft,d:[p.f1_d,p.f2_d][i],iconStyle})),
      pFeatsB:[p.f3_t,p.f4_t].map((ft,i)=>({icon:featIcons[i+2],t:ft,d:[p.f3_d,p.f4_d][i],iconStyle})),
      trustCards:[1,2,3,4].map(i=>({icon:['ti-gift','ti-users-group','ti-shield-lock','ti-file-type-pdf'][i-1],t:t['tr'+i+'_t'],d:t['tr'+i+'_d'],iconStyle})),
      crmTabs:[{l:t.crm_over,n:'',on:false},{l:t.crm_cl,n:'4',on:true},{l:t.crm_dl,n:'2',on:false},{l:t.crm_tk,n:'3',on:false}].map(x=>({l:x.l,n:x.n,st:'display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:700;border-radius:8px;padding:6px 10px;white-space:nowrap;'+(x.on?'background:#14243f;color:#fff':'color:#6b7688;background:#f4f6f9')})),
      crmRows:(()=>{const k=s.tick%8;const pulse=';animation:opPulse 1.5s ease infinite';
        const base=[
          {ini:'MA',bg:'#4d7cfe',name:'Mehmet A.',ph:'+90 5•• ••• 55 12',st:t.cst_work,stc:'#1565c0',stb:'#e7f0fd',dl:t.cdl_open,dlc:'#0f9d6b',dlb:'#e4f6ee',act:t.cact_1},
          {ini:'OK',bg:'#c9a35b',name:'Olga K.',ph:'+90 5•• ••• 83 40',st:t.cst_show,stc:'#7b4fd0',stb:'#efe7fb',dl:k>=6?t.cdl_open:t.cdl_none,dlc:k>=6?'#0f9d6b':'#8a93a2',dlb:k>=6?'#e4f6ee':'#f0f2f6',dlx:k>=6?pulse:'',act:k>=4?t.cact_2b:t.cact_2},
          {ini:'DS',bg:'#0f9d6b',name:'Daniel S.',ph:'+49 1•• ••• 77 21',st:k>=5?t.cst_show:k>=2?t.cst_work:t.cst_new,stc:k>=5?'#7b4fd0':k>=2?'#1565c0':'#9c7420',stb:k>=5?'#efe7fb':k>=2?'#e7f0fd':'#fdf5df',stx:(k===2||k===5)?pulse:'',dl:t.cdl_none,dlc:'#8a93a2',dlb:'#f0f2f6',act:t.cact_3},
          {ini:'NR',bg:'#e5484d',name:'Natalya R.',ph:'+7 9•• ••• 14 06',st:t.cst_visit,stc:'#c2410c',stb:'#feeadb',dl:t.cdl_open,dlc:'#0f9d6b',dlb:'#e4f6ee',act:t.cact_4}
        ];
        const lead={ini:'AT',bg:'#7b4fd0',name:'Ayşe T.',ph:'+90 5•• ••• 20 97',st:t.cst_lead,stc:'#b42318',stb:'#fde8e8',stx:pulse,dl:t.cdl_none,dlc:'#8a93a2',dlb:'#f0f2f6',act:t.cact_0,live:true};
        const rows=k>=1?[lead,...base.slice(0,3)]:base;
        return rows.map((r,i)=>({...r,stx:r.stx||'',dlx:r.dlx||'',live:!!r.live,d:(i*80)+'ms'}));})(),
      gotoApp:()=>this.gotoApp(),
      scrollToForm:()=>{const el=document.getElementById('lp-lead');if(el)window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-70);},
      pickRoleR:()=>this.setState({role:'r'}),
      pickRoleD:()=>this.setState({role:'d'}),
      roleRStyle:roleBase+(s.role==='r'?'border:1px solid '+gold+';background:rgba(201,163,91,.2);color:#e9d9ba':'border:1px solid #33456a;background:transparent;color:#8fa0bd'),
      roleDStyle:roleBase+(s.role==='d'?'border:1px solid '+blue+';background:rgba(77,124,254,.2);color:#a5bdff':'border:1px solid #33456a;background:transparent;color:#8fa0bd'),
      formGlowStyle:'position:absolute;top:-140px;left:50%;transform:translateX(-50%);width:600px;height:340px;background:radial-gradient(ellipse 50% 50% at 50% 50%,'+(isR?'rgba(201,163,91,.18)':'rgba(77,124,254,.22)')+',transparent 70%);pointer-events:none',
      leadFormShow:!s.leadDone, leadDone:s.leadDone,
      leadName:s.leadName, leadCo:s.leadCo, leadPhone:s.leadPhone, leadMail:s.leadMail, leadMsg:s.leadMsg,
      onLeadName:bind('leadName'), onLeadCo:bind('leadCo'), onLeadMail:bind('leadMail'), onLeadMsg:bind('leadMsg'),
      onLeadPhone:(e)=>{let d=e.target.value.replace(/\D/g,'');if(d.startsWith('90'))d=d.slice(2);if(d.startsWith('0'))d=d.slice(1);d=d.replace(/^[0-46-9]+/,'');this.setState({leadPhone:d.slice(0,10)});},
      leadPhoneFmt:s.leadPhone?(s.leadPhone.slice(0,3)+(s.leadPhone.length>3?' '+s.leadPhone.slice(3,6):'')+(s.leadPhone.length>6?' '+s.leadPhone.slice(6,8):'')+(s.leadPhone.length>8?' '+s.leadPhone.slice(8,10):'')):'',
      leadInputStyle:li(false),
      leadPhoneStyle:li(s.leadPhone&&!phoneOk)+';padding-left:52px',
      leadMailStyle:li(s.leadMail&&!mailOk),
      toggleLeadC:()=>this.setState(st=>({leadC:!st.leadC})),
      leadChk:'width:20px;height:20px;border-radius:6px;flex:none;display:flex;align-items:center;justify-content:center;color:#fff;'+(s.leadC?'background:'+blue:'background:transparent;border:1.5px solid #4a5c7e;color:transparent'),
      leadBtnStyle:'width:100%;margin-top:16px;background:'+pa+';color:'+(isR?'#14243f':'#fff')+';border:none;border-radius:12px;padding:15px;font-size:15px;font-weight:700;cursor:pointer;'+((s.leadName&&phoneOk&&mailOk&&s.leadC)?'':'opacity:.5;pointer-events:none'),
      submitLead:()=>{if(s.leadName&&phoneOk&&mailOk&&s.leadC)this.submit();}
    };
  },
};
/** Все значения для разметки (`renderVals` прототипа). */
export function landingVals(ctx) { return C.renderVals.call(Object.assign(Object.create(C), ctx)); }
