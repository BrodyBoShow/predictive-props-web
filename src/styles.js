// Global stylesheet (injected via <style>{S}</style> in App.jsx).

export const S = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Azeret+Mono:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}

  /* ── BACKGROUND ─────────────────────────────────────────────────────── */
  body{
    background:#060b18;
    background-image:
      radial-gradient(ellipse 90% 55% at 50% -5%,  rgba(37,99,235,.22)  0%, transparent 58%),
      radial-gradient(ellipse 65% 45% at 85% 85%,  rgba(99,102,241,.10) 0%, transparent 52%),
      radial-gradient(ellipse 55% 35% at 10% 75%,  rgba(16,185,129,.06) 0%, transparent 48%);
    color:#c8d4e8;
    font-family:'Space Grotesk',sans-serif;
    min-height:100vh;
    -webkit-font-smoothing:antialiased;
  }
  /* Top-edge glow */
  body::before{
    content:"";position:fixed;top:0;left:0;right:0;height:3px;
    background:linear-gradient(90deg,transparent 0%,rgba(37,99,235,.6) 30%,rgba(99,102,241,.8) 50%,rgba(37,99,235,.6) 70%,transparent 100%);
    z-index:9999;
  }

  /* ── ANIMATIONS ──────────────────────────────────────────────────────── */
  @keyframes rp-in{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes num-pop{0%{opacity:0;transform:scale(.84)}60%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
  @keyframes grade-pulse{0%,100%{box-shadow:inherit}50%{filter:brightness(1.15)}}
  @keyframes pill-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .rp{animation:rp-in .45s cubic-bezier(.22,1,.36,1);}
  .proj-hero-num{animation:num-pop .55s cubic-bezier(.34,1.56,.64,1);}
  .grade-badge-hero{animation:num-pop .65s cubic-bezier(.34,1.56,.64,1) .08s both;}

  /* ── ROOT ───────────────────────────────────────────────────────────── */
  .root{max-width:820px;margin:0 auto;padding:36px 18px 96px;position:relative;z-index:1;}

  /* ── HEADER ─────────────────────────────────────────────────────────── */
  .header{margin-bottom:40px;padding-top:16px;}
  .htag{
    font-family:'Azeret Mono',monospace;font-size:11px;letter-spacing:.32em;
    color:#3b82f6;text-transform:uppercase;margin-bottom:12px;font-weight:600;
    display:inline-flex;align-items:center;gap:8px;
  }
  .htag::before{content:'';display:inline-block;width:20px;height:1px;background:#3b82f6;}
  h1{font-size:clamp(38px,7.5vw,72px);font-weight:800;line-height:.9;color:#e8f0ff;letter-spacing:-.03em;}
  h1 span{
    background:linear-gradient(135deg,#60a5fa 0%,#3b82f6 40%,#2563eb 100%);
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .dbanner{
    display:inline-flex;align-items:center;gap:8px;margin-top:16px;
    font-family:'Azeret Mono',monospace;font-size:11px;letter-spacing:.16em;
    color:#10b981;background:rgba(16,185,129,.08);
    border:1px solid rgba(16,185,129,.28);border-radius:99px;padding:5px 14px;font-weight:600;
  }
  .dbanner::before{content:'●';font-size:8px;}

  /* ── SECTION STRUCTURE — z-index fix for dropdown ──────────────────── */
  /* Each .sec creates its own stacking context so later ones don't occlude earlier dropdowns */
  .sec{margin-bottom:16px;position:relative;z-index:1;}
  /* Player section: elevate above prop/line sections so dropdown floats over them */
  .sec:has(.acw){z-index:50;}

  /* ── SECTION LABEL ──────────────────────────────────────────────────── */
  .slabel{
    font-family:'Azeret Mono',monospace;font-size:11px;letter-spacing:.26em;
    text-transform:uppercase;color:#3b82f6;margin-bottom:10px;
    display:flex;align-items:center;gap:12px;font-weight:700;
  }
  .slabel::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(37,99,235,.3) 0%,transparent 100%);}

  /* ── GLASSMORPHISM CARD ─────────────────────────────────────────────── */
  /* backdrop-filter creates a stacking context — fine since .sec manages z-order */
  .card{
    background:linear-gradient(155deg,rgba(255,255,255,.062) 0%,rgba(255,255,255,.022) 100%);
    backdrop-filter:blur(18px) saturate(160%);
    -webkit-backdrop-filter:blur(18px) saturate(160%);
    border:1px solid rgba(255,255,255,.1);
    border-top:1px solid rgba(255,255,255,.18);   /* shimmer top edge */
    border-radius:16px;padding:20px;
    box-shadow:
      0 4px 28px rgba(0,0,0,.32),
      0 1px 0 rgba(255,255,255,.1) inset;
  }

  /* ── GAME LIST ──────────────────────────────────────────────────────── */
  .ggl{font-family:'Azeret Mono',monospace;font-size:11px;color:#10b981;letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px;font-weight:600;}
  .ggl.up{color:#f59e0b;}
  .glist{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
  .grow{
    display:flex;justify-content:space-between;align-items:center;
    padding:13px 16px;
    border:1px solid rgba(255,255,255,.07);
    border-radius:12px;cursor:pointer;
    transition:all .2s cubic-bezier(.4,0,.2,1);gap:10px;
    background:rgba(255,255,255,.02);
  }
  .grow:hover{
    border-color:rgba(59,130,246,.4);
    background:rgba(59,130,246,.06);
    transform:translateX(3px);
    box-shadow:0 4px 16px rgba(37,99,235,.1);
  }
  .grow.sel{
    border-color:rgba(59,130,246,.7);
    background:linear-gradient(135deg,rgba(37,99,235,.18) 0%,rgba(37,99,235,.06) 100%);
    box-shadow:0 4px 20px rgba(37,99,235,.22),0 0 0 1px rgba(59,130,246,.2) inset;
  }
  .gteams{font-size:15px;font-weight:700;color:#e8f0ff;letter-spacing:.01em;}
  .gvs{color:#2a3a52;margin:0 7px;font-weight:400;}
  .gmeta{font-size:12px;color:#4a5a74;margin-top:3px;line-height:1.5;}
  .gtime{font-family:'Azeret Mono',monospace;font-size:11px;color:#10b981;white-space:nowrap;font-weight:600;letter-spacing:.05em;}
  .gtime.up{color:#f59e0b;}

  /* ── PLAYER SEARCH ──────────────────────────────────────────────────── */
  .acw{position:relative;}
  .ti{
    width:100%;
    background:rgba(255,255,255,.05);
    border:1px solid rgba(255,255,255,.1);
    border-radius:10px;padding:13px 16px;
    font-size:14px;color:#e8f0ff;
    font-family:'Space Grotesk',sans-serif;
    outline:none;
    transition:border-color .18s,box-shadow .18s;
    box-shadow:0 2px 10px rgba(0,0,0,.15),0 1px 0 rgba(255,255,255,.05) inset;
  }
  .ti:focus{
    border-color:#3b82f6;
    box-shadow:0 0 0 3px rgba(59,130,246,.18),0 2px 10px rgba(0,0,0,.15);
  }
  .ti::placeholder{color:#1e2e48;}
  .ti:disabled{opacity:.35;cursor:not-allowed;}

  /* Dropdown — position:fixed to fully escape any stacking context */
  .dd{
    position:absolute;top:calc(100% + 6px);left:0;right:0;
    background:rgba(6,11,24,.97);
    backdrop-filter:blur(20px) saturate(200%);
    -webkit-backdrop-filter:blur(20px) saturate(200%);
    border:1px solid rgba(59,130,246,.35);
    border-radius:14px;overflow:hidden;
    z-index:9999;
    box-shadow:0 24px 64px rgba(0,0,0,.8),0 0 0 1px rgba(59,130,246,.1) inset;
    max-height:340px;overflow-y:auto;
  }
  .dd::-webkit-scrollbar{width:4px;}
  .dd::-webkit-scrollbar-track{background:transparent;}
  .dd::-webkit-scrollbar-thumb{background:rgba(59,130,246,.3);border-radius:2px;}
  .ddt{
    font-family:'Azeret Mono',monospace;font-size:11px;letter-spacing:.16em;
    color:#3b82f6;padding:8px 14px 6px;
    background:rgba(37,99,235,.07);
    border-bottom:1px solid rgba(37,99,235,.12);text-transform:uppercase;
    position:sticky;top:0;
  }
  .ddp{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 14px;cursor:pointer;
    transition:background .12s;border-bottom:1px solid rgba(255,255,255,.03);
  }
  .ddp:hover,.ddp.sel{background:rgba(37,99,235,.12);}
  .ddn{font-size:13px;font-weight:600;color:#e8f0ff;}
  .ddr{display:flex;align-items:center;gap:6px;}
  .ddpos{font-family:'Azeret Mono',monospace;font-size:10px;color:#2a3a52;background:rgba(255,255,255,.05);padding:2px 6px;border-radius:4px;}
  .ddst{font-family:'Azeret Mono',monospace;font-size:10px;color:#3b82f6;}
  .dinj{font-family:'Azeret Mono',monospace;font-size:10px;padding:2px 6px;border-radius:4px;margin-left:5px;}
  .dinj.out{background:rgba(239,68,68,.14);color:#ef4444;border:1px solid rgba(239,68,68,.2);}
  .dinj.gtd{background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.2);}
  .pconf{
    margin-top:10px;display:flex;gap:12px;align-items:center;
    font-family:'Azeret Mono',monospace;font-size:11px;
    background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.18);
    border-radius:8px;padding:7px 12px;flex-wrap:wrap;line-height:1.6;
  }
  .pcn{color:#10b981;font-weight:600;} .pcs{color:#3a5070;}

  /* ── PROP PICKER ────────────────────────────────────────────────────── */
  .pgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
  @media(max-width:480px){.pgrid{grid-template-columns:repeat(3,1fr);}}
  .pbtn{
    position:relative;overflow:hidden;
    background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.08);
    border-radius:12px;padding:14px 8px;
    cursor:pointer;text-align:center;
    transition:all .22s cubic-bezier(.4,0,.2,1);
    color:#c8d4e8;
  }
  .pbtn::after{
    content:'';position:absolute;inset:0;border-radius:12px;
    background:linear-gradient(180deg,rgba(255,255,255,.06) 0%,transparent 50%);
    pointer-events:none;
  }
  .pbtn:hover{
    border-color:rgba(59,130,246,.45);
    background:rgba(37,99,235,.08);
    transform:translateY(-3px);
    box-shadow:0 10px 28px rgba(37,99,235,.16);
  }
  .pbtn.sel{
    border-color:rgba(59,130,246,.8);
    background:linear-gradient(160deg,rgba(37,99,235,.22) 0%,rgba(37,99,235,.08) 100%);
    box-shadow:0 6px 22px rgba(37,99,235,.32),0 0 0 1px rgba(59,130,246,.3) inset;
  }
  .pbtn.sel::before{
    content:"";position:absolute;top:0;left:10%;right:10%;height:2px;
    background:linear-gradient(90deg,transparent,#3b82f6,transparent);
    border-radius:0 0 2px 2px;
  }
  .pico{font-size:20px;margin-bottom:6px;line-height:1;display:block;}
  .psh{font-family:'Azeret Mono',monospace;font-size:11px;color:#3b82f6;font-weight:700;letter-spacing:.06em;}
  .pnm{font-size:10px;color:#4a5a74;margin-top:3px;letter-spacing:.01em;}
  .pbtn.sel .psh{color:#60a5fa;}
  .pbtn.sel .pnm{color:#7a8ea8;}

  /* ── LINE INPUT ─────────────────────────────────────────────────────── */
  .lwrap{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
  .li{
    background:rgba(37,99,235,.07);
    border:1px solid rgba(59,130,246,.35);
    border-top:1px solid rgba(59,130,246,.55);
    border-radius:10px;padding:10px 16px;
    font-size:24px;font-family:'Azeret Mono',monospace;
    color:#e8f0ff;width:108px;outline:none;text-align:center;
    transition:border-color .18s,box-shadow .18s;
    box-shadow:0 4px 14px rgba(0,0,0,.18),0 1px 0 rgba(255,255,255,.08) inset;
    font-weight:600;
  }
  .li:focus{
    border-color:rgba(59,130,246,.9);
    box-shadow:0 0 0 3px rgba(59,130,246,.2),0 4px 14px rgba(0,0,0,.18);
  }
  .lh{font-size:12px;color:#3a4a62;line-height:1.6;}

  /* ── RUN / GHOST BUTTONS ────────────────────────────────────────────── */
  .btnr{
    background:linear-gradient(175deg,#3b82f6 0%,#1d4ed8 100%);
    color:#fff;border:none;border-radius:10px;
    padding:14px 30px;font-size:14px;font-weight:700;
    font-family:'Space Grotesk',sans-serif;cursor:pointer;
    transition:all .22s cubic-bezier(.4,0,.2,1);letter-spacing:.04em;
    box-shadow:0 4px 20px rgba(37,99,235,.45),0 1px 0 rgba(255,255,255,.2) inset;
    position:relative;overflow:hidden;
  }
  .btnr::after{
    content:'';position:absolute;inset:0;
    background:linear-gradient(180deg,rgba(255,255,255,.12) 0%,transparent 60%);
    pointer-events:none;
  }
  .btnr:hover{
    box-shadow:0 8px 32px rgba(37,99,235,.6);
    transform:translateY(-2px);
  }
  .btnr:active{transform:translateY(0);box-shadow:0 4px 14px rgba(37,99,235,.4);}
  .btnr:disabled{background:rgba(255,255,255,.05);color:#1e2e48;cursor:not-allowed;box-shadow:none;transform:none;}
  .btng{
    background:rgba(37,99,235,.07);color:#3b82f6;
    border:1px solid rgba(59,130,246,.35);
    border-radius:10px;padding:13px 20px;
    font-size:12px;font-weight:600;font-family:'Space Grotesk',sans-serif;
    cursor:pointer;transition:all .18s;letter-spacing:.02em;
    box-shadow:0 2px 8px rgba(0,0,0,.1);
  }
  .btng:hover{background:rgba(37,99,235,.14);border-color:rgba(59,130,246,.6);box-shadow:0 4px 16px rgba(37,99,235,.14);}

  /* ── RESULT PANEL ───────────────────────────────────────────────────── */
  .rp{
    margin-top:24px;
    background:linear-gradient(155deg,rgba(37,99,235,.1) 0%,rgba(37,99,235,.03) 100%);
    backdrop-filter:blur(18px) saturate(160%);
    -webkit-backdrop-filter:blur(18px) saturate(160%);
    border:1px solid rgba(59,130,246,.32);
    border-top:1px solid rgba(59,130,246,.5);
    border-radius:18px;padding:26px;
    box-shadow:0 8px 36px rgba(0,0,0,.32),0 1px 0 rgba(255,255,255,.08) inset;
    transition:box-shadow .55s ease,border-color .55s ease,background .55s ease;
  }
  .rp[data-grade="LOCK"]{
    background:linear-gradient(155deg,rgba(168,85,247,.13) 0%,rgba(168,85,247,.04) 100%);
    border-color:rgba(168,85,247,.6);
    border-top-color:rgba(168,85,247,.8);
    box-shadow:
      0 12px 48px rgba(0,0,0,.35),
      0 0 100px rgba(168,85,247,.18),
      0 0 30px rgba(168,85,247,.14),
      0 1px 0 rgba(255,255,255,.08) inset;
  }
  .rp[data-grade="ACTIONABLE"]{
    background:linear-gradient(155deg,rgba(16,185,129,.11) 0%,rgba(16,185,129,.03) 100%);
    border-color:rgba(16,185,129,.55);
    border-top-color:rgba(16,185,129,.75);
    box-shadow:
      0 12px 48px rgba(0,0,0,.32),
      0 0 90px rgba(16,185,129,.15),
      0 0 26px rgba(16,185,129,.12),
      0 1px 0 rgba(255,255,255,.08) inset;
  }
  .rp[data-grade="WATCH"]{
    background:linear-gradient(155deg,rgba(37,99,235,.12) 0%,rgba(37,99,235,.04) 100%);
    border-color:rgba(59,130,246,.55);
    border-top-color:rgba(59,130,246,.75);
    box-shadow:
      0 12px 44px rgba(0,0,0,.32),
      0 0 80px rgba(37,99,235,.14),
      0 0 22px rgba(37,99,235,.12),
      0 1px 0 rgba(255,255,255,.07) inset;
  }
  .rp[data-grade="SKIP"]{
    border-color:rgba(100,116,139,.28);
    border-top-color:rgba(100,116,139,.45);
    box-shadow:0 8px 32px rgba(0,0,0,.24),0 1px 0 rgba(255,255,255,.05) inset;
  }

  /* ── RESULT HEADER ──────────────────────────────────────────────────── */
  .rh{
    display:flex;justify-content:space-between;align-items:flex-start;
    gap:14px;margin-bottom:20px;flex-wrap:wrap;
    padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.06);
  }
  .rpn{font-size:28px;font-weight:800;color:#e8f0ff;letter-spacing:-.02em;line-height:1.1;}
  .rpm{font-family:'Azeret Mono',monospace;font-size:11px;color:#4a5a74;margin-top:6px;letter-spacing:.03em;line-height:1.65;}
  .rsrc{
    font-family:'Azeret Mono',monospace;font-size:10px;color:#10b981;
    background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);
    border-radius:99px;padding:4px 12px;margin-top:8px;display:inline-block;letter-spacing:.1em;
  }

  /* ── VERDICT BADGE ──────────────────────────────────────────────────── */
  .vb{
    display:flex;flex-direction:column;align-items:center;
    padding:13px 24px;border-radius:14px;
    transition:all .25s;box-shadow:0 4px 20px rgba(0,0,0,.2);
    min-width:90px;
  }
  .vb.over{background:linear-gradient(160deg,rgba(16,185,129,.18) 0%,rgba(16,185,129,.05) 100%);border:1px solid rgba(16,185,129,.4);}
  .vb.under{background:linear-gradient(160deg,rgba(239,68,68,.16) 0%,rgba(239,68,68,.04) 100%);border:1px solid rgba(239,68,68,.35);}
  .vb.push{background:linear-gradient(160deg,rgba(245,158,11,.15) 0%,rgba(245,158,11,.04) 100%);border:1px solid rgba(245,158,11,.35);}
  .vt{font-size:22px;font-weight:800;letter-spacing:.08em;}
  .vt.over{color:#10b981;} .vt.under{color:#ef4444;} .vt.push{color:#f59e0b;}
  .vc{font-family:'Azeret Mono',monospace;font-size:11px;color:#2a3550;margin-top:5px;letter-spacing:.16em;font-weight:700;}

  /* ── STAT BLOCKS ────────────────────────────────────────────────────── */
  .sr{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
  .sb{
    background:rgba(255,255,255,.03);
    border:1px solid rgba(255,255,255,.08);
    border-top:1px solid rgba(255,255,255,.14);
    border-radius:12px;padding:14px 16px;
    transition:all .2s cubic-bezier(.4,0,.2,1);
  }
  .sb:hover{border-color:rgba(255,255,255,.16);transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,.16);}
  .sb.hi{
    border-color:rgba(59,130,246,.45);
    border-top-color:rgba(59,130,246,.65);
    background:linear-gradient(155deg,rgba(37,99,235,.14) 0%,rgba(37,99,235,.03) 100%);
    box-shadow:0 4px 18px rgba(37,99,235,.12);
  }
  .sbl{font-family:'Azeret Mono',monospace;font-size:10px;color:#3a4a62;letter-spacing:.16em;margin-bottom:8px;text-transform:uppercase;font-weight:700;}
  .sbv{font-size:26px;font-weight:800;color:#e8f0ff;line-height:1;letter-spacing:-.01em;}
  .sbv.bl{color:#3b82f6;}
  .sbs{font-family:'Azeret Mono',monospace;font-size:10px;color:#344860;margin-top:5px;line-height:1.5;}

  /* ── METRICS BLOCK ──────────────────────────────────────────────────── */
  .mb{
    background:rgba(0,0,0,.22);
    border:1px solid rgba(255,255,255,.06);
    border-radius:10px;padding:14px;margin-bottom:14px;
  }
  .mbt{font-family:'Azeret Mono',monospace;font-size:10px;color:#2a3a52;letter-spacing:.18em;text-transform:uppercase;margin-bottom:12px;font-weight:700;}
  .mr{
    display:flex;justify-content:space-between;align-items:baseline;
    padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);
    font-size:12px;line-height:1.65;
  }
  .mr:last-child{border-bottom:none;}
  .mk{color:#4a5a74;} .mv{font-family:'Azeret Mono',monospace;color:#c8d4e8;font-size:12px;}
  .mv.pos{color:#10b981;} .mv.neg{color:#ef4444;} .mv.acc{color:#3b82f6;font-weight:600;}
  .mf{
    font-family:'Azeret Mono',monospace;font-size:11px;color:#3b82f6;
    margin-top:10px;background:rgba(37,99,235,.07);
    border:1px solid rgba(37,99,235,.14);border-radius:6px;padding:6px 12px;line-height:1.5;
  }

  /* ── CONTEXT GRID ───────────────────────────────────────────────────── */
  .cg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}
  .cc{
    background:rgba(255,255,255,.025);
    border:1px solid rgba(255,255,255,.07);
    border-radius:10px;padding:10px 13px;
    transition:border-color .15s;
  }
  .cc:hover{border-color:rgba(255,255,255,.13);}
  .ccl{font-family:'Azeret Mono',monospace;font-size:10px;color:#2a3a52;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;font-weight:700;}
  .ccv{font-size:13px;color:#c8d4e8;font-weight:500;line-height:1.4;}
  .ccs{font-family:'Azeret Mono',monospace;font-size:10px;color:#1a2a3a;margin-top:3px;line-height:1.5;}

  /* ── PROGRESS / TRACK BARS ──────────────────────────────────────────── */
  .et{height:4px;background:rgba(255,255,255,.05);border-radius:2px;margin:12px 0;overflow:hidden;}
  .ef{height:100%;border-radius:2px;transition:width .85s cubic-bezier(.16,1,.3,1);}
  .div{height:1px;background:rgba(255,255,255,.05);margin:14px 0;}

  /* ── INJURY BANNERS ─────────────────────────────────────────────────── */
  .injb{
    display:flex;gap:8px;align-items:center;
    background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.22);
    border-radius:8px;padding:8px 12px;margin-bottom:12px;
    font-family:'Azeret Mono',monospace;font-size:11px;color:#ef4444;
    letter-spacing:.05em;line-height:1.55;
  }
  .injb.gtd{background:rgba(245,158,11,.06);border-color:rgba(245,158,11,.22);color:#f59e0b;}

  /* ── NOTES ──────────────────────────────────────────────────────────── */
  .dn{
    font-family:'Azeret Mono',monospace;font-size:10px;color:#1e2a3a;
    margin-top:14px;border-top:1px solid rgba(255,255,255,.04);
    padding-top:12px;line-height:1.8;
  }

  /* ── ERROR ──────────────────────────────────────────────────────────── */
  .err{
    background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.22);
    border-radius:10px;padding:12px 16px;font-size:12px;color:#f87171;
    margin-top:12px;font-family:'Azeret Mono',monospace;line-height:1.65;
  }

  /* ── BULK TABLE CONTAINER ───────────────────────────────────────────── */
  .bulk-table-container{
    background:linear-gradient(180deg,rgba(255,255,255,.045) 0%,rgba(255,255,255,.018) 100%);
    backdrop-filter:blur(16px) saturate(160%);
    -webkit-backdrop-filter:blur(16px) saturate(160%);
    border:1px solid rgba(255,255,255,.12);
    border-top:1px solid rgba(255,255,255,.2);
    border-radius:16px;overflow:hidden;
    box-shadow:0 8px 40px rgba(0,0,0,.36),0 1px 0 rgba(255,255,255,.1) inset;
  }

  /* ── METRIC CHIPS ───────────────────────────────────────────────────── */
  .chip{
    display:inline-flex;align-items:center;gap:4px;
    font-family:'Azeret Mono',monospace;font-size:11px;font-weight:600;
    padding:2px 9px;border-radius:99px;vertical-align:middle;
  }
  .chip-green{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.28);}
  .chip-red{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.22);}
  .chip-blue{background:rgba(37,99,235,.12);color:#3b82f6;border:1px solid rgba(59,130,246,.28);}
  .chip-yellow{background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.22);}
  .chip-purple{background:rgba(168,85,247,.12);color:#a855f7;border:1px solid rgba(168,85,247,.28);}

  /* ── FLEX GAUGE ─────────────────────────────────────────────────────── */
  .gauge-wrap{display:flex;align-items:center;gap:8px;}
  .gauge-bar{flex:1;height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;}
  .gauge-fill{height:100%;border-radius:3px;transition:width .65s cubic-bezier(.16,1,.3,1);}

  /* ── FLOATING ICON ──────────────────────────────────────────────────── */
  .float-icon{
    display:inline-flex;align-items:center;justify-content:center;
    width:30px;height:30px;border-radius:8px;font-size:14px;flex-shrink:0;
    transition:transform .2s cubic-bezier(.4,0,.2,1);
  }
  .float-icon:hover{transform:scale(1.12);}

  /* ── BET CARDS — bulk winning props board ──────────────────────────── */
  .bet-cards-grid{
    display:flex;
    flex-wrap:wrap;
    align-items:stretch;
    gap:10px;
  }
  .bet-card{
    flex:0 0 240px;
    min-height:316px;
    background:rgba(8,15,30,0.80);
    border:1px solid;
    border-radius:12px;
    overflow:hidden;
    display:flex;
    flex-direction:column;
    cursor:pointer;
    transition:transform .15s ease,box-shadow .15s ease;
    font-family:'Azeret Mono',monospace;
  }
  .bet-card:hover{transform:translateY(-3px);box-shadow:0 12px 36px rgba(0,0,0,.55);}
  .bet-card-stripe{height:3px;width:100%;flex-shrink:0;}
  .bet-card-head{padding:10px 13px 6px;}
  .bet-card-grade{
    font-size:8px;font-weight:800;letter-spacing:.2em;
    display:block;margin-bottom:3px;
  }
  .bet-card-player{
    font-size:13px;font-weight:700;color:#e2e8f0;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;
  }
  .bet-card-sub{font-size:9px;color:#475569;margin-top:2px;display:block;letter-spacing:.04em;}
  .bet-card-core{
    padding:9px 13px;
    background:rgba(0,0,0,.25);
    display:flex;
    align-items:center;
    justify-content:space-between;
    flex:1;
  }
  .bet-card-dir{font-size:10px;font-weight:800;letter-spacing:.1em;}
  .bet-card-nums{display:flex;align-items:baseline;gap:4px;margin-top:3px;}
  .bet-card-line{color:#475569;font-size:11px;}
  .bet-card-arr{color:#1e293b;font-size:10px;}
  .bet-card-proj{font-size:18px;font-weight:800;}
  .bet-card-delta{font-size:9px;font-weight:600;margin-top:2px;}
  .bet-card-ev{font-size:15px;font-weight:800;line-height:1;}
  .bet-card-ev-label{font-size:8px;color:#334155;margin-top:2px;letter-spacing:.1em;}
  .bet-card-foot{
    padding:7px 13px;
    display:flex;align-items:center;gap:8px;flex-wrap:wrap;
    border-top:1px solid rgba(255,255,255,.04);
  }
  .bet-card-tscore{font-size:10px;font-weight:600;}
  .bet-card-kelly{font-size:9px;color:#818cf8;}
  .bet-card-flag{font-size:9px;}
  /* Watch rows */
  .bet-watch-row{
    display:flex;align-items:center;
    padding:6px 0;
    border-bottom:1px solid rgba(255,255,255,.03);
    font-family:'Azeret Mono',monospace;font-size:11px;
    cursor:pointer;transition:background .1s;border-radius:4px;
  }
  .bet-watch-row:hover{background:rgba(245,158,11,.05);}

  .shot-chart-card{
    background:rgba(15,23,42,.46);
    border:1px solid rgba(255,255,255,.08);
    border-radius:12px;
    padding:12px;
  }
  .shot-chart-head{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:12px;
    margin-bottom:10px;
  }
  .shot-chart-title{
    font-family:'Azeret Mono',monospace;
    font-size:9px;
    letter-spacing:.2em;
    color:#38bdf8;
    font-weight:900;
  }
  .shot-chart-sub{
    font-size:10px;
    color:#64748b;
    margin-top:3px;
  }
  .shot-chart-summary{
    font-family:'Azeret Mono',monospace;
    color:#e8f0ff;
    font-size:12px;
    font-weight:800;
  }
  .shot-chart-body{
    display:grid;
    grid-template-columns:minmax(260px,1fr) minmax(170px,.42fr);
    gap:12px;
    align-items:stretch;
  }
  .shot-chart-svg{
    width:100%;
    height:260px;
    border-radius:10px;
    border:1px solid rgba(148,163,184,.10);
    background:#071122;
  }
  .shot-zone-list{
    display:grid;
    gap:6px;
    align-content:start;
  }
  .shot-zone-row{
    display:grid;
    grid-template-columns:1fr auto auto auto;
    gap:8px;
    align-items:center;
    background:rgba(2,6,23,.28);
    border:1px solid rgba(148,163,184,.10);
    border-radius:8px;
    padding:8px 9px;
    font-size:11px;
    color:#94a3b8;
  }
  .shot-zone-row b{color:#e8f0ff;font-family:'Azeret Mono',monospace;font-size:10px;}
  .shot-zone-row em{color:#10b981;font-style:normal;font-family:'Azeret Mono',monospace;font-size:10px;}
  .shot-zone-row strong{font-family:'Azeret Mono',monospace;font-size:9px;font-weight:800;text-align:right;}
  @media (max-width:720px){
    .shot-chart-body{grid-template-columns:1fr;}
    .shot-chart-svg{height:230px;}
  }
`;
