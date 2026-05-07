// Global stylesheet (injected via <style>{S}</style> in App.jsx).

export const S = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Azeret+Mono:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:radial-gradient(ellipse at top, #0a1224 0%, #05080f 60%);color:#c8d4e8;font-family:'Space Grotesk',sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;}
  body::before{content:"";position:fixed;top:0;left:0;right:0;height:280px;background:radial-gradient(ellipse at top,rgba(37,99,235,.08) 0%,transparent 70%);pointer-events:none;z-index:0;}
  .root{max-width:820px;margin:0 auto;padding:32px 18px 96px;position:relative;z-index:1;}
  .header{margin-bottom:36px;}
  .htag{font-family:'Azeret Mono',monospace;font-size:10px;letter-spacing:.3em;color:#2563eb;text-transform:uppercase;margin-bottom:10px;font-weight:600;}
  h1{font-size:clamp(40px,8vw,76px);font-weight:800;line-height:.92;color:#e8f0ff;letter-spacing:-.025em;}
  h1 span{background:linear-gradient(135deg,#3b82f6 0%,#2563eb 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;}
  .dbanner{display:inline-flex;align-items:center;gap:8px;margin-top:14px;font-family:'Azeret Mono',monospace;font-size:9.5px;letter-spacing:.18em;color:#10b981;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.25);border-radius:99px;padding:5px 12px;font-weight:600;}
  .dbanner::before{content:'●';}
  .slabel{font-family:'Azeret Mono',monospace;font-size:10px;letter-spacing:.28em;text-transform:uppercase;color:#2563eb;margin-bottom:12px;display:flex;align-items:center;gap:10px;font-weight:700;}
  .slabel::after{content:'';flex:1;height:1px;background:rgba(37,99,235,.15);}
  .sec{margin-bottom:16px;}
  .card{background:linear-gradient(180deg,rgba(255,255,255,.035) 0%,rgba(255,255,255,.012) 100%);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:20px;box-shadow:0 4px 18px rgba(0,0,0,.12);}
  .ggl{font-family:'Azeret Mono',monospace;font-size:9px;color:#10b981;letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px;}
  .ggl.up{color:#f59e0b;}
  .glist{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
  .grow{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border:1px solid rgba(255,255,255,.06);border-radius:12px;cursor:pointer;transition:all .18s cubic-bezier(.4,0,.2,1);gap:10px;background:rgba(255,255,255,.015);}
  .grow:hover{border-color:rgba(37,99,235,.35);background:rgba(37,99,235,.05);transform:translateX(2px);}
  .grow.sel{border-color:#2563eb;background:linear-gradient(180deg,rgba(37,99,235,.12) 0%,rgba(37,99,235,.04) 100%);box-shadow:0 4px 14px rgba(37,99,235,.18);}
  .gteams{font-size:16px;font-weight:700;color:#e8f0ff;letter-spacing:.02em;}
  .gvs{color:#3a4a62;margin:0 6px;font-weight:400;}
  .gmeta{font-size:11px;color:#5a6a84;margin-top:3px;}
  .gtime{font-family:'Azeret Mono',monospace;font-size:10px;color:#10b981;white-space:nowrap;font-weight:600;letter-spacing:.05em;}
  .gtime.up{color:#f59e0b;}
  .acw{position:relative;}
  .ti{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:12px 14px;font-size:14px;color:#e8f0ff;font-family:'Space Grotesk',sans-serif;outline:none;transition:border-color .15s;}
  .ti:focus{border-color:#2563eb;}
  .ti::placeholder{color:#2a3550;}
  .ti:disabled{opacity:.4;cursor:not-allowed;}
  .dd{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#0a101e;border:1px solid rgba(37,99,235,.3);border-radius:10px;overflow:hidden;z-index:100;box-shadow:0 16px 48px rgba(0,0,0,.6);max-height:340px;overflow-y:auto;}
  .ddt{font-family:'Azeret Mono',monospace;font-size:9px;letter-spacing:.15em;color:#2563eb;padding:8px 12px 4px;background:rgba(37,99,235,.05);border-bottom:1px solid rgba(37,99,235,.1);text-transform:uppercase;}
  .ddp{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;transition:background .1s;border-bottom:1px solid rgba(255,255,255,.03);}
  .ddp:hover,.ddp.sel{background:rgba(37,99,235,.1);}
  .ddn{font-size:13px;font-weight:500;color:#e8f0ff;}
  .ddr{display:flex;align-items:center;gap:6px;}
  .ddpos{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;background:rgba(255,255,255,.04);padding:2px 5px;border-radius:3px;}
  .ddst{font-family:'Azeret Mono',monospace;font-size:9px;color:#2563eb;}
  .dinj{font-family:'Azeret Mono',monospace;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:5px;}
  .dinj.out{background:rgba(239,68,68,.12);color:#ef4444;}
  .dinj.gtd{background:rgba(245,158,11,.1);color:#f59e0b;}
  .pconf{margin-top:8px;display:flex;gap:12px;align-items:center;font-family:'Azeret Mono',monospace;font-size:9px;background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.15);border-radius:6px;padding:6px 10px;flex-wrap:wrap;}
  .pcn{color:#10b981;} .pcs{color:#4a6090;}
  .pgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;}
  @media(max-width:480px){.pgrid{grid-template-columns:repeat(3,1fr);}}
  .pbtn{background:linear-gradient(180deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.015) 100%);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 8px;cursor:pointer;text-align:center;transition:all .18s cubic-bezier(.4,0,.2,1);color:#c8d4e8;position:relative;overflow:hidden;}
  .pbtn:hover{border-color:rgba(37,99,235,.4);transform:translateY(-2px);box-shadow:0 6px 18px rgba(37,99,235,.12);background:linear-gradient(180deg,rgba(37,99,235,.06) 0%,rgba(37,99,235,.02) 100%);}
  .pbtn.sel{border-color:#2563eb;background:linear-gradient(180deg,rgba(37,99,235,.18) 0%,rgba(37,99,235,.04) 100%);box-shadow:0 4px 14px rgba(37,99,235,.25),0 0 0 1px rgba(37,99,235,.4) inset;}
  .pbtn.sel::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:#2563eb;}
  .pico{font-size:20px;margin-bottom:5px;line-height:1;}
  .psh{font-family:'Azeret Mono',monospace;font-size:11px;color:#2563eb;font-weight:700;letter-spacing:.05em;}
  .pnm{font-size:9.5px;color:#5a6a84;margin-top:2px;letter-spacing:.02em;}
  .pbtn.sel .pnm{color:#94a3b8;}
  .lwrap{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
  .li{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 16px;font-size:22px;font-family:'Azeret Mono',monospace;color:#e8f0ff;width:100px;outline:none;text-align:center;}
  .li:focus{border-color:#2563eb;}
  .lh{font-size:12px;color:#3a4a62;}
  .btnr{background:linear-gradient(180deg,#2563eb 0%,#1d4ed8 100%);color:#fff;border:none;border-radius:10px;padding:14px 28px;font-size:14px;font-weight:700;font-family:'Space Grotesk',sans-serif;cursor:pointer;transition:all .18s;letter-spacing:.03em;box-shadow:0 4px 14px rgba(37,99,235,.35);}
  .btnr:hover{background:linear-gradient(180deg,#1d4ed8 0%,#1e40af 100%);box-shadow:0 6px 20px rgba(37,99,235,.5);transform:translateY(-1px);}
  .btnr:disabled{background:#141c2e;color:#2a3550;cursor:not-allowed;box-shadow:none;transform:none;}
  .btng{background:transparent;color:#2563eb;border:1px solid rgba(37,99,235,.4);border-radius:10px;padding:13px 18px;font-size:12px;font-family:'Space Grotesk',sans-serif;cursor:pointer;transition:all .15s;}
  .btng:hover{background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.6);}
  .rp{margin-top:24px;background:linear-gradient(180deg,rgba(37,99,235,.06) 0%,rgba(37,99,235,.02) 100%);border:1px solid rgba(37,99,235,.22);border-radius:18px;padding:26px;box-shadow:0 8px 28px rgba(0,0,0,.18),0 0 0 1px rgba(37,99,235,.04) inset;}
  .rh{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:20px;flex-wrap:wrap;padding-bottom:18px;border-bottom:1px solid rgba(255,255,255,.05);}
  .rpn{font-size:30px;font-weight:800;color:#e8f0ff;letter-spacing:-.015em;line-height:1.1;}
  .rpm{font-family:'Azeret Mono',monospace;font-size:10.5px;color:#5a6a84;margin-top:6px;letter-spacing:.02em;}
  .rsrc{font-family:'Azeret Mono',monospace;font-size:9px;color:#10b981;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.22);border-radius:99px;padding:4px 10px;margin-top:8px;display:inline-block;letter-spacing:.08em;}
  .vb{display:flex;flex-direction:column;align-items:center;padding:12px 22px;border-radius:14px;transition:all .2s;box-shadow:0 4px 16px rgba(0,0,0,.15);}
  .vb.over{background:linear-gradient(180deg,rgba(16,185,129,.14) 0%,rgba(16,185,129,.04) 100%);border:1px solid rgba(16,185,129,.35);}
  .vb.under{background:linear-gradient(180deg,rgba(239,68,68,.12) 0%,rgba(239,68,68,.03) 100%);border:1px solid rgba(239,68,68,.3);}
  .vb.push{background:linear-gradient(180deg,rgba(245,158,11,.12) 0%,rgba(245,158,11,.03) 100%);border:1px solid rgba(245,158,11,.3);}
  .vt{font-size:24px;font-weight:800;letter-spacing:.06em;}
  .vt.over{color:#10b981;} .vt.under{color:#ef4444;} .vt.push{color:#f59e0b;}
  .vc{font-family:'Azeret Mono',monospace;font-size:10px;color:#3a4a62;margin-top:4px;letter-spacing:.14em;font-weight:700;}
  .sr{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
  .sb{background:linear-gradient(180deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.015) 100%);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:14px 16px;transition:all .15s;}
  .sb:hover{border-color:rgba(255,255,255,.14);transform:translateY(-1px);}
  .sb.hi{border-color:rgba(37,99,235,.4);background:linear-gradient(180deg,rgba(37,99,235,.10) 0%,rgba(37,99,235,.02) 100%);box-shadow:0 4px 14px rgba(37,99,235,.08);}
  .sbl{font-family:'Azeret Mono',monospace;font-size:9px;color:#5a6a84;letter-spacing:.14em;margin-bottom:6px;text-transform:uppercase;font-weight:600;}
  .sbv{font-size:26px;font-weight:800;color:#e8f0ff;line-height:1;letter-spacing:-.01em;}
  .sbv.bl{color:#2563eb;}
  .sbs{font-family:'Azeret Mono',monospace;font-size:9.5px;color:#475569;margin-top:4px;}
  .mb{background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);border-radius:8px;padding:14px;margin-bottom:14px;}
  .mbt{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;letter-spacing:.15em;text-transform:uppercase;margin-bottom:10px;}
  .mr{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:12px;}
  .mr:last-child{border-bottom:none;}
  .mk{color:#5a6a84;} .mv{font-family:'Azeret Mono',monospace;color:#c8d4e8;font-size:12px;}
  .mv.pos{color:#10b981;} .mv.neg{color:#ef4444;} .mv.acc{color:#2563eb;font-weight:600;}
  .mf{font-family:'Azeret Mono',monospace;font-size:10px;color:#2563eb;margin-top:8px;background:rgba(37,99,235,.06);border-radius:4px;padding:6px 10px;}
  .cg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}
  .cc{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.055);border-radius:8px;padding:10px 12px;}
  .ccl{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;}
  .ccv{font-size:13px;color:#c8d4e8;font-weight:500;}
  .ccs{font-family:'Azeret Mono',monospace;font-size:8px;color:#1a2a3a;margin-top:2px;}
  .et{height:4px;background:rgba(255,255,255,.05);border-radius:2px;margin:12px 0;overflow:hidden;}
  .ef{height:100%;border-radius:2px;transition:width .8s cubic-bezier(.16,1,.3,1);}
  .div{height:1px;background:rgba(255,255,255,.04);margin:14px 0;}
  .injb{display:flex;gap:6px;align-items:center;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:7px 10px;margin-bottom:12px;font-family:'Azeret Mono',monospace;font-size:9px;color:#ef4444;letter-spacing:.05em;}
  .injb.gtd{background:rgba(245,158,11,.06);border-color:rgba(245,158,11,.2);color:#f59e0b;}
  .dn{font-family:'Azeret Mono',monospace;font-size:9px;color:#1e2a3a;margin-top:14px;border-top:1px solid rgba(255,255,255,.04);padding-top:10px;line-height:1.7;}
  .err{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#f87171;margin-top:12px;font-family:'Azeret Mono',monospace;}
`;
