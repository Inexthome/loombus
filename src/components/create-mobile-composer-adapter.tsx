"use client";

import { useEffect } from "react";

type Panel = "topic" | "mode" | "attachments" | "guidance" | "more" | null;

const PANEL_TITLES: Record<Exclude<Panel, null>, string> = {
  topic: "Topic and classification",
  mode: "Discussion mode",
  attachments: "Add supporting context",
  guidance: "Draft Guidance",
  more: "More options",
};

const PANEL_ROLE: Partial<Record<Exclude<Panel, null>, string>> = {
  topic: "topic",
  mode: "mode",
  attachments: "attachments",
  guidance: "guidance",
};

const CSS = String.raw`
@media (max-width:767px){
  [data-mc-global-hidden="true"]{display:none!important}

  body[data-create-focus-mode="true"]{
    background:
      radial-gradient(circle at 12% 0%,var(--loombus-cream-soft),transparent 20rem),
      radial-gradient(circle at 88% 6%,var(--loombus-gold-soft),transparent 22rem),
      var(--loombus-page-bg)!important;
  }

  main[data-mobile-create]{
    min-height:100dvh!important;
    padding:0 0 calc(6.65rem + env(safe-area-inset-bottom))!important;
    background:transparent!important;
  }

  main[data-mobile-create]>section{max-width:none!important}
  main[data-mobile-create] [data-mc-role="desktop-header"]{display:none!important}
  main[data-mobile-create] form{display:block!important}
  main[data-mobile-create] form>div:first-child{display:block!important}

  .mc-mobile-header{
    position:sticky;
    top:0;
    z-index:66;
    padding:.7rem 1rem .65rem;
    border-bottom:1px solid color-mix(in srgb,var(--loombus-gold) 22%,var(--loombus-border));
    background:color-mix(in srgb,var(--loombus-page-bg) 92%,transparent);
    color:var(--loombus-text);
    backdrop-filter:blur(22px);
    -webkit-backdrop-filter:blur(22px);
  }

  .mc-mobile-header__row{
    display:grid;
    grid-template-columns:minmax(4.7rem,1fr) auto minmax(4.7rem,1fr);
    align-items:center;
    gap:.65rem;
    width:min(100%,42rem);
    min-height:2.8rem;
    margin:0 auto;
  }

  .mc-mobile-cancel{
    justify-self:start;
    border:0;
    padding:.65rem .35rem;
    background:transparent;
    color:var(--loombus-text-muted);
    font-size:.82rem;
    font-weight:850;
    text-decoration:none;
  }

  .mc-mobile-title{
    color:var(--loombus-text);
    font-size:1rem;
    font-weight:950;
    letter-spacing:-.025em;
    text-align:center;
    white-space:nowrap;
  }

  .mc-draft-status{
    justify-self:end;
    display:inline-flex;
    align-items:center;
    gap:.42rem;
    min-height:2.25rem;
    border:0;
    border-radius:999px;
    padding:.45rem .65rem;
    background:var(--loombus-surface);
    color:var(--loombus-text-muted);
    font-size:.7rem;
    font-weight:850;
    white-space:nowrap;
    box-shadow:inset 0 0 0 1px var(--loombus-border);
  }

  .mc-draft-status__dot{
    width:.48rem;
    height:.48rem;
    border-radius:999px;
    background:var(--loombus-gold);
    box-shadow:0 0 0 .2rem var(--loombus-gold-soft);
  }

  .mc-draft-status[data-state="saved"] .mc-draft-status__dot{background:#16a34a;box-shadow:0 0 0 .2rem rgb(22 163 74/.12)}
  .mc-draft-status[data-state="saving"] .mc-draft-status__dot{animation:mc-pulse 1s ease-in-out infinite}

  @keyframes mc-pulse{50%{opacity:.35;transform:scale(.8)}}

  main[data-mobile-create] form>div:first-child>section:first-of-type{
    position:relative!important;
    overflow:hidden!important;
    margin:.8rem 1rem 0!important;
    border:1px solid color-mix(in srgb,var(--loombus-gold) 30%,var(--loombus-border))!important;
    border-radius:1.75rem!important;
    padding:0!important;
    background:
      radial-gradient(circle at 0% 0%,var(--loombus-cream-soft),transparent 18rem),
      radial-gradient(circle at 100% 0%,var(--loombus-gold-soft),transparent 19rem),
      var(--loombus-surface)!important;
    box-shadow:0 1.25rem 3.5rem rgb(0 0 0/.1)!important;
  }

  main[data-mobile-create] form>div:first-child>section:first-of-type:before{
    content:"";
    position:absolute;
    inset:0 1.7rem auto;
    height:3px;
    border-radius:0 0 999px 999px;
    background:linear-gradient(90deg,transparent,var(--loombus-gold),transparent);
    opacity:.85;
  }

  .mc-composer-intro{
    display:flex;
    align-items:center;
    gap:.8rem;
    padding:1.15rem 1rem .8rem;
  }

  .mc-composer-intro__mark{
    display:grid;
    width:2.45rem;
    height:2.45rem;
    flex:0 0 auto;
    place-items:center;
    border:1px solid color-mix(in srgb,var(--loombus-gold) 42%,var(--loombus-border));
    border-radius:.9rem;
    background:var(--loombus-gold-surface);
    color:var(--loombus-gold-deep);
    font-size:1rem;
    font-weight:950;
  }

  .mc-composer-intro__copy{min-width:0;display:grid;gap:.16rem}
  .mc-composer-intro__copy strong{color:var(--loombus-text);font-size:.86rem;font-weight:950;letter-spacing:-.01em}
  .mc-composer-intro__copy span{color:var(--loombus-text-muted);font-size:.7rem;line-height:1.35}

  main[data-mobile-create] form>div:first-child>section:first-of-type>.grid{
    display:flex!important;
    flex-direction:column!important;
    gap:0!important;
  }

  main[data-mobile-create] [data-mc-role="title"]{
    order:1;
    margin:0!important;
    padding:.95rem 1rem 1rem!important;
    border-top:1px solid color-mix(in srgb,var(--loombus-gold) 14%,var(--loombus-border));
    border-bottom:1px solid var(--loombus-border);
  }

  main[data-mobile-create] [data-mc-role="title"]>span{
    display:block!important;
    margin:0 0 .55rem!important;
    color:var(--loombus-gold-deep)!important;
    font-size:.68rem!important;
    font-weight:950!important;
    letter-spacing:.14em!important;
    text-transform:uppercase!important;
  }

  main[data-mobile-create] [data-mc-role="title"]>p{
    display:block!important;
    margin:.5rem .15rem 0!important;
    color:var(--loombus-text-subtle)!important;
    font-size:.68rem!important;
    line-height:1.35!important;
  }

  main[data-mobile-create] [data-mc-role="title"] input{
    width:100%!important;
    min-height:3.3rem!important;
    border:1px solid var(--loombus-border)!important;
    border-radius:1rem!important;
    background:color-mix(in srgb,var(--loombus-surface-strong) 88%,var(--loombus-cream-soft))!important;
    padding:.85rem .95rem!important;
    color:var(--loombus-text)!important;
    font-size:1rem!important;
    line-height:1.35rem!important;
    font-weight:850!important;
    box-shadow:inset 0 1px 0 rgb(255 255 255/.04)!important;
    outline:none!important;
  }

  main[data-mobile-create] [data-mc-role="title"] input:focus,
  main[data-mobile-create] [data-mc-role="body"] textarea:focus{
    border-color:color-mix(in srgb,var(--loombus-gold) 72%,var(--loombus-border))!important;
    box-shadow:0 0 0 4px var(--loombus-gold-soft)!important;
  }

  main[data-mobile-create] [data-mc-role="body"]{
    order:2;
    margin:0!important;
    padding:1rem!important;
  }

  main[data-mobile-create] [data-mc-role="body"]>div{
    margin:0 0 .55rem!important;
  }

  main[data-mobile-create] [data-mc-role="body"]>div>span:first-child{
    color:var(--loombus-gold-deep)!important;
    font-size:.68rem!important;
    font-weight:950!important;
    letter-spacing:.14em!important;
    text-transform:uppercase!important;
  }

  main[data-mobile-create] [data-mc-role="body"]>div>span:last-child{
    color:var(--loombus-text-subtle)!important;
    font-size:.68rem!important;
    font-weight:800!important;
  }

  main[data-mobile-create] [data-mc-role="body"] textarea{
    width:100%!important;
    min-height:14.25rem!important;
    resize:none!important;
    border:1px solid var(--loombus-border)!important;
    border-radius:1.15rem!important;
    background:color-mix(in srgb,var(--loombus-surface-strong) 88%,var(--loombus-cream-soft))!important;
    padding:1rem!important;
    color:var(--loombus-text)!important;
    font-size:.98rem!important;
    line-height:1.65rem!important;
    box-shadow:inset 0 1px 0 rgb(255 255 255/.04)!important;
    outline:none!important;
  }

  main[data-mobile-create] [data-mc-role="body"]>p{
    margin:.55rem .15rem 0!important;
    color:var(--loombus-text-muted)!important;
    font-size:.7rem!important;
    line-height:1.45!important;
  }

  main[data-mobile-create] [data-mc-role="topic"],
  main[data-mobile-create] [data-mc-role="mode"],
  main[data-mobile-create] [data-mc-role="mode-guide"],
  main[data-mobile-create] [data-mc-role="purpose"],
  main[data-mobile-create] [data-mc-role="guidance"],
  main[data-mobile-create] [data-mc-role="tags"],
  main[data-mobile-create] [data-mc-role="attachments"],
  main[data-mobile-create] [data-mc-role="aside"],
  main[data-mobile-create] [data-mc-role="extra"]{display:none!important}

  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"],
  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="tags"]{
    display:block!important;
    order:3;
    margin:0!important;
    padding:1rem!important;
    border-top:1px solid var(--loombus-border);
    background:color-mix(in srgb,var(--loombus-surface-strong) 86%,transparent)!important;
  }

  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"] .text-red-500{display:none!important}
  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"]>span:first-child:after{content:" (optional)";font-weight:650;color:var(--loombus-text-muted)}
  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"] input,
  main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="tags"] input{background:var(--loombus-surface)!important}

  .mc-context-wrap{
    width:min(100%,42rem);
    margin:0 auto;
    padding:.9rem 1rem 0;
  }

  .mc-context-label{
    margin:0 0 .55rem .15rem;
    color:var(--loombus-text-subtle);
    font-size:.62rem;
    font-weight:950;
    letter-spacing:.15em;
    text-transform:uppercase;
  }

  .mc-context-row{
    display:flex;
    gap:.55rem;
    overflow-x:auto;
    padding:0 0 .15rem;
    scrollbar-width:none;
  }

  .mc-context-row::-webkit-scrollbar{display:none}

  .mc-context-chip{
    min-height:2.85rem;
    flex:0 0 auto;
    border:1px solid var(--loombus-border);
    border-radius:999px;
    padding:.65rem .9rem;
    background:var(--loombus-surface);
    color:var(--loombus-text);
    font-size:.75rem;
    font-weight:900;
    box-shadow:0 .45rem 1.35rem rgb(0 0 0/.06);
  }

  .mc-context-chip[data-configured="true"]{
    border-color:color-mix(in srgb,var(--loombus-gold) 54%,var(--loombus-border));
    background:var(--loombus-gold-surface);
    color:var(--loombus-gold-deep);
  }

  .mc-inline-notice{
    margin:.75rem 0 0;
    border:1px solid color-mix(in srgb,var(--loombus-gold) 30%,var(--loombus-border));
    border-radius:1rem;
    padding:.75rem .85rem;
    background:var(--loombus-gold-surface);
    color:var(--loombus-text-muted);
    font-size:.72rem;
    font-weight:750;
    line-height:1.45;
  }

  .mc-action-bar{
    position:fixed;
    inset-inline:0;
    bottom:0;
    z-index:68;
    border-top:1px solid color-mix(in srgb,var(--loombus-gold) 20%,var(--loombus-border));
    padding:.55rem .75rem calc(env(safe-area-inset-bottom) + .55rem);
    background:color-mix(in srgb,var(--loombus-page-bg) 94%,transparent);
    box-shadow:0 -1rem 3rem rgb(0 0 0/.1);
    backdrop-filter:blur(24px);
    -webkit-backdrop-filter:blur(24px);
  }

  .mc-action-row{
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr)) minmax(5.8rem,1.35fr);
    gap:.45rem;
    width:min(100%,42rem);
    margin:0 auto;
  }

  .mc-action-button{
    display:grid;
    min-height:3rem;
    place-items:center;
    gap:.1rem;
    border:0;
    border-radius:1rem;
    background:transparent;
    color:var(--loombus-text-muted);
    font-size:.68rem;
    font-weight:900;
  }

  .mc-action-button__icon{
    color:var(--loombus-gold-deep);
    font-size:.92rem;
    line-height:1;
  }

  .mc-action-button--review{
    display:flex;
    align-items:center;
    justify-content:center;
    border:1px solid color-mix(in srgb,var(--loombus-gold) 72%,transparent);
    background:var(--loombus-gold);
    color:var(--loombus-gold-contrast);
    font-size:.8rem;
    box-shadow:0 .7rem 1.7rem var(--loombus-gold-soft);
  }

  .mc-sheet-backdrop{
    position:fixed;
    inset:0;
    z-index:79;
    border:0;
    background:rgb(9 9 11/.58);
    backdrop-filter:blur(5px);
    -webkit-backdrop-filter:blur(5px);
  }

  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"],
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"],
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"],
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{
    display:block!important;
    position:fixed!important;
    inset-inline:0!important;
    bottom:0!important;
    z-index:81!important;
    width:100%!important;
    overflow-y:auto!important;
    overscroll-behavior:contain!important;
    margin:0!important;
    border:1px solid color-mix(in srgb,var(--loombus-gold) 25%,var(--loombus-border))!important;
    border-bottom:0!important;
    border-radius:1.75rem 1.75rem 0 0!important;
    background:
      radial-gradient(circle at 8% 0%,var(--loombus-cream-soft),transparent 17rem),
      radial-gradient(circle at 92% 0%,var(--loombus-gold-soft),transparent 18rem),
      var(--loombus-surface)!important;
    color:var(--loombus-text)!important;
    padding:5.15rem 1rem calc(1rem + env(safe-area-inset-bottom))!important;
    box-shadow:0 -1.5rem 5rem rgb(0 0 0/.3)!important;
  }

  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"]{max-height:min(84dvh,46rem)!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]{max-height:min(74dvh,40rem)!important;padding-bottom:calc(5.7rem + env(safe-area-inset-bottom))!important}
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]{max-height:min(76dvh,42rem)!important}
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{max-height:min(68dvh,36rem)!important}

  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"]>span,
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]>p:first-child,
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>p:first-child,
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] h2{display:none!important}

  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"] .absolute{
    position:static!important;
    margin-top:.75rem!important;
    border-color:var(--loombus-border)!important;
    background:var(--loombus-surface-strong)!important;
    box-shadow:none!important;
  }

  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"] .max-h-64{max-height:48dvh!important}
  main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"] button{color:var(--loombus-text)!important}

  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]>div{grid-template-columns:1fr!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"] button{
    min-height:4.6rem!important;
    padding:.85rem!important;
    text-align:left!important;
    color:var(--loombus-text)!important;
  }
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"] button svg{margin:0!important;color:var(--loombus-gold-deep)!important}
  main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"] button.border-amber-400{
    border-color:var(--loombus-gold)!important;
    background:var(--loombus-gold-surface)!important;
    color:var(--loombus-text)!important;
    box-shadow:0 0 0 2px var(--loombus-gold-soft)!important;
  }

  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>p:nth-child(2){color:var(--loombus-text-muted)!important}
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>div.mt-4.grid{grid-template-columns:1fr!important}
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>div.mt-5.border-t{display:none!important}
  main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"] button{color:var(--loombus-text)!important}

  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{
    border-color:color-mix(in srgb,var(--loombus-gold) 36%,var(--loombus-border))!important;
  }

  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] p,
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] strong,
  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] span{
    color:var(--loombus-text-muted)!important;
  }

  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]>div:first-child{
    display:grid!important;
    gap:1rem!important;
  }

  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]>div:first-child>div:last-child{
    display:grid!important;
    grid-template-columns:1fr!important;
    gap:.7rem!important;
  }

  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] button{
    display:flex!important;
    width:100%!important;
    min-height:3.15rem!important;
    align-items:center!important;
    justify-content:center!important;
    border:1px solid var(--loombus-border)!important;
    border-radius:1rem!important;
    background:var(--loombus-surface-strong)!important;
    color:var(--loombus-text)!important;
    box-shadow:none!important;
  }

  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] button:last-child{
    border-color:var(--loombus-gold)!important;
    background:var(--loombus-gold)!important;
    color:var(--loombus-gold-contrast)!important;
  }

  main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] .bg-white{
    background:var(--loombus-surface-strong)!important;
  }

  .mc-sheet-header-wrap{
    position:fixed;
    inset-inline:0;
    z-index:83;
    height:4.8rem;
    pointer-events:none;
  }

  .mc-sheet-header{
    position:relative;
    display:flex;
    height:4.8rem;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    border:1px solid color-mix(in srgb,var(--loombus-gold) 25%,var(--loombus-border));
    border-bottom:1px solid var(--loombus-border);
    border-radius:1.75rem 1.75rem 0 0;
    padding:1rem;
    background:color-mix(in srgb,var(--loombus-surface-strong) 96%,transparent);
    color:var(--loombus-text);
    pointer-events:auto;
    backdrop-filter:blur(22px);
    -webkit-backdrop-filter:blur(22px);
  }

  .mc-sheet-handle{
    position:absolute;
    top:.48rem;
    left:50%;
    width:2.7rem;
    height:.23rem;
    border-radius:999px;
    background:var(--loombus-border);
    transform:translateX(-50%);
  }

  .mc-sheet-title{
    padding-top:.18rem;
    color:var(--loombus-text)!important;
    font-size:1rem;
    font-weight:950;
    letter-spacing:-.02em;
  }

  .mc-sheet-close{
    display:grid;
    width:2.55rem;
    height:2.55rem;
    flex:0 0 auto;
    place-items:center;
    border:1px solid var(--loombus-border);
    border-radius:999px;
    background:var(--loombus-surface);
    color:var(--loombus-text-muted);
    font-size:1.3rem;
    line-height:1;
  }

  .mc-more-sheet{
    position:fixed;
    inset-inline:0;
    bottom:0;
    z-index:81;
    max-height:min(76dvh,42rem);
    overflow-y:auto;
    overscroll-behavior:contain;
    border:1px solid color-mix(in srgb,var(--loombus-gold) 25%,var(--loombus-border));
    border-bottom:0;
    border-radius:1.75rem 1.75rem 0 0;
    padding:5.2rem 1rem calc(env(safe-area-inset-bottom) + 1rem);
    background:
      radial-gradient(circle at 8% 0%,var(--loombus-cream-soft),transparent 17rem),
      radial-gradient(circle at 92% 0%,var(--loombus-gold-soft),transparent 18rem),
      var(--loombus-surface);
    color:var(--loombus-text);
    box-shadow:0 -1.5rem 5rem rgb(0 0 0/.3);
  }

  .mc-more-inner{display:grid;width:min(100%,42rem);margin:0 auto;gap:1.1rem}
  .mc-more-group{display:grid;gap:.55rem}
  .mc-more-group__label{
    margin:0 .25rem;
    color:var(--loombus-gold-deep);
    font-size:.63rem;
    font-weight:950;
    letter-spacing:.15em;
    text-transform:uppercase;
  }

  .mc-menu-button{
    display:flex;
    width:100%;
    min-height:4.15rem;
    align-items:center;
    justify-content:space-between;
    gap:1rem;
    border:1px solid var(--loombus-border);
    border-radius:1.1rem;
    padding:.8rem .9rem;
    background:var(--loombus-surface-strong);
    color:var(--loombus-text);
    text-align:left;
  }

  .mc-menu-button:disabled{cursor:not-allowed;opacity:.48}
  .mc-menu-button__copy{display:grid;gap:.18rem}
  .mc-menu-button__copy strong{color:var(--loombus-text);font-size:.8rem;font-weight:950}
  .mc-menu-button__copy span{color:var(--loombus-text-muted);font-size:.67rem;line-height:1.35}
  .mc-menu-button__arrow{color:var(--loombus-gold-deep);font-size:1rem;font-weight:950}
  .mc-menu-button--danger{border-color:rgb(239 68 68/.35);background:rgb(239 68 68/.06)}
  .mc-menu-button--danger .mc-menu-button__copy strong,.mc-menu-button--danger .mc-menu-button__arrow{color:#ef4444}
  .mc-menu-button--primary{border-color:var(--loombus-gold);background:var(--loombus-gold);color:var(--loombus-gold-contrast)}
  .mc-menu-button--primary .mc-menu-button__copy strong,.mc-menu-button--primary .mc-menu-button__copy span,.mc-menu-button--primary .mc-menu-button__arrow{color:var(--loombus-gold-contrast)}

  .mc-mode-foot{
    position:fixed;
    inset-inline:0;
    bottom:calc(env(safe-area-inset-bottom) + .65rem);
    z-index:84;
    padding:0 1rem;
  }

  .mc-mode-foot button{
    display:block;
    width:min(100%,42rem);
    min-height:3.15rem;
    margin:0 auto;
    border:1px solid var(--loombus-gold);
    border-radius:1rem;
    background:var(--loombus-gold);
    color:var(--loombus-gold-contrast);
    font-size:.78rem;
    font-weight:950;
    box-shadow:0 .8rem 2rem rgb(0 0 0/.18);
  }
}
`;

function rootForCreate() {
  return (
    Array.from(document.querySelectorAll<HTMLElement>("main")).find(
      (main) => main.querySelector("h1")?.textContent?.trim() === "Create Discussion"
    ) ?? null
  );
}

function starts(element: Element, value: string) {
  return element.textContent?.trim().startsWith(value) ?? false;
}

function originalButton(root: Element, labels: string[]) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) =>
      !candidate.closest("[data-mc-ui]") &&
      labels.some((label) => starts(candidate, label))
  );
}

function role(element: Element | null | undefined, name: string) {
  if (element instanceof HTMLElement && element.dataset.mcRole !== name) {
    element.dataset.mcRole = name;
  }
}

function setText(element: HTMLElement, value: string) {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

function purposeInput(root: Element) {
  return Array.from(root.querySelectorAll<HTMLInputElement>("input")).find(
    (input) =>
      input.dataset.loombusPurposeInput === "true" ||
      input.placeholder.includes("hope to achieve") ||
      ["Discussion Purpose", "Debate Goal", "Research Goal", "Desired Outcome"].some(
        (label) => input.closest("label")?.textContent?.includes(label)
      )
  );
}

function createButton(
  label: string,
  className: string,
  action: () => void
) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.className = className;
  element.addEventListener("click", action);
  return element;
}

function createActionButton(
  label: string,
  icon: string,
  action: () => void,
  primary = false
) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = primary
    ? "mc-action-button mc-action-button--review"
    : "mc-action-button";

  if (!primary) {
    const iconElement = document.createElement("span");
    iconElement.className = "mc-action-button__icon";
    iconElement.setAttribute("aria-hidden", "true");
    iconElement.textContent = icon;
    element.append(iconElement);
  }

  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  element.append(labelElement);
  element.addEventListener("click", action);
  return element;
}

function createMenuButton(
  title: string,
  description: string,
  variant: "default" | "danger" | "primary",
  action: () => void
) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `mc-menu-button${
    variant === "danger"
      ? " mc-menu-button--danger"
      : variant === "primary"
        ? " mc-menu-button--primary"
        : ""
  }`;

  const copy = document.createElement("span");
  copy.className = "mc-menu-button__copy";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const detail = document.createElement("span");
  detail.textContent = description;
  copy.append(heading, detail);

  const arrow = document.createElement("span");
  arrow.className = "mc-menu-button__arrow";
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "›";

  element.append(copy, arrow);
  element.addEventListener("click", action);
  return { element, heading, detail };
}

function createGroup(label: string) {
  const group = document.createElement("section");
  group.className = "mc-more-group";
  const heading = document.createElement("p");
  heading.className = "mc-more-group__label";
  heading.textContent = label;
  group.append(heading);
  return group;
}

function mark(root: HTMLElement) {
  const form = root.querySelector("form");
  const primary = form?.firstElementChild;
  const first = primary?.querySelector(":scope > section:first-of-type");
  const textInputs = Array.from(
    first?.querySelectorAll<HTMLInputElement>(
      'input:not([type]),input[type="text"],input[type="search"]'
    ) ?? []
  );

  const title = textInputs.find(
    (input) =>
      input.placeholder.toLowerCase().includes("future") ||
      input.closest("label")?.textContent?.includes("Discussion Title")
  );
  const tags = textInputs.find(
    (input) =>
      input.placeholder.toLowerCase().includes("web3") ||
      input.closest("label")?.textContent?.trim().startsWith("Tags")
  );
  const body = Array.from(first?.querySelectorAll<HTMLTextAreaElement>("textarea") ?? []).find(
    (textarea) =>
      textarea.placeholder.toLowerCase().includes("provide context") ||
      textarea.closest("label")?.textContent?.includes("Body")
  );
  const topicButton = Array.from(
    first?.querySelectorAll<HTMLButtonElement>("button") ?? []
  ).find(
    (candidate) =>
      candidate.textContent?.includes("Choose an approved topic") ||
      candidate.querySelector("svg")?.getAttribute("class")?.includes("lucide-plus")
  );
  const modeButton = Array.from(
    first?.querySelectorAll<HTMLButtonElement>("button") ?? []
  ).find((candidate) => starts(candidate, "Open Discussion"));
  const guidanceHeading = Array.from(first?.querySelectorAll("h2") ?? []).find(
    (heading) =>
      heading.textContent?.includes("AI draft tools") ||
      heading.textContent?.includes("Draft Guidance")
  );
  const attachment = form
    ?.querySelector<HTMLInputElement>('input[type="file"][accept="video/*"]')
    ?.closest("section");

  role(root.querySelector(":scope > section > header"), "desktop-header");
  role(title?.closest("label"), "title");
  role(body?.closest("label"), "body");
  role(topicButton?.closest("div.relative"), "topic");
  role(modeButton?.parentElement?.parentElement, "mode");
  role(first?.querySelector('[data-loombus-mode-guidance="true"]'), "mode-guide");
  role(purposeInput(first ?? root)?.closest("label"), "purpose");
  role(tags?.closest("label"), "tags");
  role(guidanceHeading?.closest("section"), "guidance");
  role(attachment, "attachments");
  role(form?.querySelector("aside"), "aside");

  if (primary) {
    for (const section of Array.from(
      primary.querySelectorAll(":scope > section")
    )) {
      if (section !== first && section !== attachment) {
        role(section, "extra");
      }
    }
  }
}

function topicLabel(root: HTMLElement) {
  const area = root.querySelector('[data-mc-role="topic"]');
  const button = area?.querySelector<HTMLButtonElement>(":scope > button");
  const label = button?.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return !label || label.includes("Choose an approved topic")
    ? "Topic"
    : label.replace(/^\+\s*/, "");
}

function modeLabel(root: HTMLElement) {
  const area = root.querySelector('[data-mc-role="mode"]');
  const button = Array.from(
    area?.querySelectorAll<HTMLButtonElement>("button") ?? []
  ).find(
    (candidate) =>
      candidate.getAttribute("aria-pressed") === "true" ||
      candidate.getAttribute("class")?.includes("border-amber-400")
  );

  return (
    ["Open Discussion", "Debate", "Research Question", "Problem Solving"].find(
      (label) => (button ? starts(button, label) : false)
    ) ?? "Open Discussion"
  );
}

function compactDraftStatus(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.includes("saving") || normalized.includes("autosaving")) {
    return { label: "Saving…", state: "saving" };
  }

  if (normalized.includes("saved") || normalized.includes("autosaved")) {
    return normalized.includes("local")
      ? { label: "Local", state: "local" }
      : { label: "Saved", state: "saved" };
  }

  if (normalized.includes("offline") || normalized.includes("local")) {
    return { label: "Local", state: "local" };
  }

  return { label: "Draft", state: "draft" };
}

export function CreateMobileComposerAdapter() {
  useEffect(() => {
    const media = window.matchMedia("(max-width:767px)");
    let cleanup: (() => void) | null = null;

    const activate = () => {
      cleanup?.();
      cleanup = null;

      if (!media.matches) {
        return;
      }

      let cancelled = false;
      let timer = 0;
      let observer: MutationObserver | null = null;
      let root: HTMLElement | null = null;
      let panel: Panel = null;
      let previouslyFocused: HTMLElement | null = null;
      let previousBodyOverflow = "";
      const hiddenGlobals = new Set<HTMLElement>();

      const locate = () => {
        if (cancelled) {
          return;
        }

        root = rootForCreate();
        if (!root) {
          timer = window.setTimeout(locate, 100);
          return;
        }

        mark(root);
        root.dataset.mobileCreate = "true";
        document.body.dataset.createFocusMode = "true";

        const style = document.createElement("style");
        style.dataset.mcUi = "true";
        style.textContent = CSS;
        document.head.append(style);

        const first = root.querySelector<HTMLElement>(
          "form > div:first-child > section:first-of-type"
        );
        const firstGrid = first?.querySelector<HTMLElement>(":scope > .grid");
        const top = document.createElement("header");
        const intro = document.createElement("div");
        const context = document.createElement("section");
        const bottom = document.createElement("div");
        const shade = document.createElement("button");
        const sheetHeaderWrap = document.createElement("div");
        const more = document.createElement("section");
        const modeFoot = document.createElement("div");

        for (const element of [
          top,
          intro,
          context,
          bottom,
          shade,
          sheetHeaderWrap,
          more,
          modeFoot,
        ]) {
          element.dataset.mcUi = "true";
        }

        function hideGlobalUi() {
          const candidates = document.querySelectorAll<HTMLElement>(
            [
              ".loombus-mobile-v2-topbar",
              ".loombus-mobile-v2-bottom-nav",
              ".loombus-floating-utility-stack",
              'button[aria-label="Open messages"]',
              'button[aria-label="Close messages"]',
              'aside[aria-label="Messages preview"]',
            ].join(",")
          );

          for (const candidate of candidates) {
            candidate.dataset.mcGlobalHidden = "true";
            hiddenGlobals.add(candidate);
          }
        }

        hideGlobalUi();

        top.className = "mc-mobile-header";
        top.setAttribute("aria-label", "Create Discussion controls");
        const topRow = document.createElement("div");
        topRow.className = "mc-mobile-header__row";

        const cancel = document.createElement("a");
        cancel.href = "/discussions";
        cancel.textContent = "Cancel";
        cancel.className = "mc-mobile-cancel";

        const heading = document.createElement("strong");
        heading.textContent = "Create Discussion";
        heading.className = "mc-mobile-title";

        const draft = document.createElement("button");
        draft.type = "button";
        draft.className = "mc-draft-status";
        draft.dataset.state = "draft";
        draft.setAttribute("aria-label", "Save draft");
        const draftDot = document.createElement("span");
        draftDot.className = "mc-draft-status__dot";
        draftDot.setAttribute("aria-hidden", "true");
        const draftLabel = document.createElement("span");
        draftLabel.textContent = "Draft";
        draft.append(draftDot, draftLabel);
        draft.addEventListener("click", () =>
          originalButton(root!, ["Save Draft", "Saving"])?.click()
        );

        topRow.append(cancel, heading, draft);
        top.append(topRow);
        first?.insertAdjacentElement("beforebegin", top);

        intro.className = "mc-composer-intro";
        const introMark = document.createElement("span");
        introMark.className = "mc-composer-intro__mark";
        introMark.setAttribute("aria-hidden", "true");
        introMark.textContent = "✦";
        const introCopy = document.createElement("span");
        introCopy.className = "mc-composer-intro__copy";
        const introTitle = document.createElement("strong");
        introTitle.textContent = "Start with the idea";
        const introDetail = document.createElement("span");
        introDetail.textContent =
          "Give members a clear title, then add the context needed for a useful discussion.";
        introCopy.append(introTitle, introDetail);
        intro.append(introMark, introCopy);
        first?.insertBefore(intro, firstGrid ?? first.firstChild);

        context.className = "mc-context-wrap";
        context.setAttribute("aria-label", "Discussion setup");
        const contextLabel = document.createElement("p");
        contextLabel.className = "mc-context-label";
        contextLabel.textContent = "Discussion setup";
        const chipRow = document.createElement("div");
        chipRow.className = "mc-context-row";

        const topic = createButton("Topic", "mc-context-chip", () => open("topic"));
        const mode = createButton("Open Discussion", "mc-context-chip", () =>
          open("mode")
        );
        const add = createButton("Add", "mc-context-chip", () =>
          open("attachments")
        );
        mode.dataset.configured = "true";
        chipRow.append(topic, mode, add);

        const notice = document.createElement("p");
        notice.className = "mc-inline-notice";
        notice.hidden = true;
        notice.setAttribute("role", "status");
        context.append(contextLabel, chipRow, notice);
        first?.insertAdjacentElement("afterend", context);

        bottom.className = "mc-action-bar";
        const bottomRow = document.createElement("div");
        bottomRow.className = "mc-action-row";
        bottomRow.append(
          createActionButton("Attach", "＋", () => open("attachments")),
          createActionButton("Guidance", "✦", () => open("guidance")),
          createActionButton("More", "•••", () => open("more")),
          createActionButton(
            "Review",
            "",
            () => originalButton(root!, ["Review draft"])?.click(),
            true
          )
        );
        bottom.append(bottomRow);
        document.body.append(bottom);

        shade.type = "button";
        shade.className = "mc-sheet-backdrop";
        shade.hidden = true;
        shade.setAttribute("aria-label", "Close composer options");
        shade.addEventListener("click", close);
        document.body.append(shade);

        sheetHeaderWrap.className = "mc-sheet-header-wrap";
        sheetHeaderWrap.hidden = true;
        const sheetHeader = document.createElement("div");
        sheetHeader.className = "mc-sheet-header";
        const sheetHandle = document.createElement("span");
        sheetHandle.className = "mc-sheet-handle";
        sheetHandle.setAttribute("aria-hidden", "true");
        const panelTitle = document.createElement("strong");
        panelTitle.id = "mc-sheet-title";
        panelTitle.className = "mc-sheet-title";
        const closeButton = createButton("×", "mc-sheet-close", close);
        closeButton.setAttribute("aria-label", "Close options");
        sheetHeader.append(sheetHandle, panelTitle, closeButton);
        sheetHeaderWrap.append(sheetHeader);
        document.body.append(sheetHeaderWrap);

        more.className = "mc-more-sheet";
        more.hidden = true;
        more.setAttribute("role", "dialog");
        more.setAttribute("aria-modal", "true");
        more.setAttribute("aria-labelledby", panelTitle.id);
        const moreInner = document.createElement("div");
        moreInner.className = "mc-more-inner";

        const writingGroup = createGroup("Writing options");
        const advancedAction = createMenuButton(
          "Show response goal and tags",
          "Add optional intent and discovery details to this draft.",
          "default",
          () => {
            const willShow = root!.dataset.mcAdvanced !== "true";
            root!.dataset.mcAdvanced = willShow ? "true" : "false";
            advancedAction.heading.textContent = willShow
              ? "Hide response goal and tags"
              : "Show response goal and tags";
            close();
            if (willShow) {
              window.setTimeout(() => {
                root
                  ?.querySelector<HTMLElement>('[data-mc-role="purpose"]')
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }, 120);
            }
          }
        );
        writingGroup.append(advancedAction.element);

        const draftGroup = createGroup("Draft");
        const saveAction = createMenuButton(
          "Save draft",
          "Store the current draft locally and sync it when available.",
          "default",
          () => {
            originalButton(root!, ["Save Draft", "Saving"])?.click();
            close();
          }
        );
        const copyAction = createMenuButton(
          "Copy draft",
          "Copy the title, framing, and body to your clipboard.",
          "default",
          () => {
            originalButton(root!, ["Copy draft"])?.click();
            close();
          }
        );
        const clearAction = createMenuButton(
          "Clear draft",
          "Remove the current title, body, setup, and staged context.",
          "danger",
          () => {
            originalButton(root!, ["Clear"])?.click();
            close();
          }
        );
        draftGroup.append(saveAction.element, copyAction.element, clearAction.element);

        const publishGroup = createGroup("Publishing");
        const publishAction = createMenuButton(
          "Publish now",
          "Run the existing validation and publish this discussion immediately.",
          "primary",
          () => {
            originalButton(root!, ["Publish", "Publishing"])?.click();
            close();
          }
        );
        publishGroup.append(publishAction.element);

        moreInner.append(writingGroup, draftGroup, publishGroup);
        more.append(moreInner);
        document.body.append(more);

        modeFoot.className = "mc-mode-foot";
        modeFoot.hidden = true;
        modeFoot.append(
          createButton("Use selected mode structure", "", () =>
            root
              ?.querySelector<HTMLButtonElement>(
                '[data-loombus-insert-structure="true"]'
              )
              ?.click()
          )
        );
        document.body.append(modeFoot);

        function activePanelElement() {
          if (!root || !panel) {
            return null;
          }

          if (panel === "more") {
            return more;
          }

          const roleName = PANEL_ROLE[panel];
          return roleName
            ? root.querySelector<HTMLElement>(`[data-mc-role="${roleName}"]`)
            : null;
        }

        function positionSheetHeader() {
          if (!panel) {
            return;
          }

          const target = activePanelElement();
          if (!target) {
            return;
          }

          const bounds = target.getBoundingClientRect();
          sheetHeaderWrap.style.top = `${Math.max(0, bounds.top)}px`;
        }

        function setDialogAttributes(active: boolean) {
          const target = activePanelElement();
          if (!target || target === more) {
            return;
          }

          if (active) {
            target.setAttribute("role", "dialog");
            target.setAttribute("aria-modal", "true");
            target.setAttribute("aria-labelledby", panelTitle.id);
          } else {
            target.removeAttribute("role");
            target.removeAttribute("aria-modal");
            target.removeAttribute("aria-labelledby");
          }
        }

        function close() {
          if (!panel) {
            return;
          }

          setDialogAttributes(false);
          panel = null;
          delete root!.dataset.mcPanel;
          shade.hidden = true;
          sheetHeaderWrap.hidden = true;
          more.hidden = true;
          modeFoot.hidden = true;
          document.body.style.overflow = previousBodyOverflow;
          previouslyFocused?.focus({ preventScroll: true });
          previouslyFocused = null;
        }

        function open(next: Exclude<Panel, null>) {
          if (panel) {
            close();
          }

          panel = next;
          previouslyFocused =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
          previousBodyOverflow = document.body.style.overflow;
          root!.dataset.mcPanel = next;
          panelTitle.textContent = PANEL_TITLES[next];
          shade.hidden = false;
          sheetHeaderWrap.hidden = false;
          more.hidden = next !== "more";
          modeFoot.hidden = next !== "mode";
          document.body.style.overflow = "hidden";

          if (next === "topic") {
            const area = root!.querySelector('[data-mc-role="topic"]');
            if (!area?.querySelector(".absolute")) {
              area
                ?.querySelector<HTMLButtonElement>(":scope > button")
                ?.click();
            }
          }

          setDialogAttributes(true);
          window.requestAnimationFrame(() => {
            positionSheetHeader();
            closeButton.focus();
          });
        }

        function sync() {
          if (!root) {
            return;
          }

          mark(root);
          hideGlobalUi();

          const selectedTopic = topicLabel(root);
          setText(topic, selectedTopic);
          topic.dataset.configured = selectedTopic === "Topic" ? "false" : "true";

          const selectedMode = modeLabel(root);
          setText(mode, selectedMode);
          mode.dataset.configured = "true";

          const attachment = root.querySelector('[data-mc-role="attachments"]');
          const attachmentCount =
            attachment?.querySelectorAll('button[aria-label^="Remove "]').length ?? 0;
          setText(add, attachmentCount ? `Add · ${attachmentCount}` : "Add");
          add.dataset.configured = attachmentCount ? "true" : "false";

          const draftCard = root.querySelector(
            '[data-mc-role="aside"] section:nth-child(2)'
          );
          const rawDraftStatus =
            draftCard?.querySelector("p")?.textContent?.trim() ?? "Draft";
          const draftStatus = compactDraftStatus(rawDraftStatus);
          setText(draftLabel, draftStatus.label);
          draft.dataset.state = draftStatus.state;

          const message =
            attachment
              ?.querySelector<HTMLParagraphElement>("p.mt-4.text-sm.font-semibold")
              ?.textContent?.trim() ?? "";
          setText(notice, message);
          notice.hidden = !message;

          advancedAction.heading.textContent =
            root.dataset.mcAdvanced === "true"
              ? "Hide response goal and tags"
              : "Show response goal and tags";

          const originalSave = originalButton(root, ["Save Draft", "Saving"]);
          const originalCopy = originalButton(root, ["Copy draft"]);
          const originalClear = originalButton(root, ["Clear"]);
          const originalPublish = originalButton(root, ["Publish", "Publishing"]);
          saveAction.element.disabled = Boolean(originalSave?.disabled);
          copyAction.element.disabled = Boolean(originalCopy?.disabled);
          clearAction.element.disabled = Boolean(originalClear?.disabled);
          publishAction.element.disabled = Boolean(originalPublish?.disabled);

          if (
            panel === "topic" &&
            !root.querySelector('[data-mc-role="topic"] .absolute')
          ) {
            window.setTimeout(close, 80);
          }

          if (panel) {
            window.requestAnimationFrame(positionSheetHeader);
          }
        }

        function handleActivity(event: Event) {
          const target = event.target as Element | null;
          const clicked = target?.closest("button");

          if (
            clicked?.closest('[data-mc-role="mode"]') &&
            ["Open Discussion", "Debate", "Research Question", "Problem Solving"].some(
              (label) => starts(clicked, label)
            )
          ) {
            window.setTimeout(close, 0);
          }

          window.setTimeout(sync, 0);
        }

        function handleKeyDown(event: KeyboardEvent) {
          if (!panel) {
            return;
          }

          if (event.key === "Escape") {
            event.preventDefault();
            close();
            return;
          }

          if (event.key !== "Tab") {
            return;
          }

          const activePanel = activePanelElement();
          if (!activePanel) {
            return;
          }

          const focusable = [
            closeButton,
            ...Array.from(
              activePanel.querySelectorAll<HTMLElement>(
                'button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'
              )
            ),
          ].filter((element, index, values) => values.indexOf(element) === index);

          if (!focusable.length) {
            return;
          }

          const firstFocusable = focusable[0];
          const lastFocusable = focusable[focusable.length - 1];

          if (event.shiftKey && document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable.focus();
          } else if (!event.shiftKey && document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable.focus();
          }
        }

        observer = new MutationObserver(sync);
        observer.observe(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: ["class", "aria-pressed", "disabled"],
        });
        root.addEventListener("click", handleActivity, true);
        root.addEventListener("input", handleActivity, true);
        root.addEventListener("change", handleActivity, true);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", positionSheetHeader);
        window.visualViewport?.addEventListener("resize", positionSheetHeader);
        sync();
        window.setTimeout(sync, 850);

        cleanup = () => {
          cancelled = true;
          observer?.disconnect();
          window.clearTimeout(timer);
          root?.removeEventListener("click", handleActivity, true);
          root?.removeEventListener("input", handleActivity, true);
          root?.removeEventListener("change", handleActivity, true);
          document.removeEventListener("keydown", handleKeyDown);
          window.removeEventListener("resize", positionSheetHeader);
          window.visualViewport?.removeEventListener("resize", positionSheetHeader);

          if (root) {
            delete root.dataset.mobileCreate;
            delete root.dataset.mcPanel;
            delete root.dataset.mcAdvanced;
            for (const element of Array.from(
              root.querySelectorAll<HTMLElement>("[data-mc-role]")
            )) {
              delete element.dataset.mcRole;
              element.removeAttribute("role");
              element.removeAttribute("aria-modal");
              element.removeAttribute("aria-labelledby");
            }
          }

          delete document.body.dataset.createFocusMode;
          for (const element of hiddenGlobals) {
            delete element.dataset.mcGlobalHidden;
          }

          for (const element of [
            style,
            top,
            intro,
            context,
            bottom,
            shade,
            sheetHeaderWrap,
            more,
            modeFoot,
          ]) {
            element.remove();
          }

          document.body.style.overflow = previousBodyOverflow;
        };
      };

      locate();
      if (!cleanup) {
        cleanup = () => {
          cancelled = true;
          window.clearTimeout(timer);
          observer?.disconnect();
        };
      }
    };

    activate();
    media.addEventListener("change", activate);

    return () => {
      media.removeEventListener("change", activate);
      cleanup?.();
    };
  }, []);

  return null;
}
