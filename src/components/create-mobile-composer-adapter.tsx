"use client";

import { useEffect } from "react";

type Panel = "topic" | "mode" | "attachments" | "guidance" | "more" | null;

const CSS = String.raw`
@media (max-width:767px){
main[data-mobile-create]{padding:0 0 calc(6.4rem + env(safe-area-inset-bottom))!important}
main[data-mobile-create]>section{max-width:none!important}
main[data-mobile-create] [data-mc-role="desktop-header"]{display:none!important}
main[data-mobile-create] form{display:block!important}
main[data-mobile-create] form>div:first-child{display:block!important}
main[data-mobile-create] form>div:first-child>section:first-of-type{margin:0 1rem!important;border-radius:1.65rem!important;padding:0!important;overflow:hidden!important}
main[data-mobile-create] form>div:first-child>section:first-of-type>.grid{display:flex!important;flex-direction:column!important;gap:0!important}
main[data-mobile-create] [data-mc-role="title"]{order:1;padding:1rem!important;border-bottom:1px solid var(--loombus-border)}
main[data-mobile-create] [data-mc-role="title"]>span,main[data-mobile-create] [data-mc-role="title"]>p{display:none!important}
main[data-mobile-create] [data-mc-role="title"] input{border:0!important;background:transparent!important;padding:0!important;font-size:1.18rem!important;line-height:1.55rem!important;font-weight:850!important;box-shadow:none!important}
main[data-mobile-create] [data-mc-role="body"]{order:2;padding:1rem!important}
main[data-mobile-create] [data-mc-role="body"]>div{margin-bottom:.35rem!important}
main[data-mobile-create] [data-mc-role="body"]>div>span:first-child{display:none!important}
main[data-mobile-create] [data-mc-role="body"] textarea{min-height:15rem!important;resize:none!important;border:0!important;background:transparent!important;padding:0!important;font-size:1rem!important;line-height:1.75rem!important;box-shadow:none!important}
main[data-mobile-create] [data-mc-role="body"]>p{margin-top:.5rem!important}
main[data-mobile-create] [data-mc-role="topic"],main[data-mobile-create] [data-mc-role="mode"],main[data-mobile-create] [data-mc-role="mode-guide"],main[data-mobile-create] [data-mc-role="purpose"],main[data-mobile-create] [data-mc-role="guidance"],main[data-mobile-create] [data-mc-role="tags"],main[data-mobile-create] [data-mc-role="attachments"],main[data-mobile-create] [data-mc-role="aside"],main[data-mobile-create] [data-mc-role="extra"]{display:none!important}
main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"],main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="tags"]{display:block!important;order:3;padding:1rem!important;border-top:1px solid var(--loombus-border)}
main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"] .text-red-500{display:none!important}
main[data-mobile-create][data-mc-advanced="true"] [data-mc-role="purpose"]>span:first-child:after{content:" (optional)";font-weight:600;color:var(--loombus-text-muted)}
main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"],main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"],main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"],main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{display:block!important;position:fixed!important;inset-inline:0!important;bottom:0!important;z-index:81!important;width:100%!important;height:min(82vh,46rem)!important;overflow-y:auto!important;margin:0!important;border:1px solid var(--loombus-border)!important;border-bottom:0!important;border-radius:2rem 2rem 0 0!important;background:var(--loombus-surface)!important;padding:5rem 1rem calc(1rem + env(safe-area-inset-bottom))!important;box-shadow:0 -1.25rem 4rem rgb(0 0 0/.28)!important}
main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"]>span,main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]>p:first-child,main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>p:first-child,main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"] h2{display:none!important}
main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"] .absolute{position:static!important;margin-top:.75rem!important;box-shadow:none!important}
main[data-mobile-create][data-mc-panel="topic"] [data-mc-role="topic"] .max-h-64{max-height:48vh!important}
main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]{padding-bottom:6rem!important}
main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"]>div{grid-template-columns:1fr!important}
main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"] button{padding:.9rem!important;text-align:left!important}
main[data-mobile-create][data-mc-panel="mode"] [data-mc-role="mode"] button svg{margin:0!important}
main[data-mobile-create][data-mc-panel="attachments"] [data-mc-role="attachments"]>div.mt-4.grid{grid-template-columns:1fr!important}
main[data-mobile-create][data-mc-panel="guidance"] [data-mc-role="guidance"]{color:var(--loombus-text)!important}
}
`;

function rootForCreate(){return Array.from(document.querySelectorAll<HTMLElement>("main")).find(main=>main.querySelector("h1")?.textContent?.trim()==="Create Discussion")??null}
function starts(el:Element,value:string){return el.textContent?.trim().startsWith(value)??false}
function originalButton(root:Element,labels:string[]){return Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(button=>!button.closest("[data-mc-ui]")&&labels.some(label=>starts(button,label)))}
function role(el:Element|null|undefined,name:string){if(el instanceof HTMLElement&&el.dataset.mcRole!==name)el.dataset.mcRole=name}
function text(el:HTMLElement,value:string){if(el.textContent!==value)el.textContent=value}
function purposeInput(root:Element){return Array.from(root.querySelectorAll<HTMLInputElement>("input")).find(input=>input.dataset.loombusPurposeInput==="true"||input.placeholder.includes("hope to achieve")||["Discussion Purpose","Debate Goal","Research Goal","Desired Outcome"].some(label=>input.closest("label")?.textContent?.includes(label)))}
function button(text:string,classes:string,action:()=>void){const el=document.createElement("button");el.type="button";el.textContent=text;el.className=classes;el.addEventListener("click",action);return el}
function mark(root:HTMLElement){
 const form=root.querySelector("form"),primary=form?.firstElementChild,first=primary?.querySelector(":scope > section:first-of-type");
 const inputs=Array.from(first?.querySelectorAll<HTMLInputElement>('input[type="text"]')??[]);
 const title=inputs.find(input=>input.placeholder.toLowerCase().includes("future"));
 const tags=inputs.find(input=>input.placeholder.includes("web3"));
 const body=first?.querySelector("textarea");
 const topicBtn=Array.from(first?.querySelectorAll<HTMLButtonElement>("button")??[]).find(btn=>btn.textContent?.includes("Choose an approved topic")||btn.querySelector("svg")?.className.baseVal?.includes("lucide-plus"));
 const modeBtn=Array.from(first?.querySelectorAll<HTMLButtonElement>("button")??[]).find(btn=>starts(btn,"Open Discussion"));
 const guideHeading=Array.from(first?.querySelectorAll("h2")??[]).find(h=>h.textContent?.includes("AI draft tools")||h.textContent?.includes("Draft Guidance"));
 const attachment=form?.querySelector<HTMLInputElement>('input[type="file"][accept="video/*"]')?.closest("section");
 role(root.querySelector(":scope > section > header"),"desktop-header");role(title?.closest("label"),"title");role(body?.closest("label"),"body");role(topicBtn?.closest("div.relative"),"topic");role(modeBtn?.parentElement?.parentElement,"mode");role(first?.querySelector('[data-loombus-mode-guidance="true"]'),"mode-guide");role(purposeInput(first??root)?.closest("label"),"purpose");role(tags?.closest("label"),"tags");role(guideHeading?.closest("section"),"guidance");role(attachment,"attachments");role(form?.querySelector("aside"),"aside");
 if(primary)for(const section of Array.from(primary.querySelectorAll(":scope > section")))if(section!==first&&section!==attachment)role(section,"extra");
}
function topicLabel(root:HTMLElement){const area=root.querySelector('[data-mc-role="topic"]');const btn=area?.querySelector<HTMLButtonElement>(":scope > button");const text=btn?.textContent?.replace(/\s+/g," ").trim()??"";return !text||text.includes("Choose an approved topic")?"Topic":text.replace(/^\+\s*/,"")}
function modeLabel(root:HTMLElement){const area=root.querySelector('[data-mc-role="mode"]');const btn=Array.from(area?.querySelectorAll<HTMLButtonElement>("button")??[]).find(b=>b.getAttribute("aria-pressed")==="true"||b.className.includes("border-amber-400"));return ["Open Discussion","Debate","Research Question","Problem Solving"].find(label=>btn?starts(btn,label):false)||"Open Discussion"}

export function CreateMobileComposerAdapter(){
 useEffect(()=>{
  const media=window.matchMedia("(max-width:767px)");let cleanup:(()=>void)|null=null;
  const activate=()=>{cleanup?.();cleanup=null;if(!media.matches)return;let cancelled=false,timer=0,observer:MutationObserver|null=null,root:HTMLElement|null=null;
   const locate=()=>{if(cancelled)return;root=rootForCreate();if(!root){timer=window.setTimeout(locate,100);return}mark(root);root.dataset.mobileCreate="true";
    const style=document.createElement("style");style.dataset.mcUi="true";style.textContent=CSS;document.head.append(style);
    const first=root.querySelector("form > div:first-child > section:first-of-type");const top=document.createElement("div"),chips=document.createElement("div"),bottom=document.createElement("div"),shade=document.createElement("button"),sheetHead=document.createElement("div"),more=document.createElement("section"),modeFoot=document.createElement("div");
    for(const el of [top,chips,bottom,shade,sheetHead,more,modeFoot])el.dataset.mcUi="true";
    top.className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+.75rem)]";const topRow=document.createElement("div");topRow.className="mx-auto flex max-w-2xl items-center justify-between gap-3";const cancel=document.createElement("a");cancel.href="/discussions";cancel.textContent="Cancel";cancel.className="px-2 py-2 text-sm font-bold text-[var(--loombus-text-muted)]";const heading=document.createElement("strong");heading.textContent="Create Discussion";heading.className="text-base font-black";const draft=button("Draft","max-w-[7rem] truncate px-2 py-2 text-right text-xs font-bold text-[var(--loombus-text-muted)]",()=>originalButton(root!,["Save Draft","Saving"])?.click());topRow.append(cancel,heading,draft);top.append(topRow);first?.insertAdjacentElement("beforebegin",top);
    chips.className="px-4 pt-3";const chipRow=document.createElement("div");chipRow.className="flex gap-2 overflow-x-auto pb-1";const topic=button("Topic","min-h-11 shrink-0 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-black",()=>open("topic"));const mode=button("Open Discussion","min-h-11 shrink-0 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-black",()=>open("mode"));const add=button("Add","min-h-11 shrink-0 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-black",()=>open("attachments"));chipRow.append(topic,mode,add);const notice=document.createElement("p");notice.className="mt-3 hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-semibold text-[var(--loombus-text-muted)]";chips.append(chipRow,notice);first?.insertAdjacentElement("afterend",chips);
    bottom.className="fixed inset-x-0 bottom-0 z-[65] border-t border-[var(--loombus-border)] bg-[color:color-mix(in_srgb,var(--loombus-page-bg)_94%,transparent)] px-3 pb-[calc(env(safe-area-inset-bottom)+.65rem)] pt-2 backdrop-blur-xl";const bottomRow=document.createElement("div");bottomRow.className="mx-auto grid max-w-2xl grid-cols-[1fr_1fr_1fr_1.35fr] gap-2";const small="min-h-12 rounded-2xl text-[.72rem] font-black text-[var(--loombus-text-muted)]";bottomRow.append(button("Attach",small,()=>open("attachments")),button("Guidance",small,()=>open("guidance")),button("More",small,()=>open("more")),button("Review","min-h-12 rounded-2xl bg-[#d6a84f] px-4 text-sm font-black text-slate-950",()=>originalButton(root!,["Review draft"])?.click()));bottom.append(bottomRow);document.body.append(bottom);
    shade.type="button";shade.ariaLabel="Close composer options";shade.className="fixed inset-0 z-[79] hidden bg-black/55";shade.addEventListener("click",close);document.body.append(shade);
    sheetHead.className="pointer-events-none fixed inset-x-0 bottom-0 z-[83] hidden h-[min(82vh,46rem)]";const headRow=document.createElement("div");headRow.className="pointer-events-auto flex h-[4.7rem] items-center justify-between border-b border-[var(--loombus-border)] px-4";const panelTitle=document.createElement("strong");panelTitle.className="text-lg font-black";const closeBtn=button("×","grid size-10 place-items-center rounded-full bg-[var(--loombus-surface-muted)] text-xl text-[var(--loombus-text-muted)]",close);headRow.append(panelTitle,closeBtn);sheetHead.append(headRow);document.body.append(sheetHead);
    more.className="fixed inset-x-0 bottom-0 z-[81] hidden h-[min(82vh,46rem)] overflow-y-auto rounded-t-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-[5.4rem] shadow-2xl";const moreInner=document.createElement("div");moreInner.className="mx-auto grid max-w-2xl gap-3";const advanced=button("Show response goal and tags","rounded-2xl border border-[var(--loombus-border)] px-4 py-3 text-sm font-black",()=>{root!.dataset.mcAdvanced=root!.dataset.mcAdvanced==="true"?"false":"true";close()});moreInner.append(advanced,button("Save draft","rounded-2xl border border-[var(--loombus-border)] px-4 py-3 text-sm font-black",()=>originalButton(root!,["Save Draft","Saving"])?.click()),button("Copy draft","rounded-2xl border border-[var(--loombus-border)] px-4 py-3 text-sm font-black",()=>originalButton(root!,["Copy draft"])?.click()),button("Clear draft","rounded-2xl border border-red-300 px-4 py-3 text-sm font-black text-red-500",()=>originalButton(root!,["Clear"])?.click()),button("Publish now","rounded-2xl bg-[#d6a84f] px-4 py-3 text-sm font-black text-slate-950",()=>originalButton(root!,["Publish","Publishing"])?.click()));more.append(moreInner);document.body.append(more);
    modeFoot.className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+.8rem)] z-[84] hidden px-4";modeFoot.append(button("Use selected mode structure","mx-auto block w-full max-w-2xl rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm font-black",()=>root!.querySelector<HTMLButtonElement>('[data-loombus-insert-structure="true"]')?.click()));document.body.append(modeFoot);
    let panel:Panel=null;
    function close(){panel=null;delete root!.dataset.mcPanel;shade.classList.add("hidden");sheetHead.classList.add("hidden");more.classList.add("hidden");modeFoot.classList.add("hidden");document.body.style.overflow=""}
    function open(next:Panel){panel=next;root!.dataset.mcPanel=next??"";shade.classList.remove("hidden");sheetHead.classList.remove("hidden");more.classList.toggle("hidden",next!=="more");modeFoot.classList.toggle("hidden",next!=="mode");panelTitle.textContent=next==="topic"?"Topic and classification":next==="mode"?"Discussion mode":next==="attachments"?"Add supporting context":next==="guidance"?"Draft Guidance":"More options";document.body.style.overflow="hidden";if(next==="topic"){const area=root!.querySelector('[data-mc-role="topic"]');if(!area?.querySelector(".absolute"))area?.querySelector<HTMLButtonElement>(":scope > button")?.click()}}
    function sync(){if(!root)return;mark(root);text(topic,topicLabel(root));text(mode,modeLabel(root));const attachment=root.querySelector('[data-mc-role="attachments"]');const count=attachment?.querySelectorAll('button[aria-label^="Remove "]').length??0;text(add,count?`Add · ${count}`:"Add");const draftCard=root.querySelector('[data-mc-role="aside"] section:nth-child(2)');text(draft,draftCard?.querySelector("p")?.textContent?.trim()||"Draft");const msg=attachment?.querySelector<HTMLParagraphElement>("p.mt-4.text-sm.font-semibold")?.textContent?.trim()||"";text(notice,msg);notice.classList.toggle("hidden",!msg);if(panel==="topic"&&!root.querySelector('[data-mc-role="topic"] .absolute'))window.setTimeout(close,80)}
    function activity(event:Event){const target=event.target as Element|null;const clicked=target?.closest("button");if(clicked?.closest('[data-mc-role="mode"]')&&["Open Discussion","Debate","Research Question","Problem Solving"].some(label=>starts(clicked,label)))window.setTimeout(close,0);window.setTimeout(sync,0)}
    observer=new MutationObserver(sync);observer.observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:["class","aria-pressed","disabled"]});root.addEventListener("click",activity,true);root.addEventListener("input",activity,true);root.addEventListener("change",activity,true);sync();window.setTimeout(sync,850);
    cleanup=()=>{cancelled=true;observer?.disconnect();window.clearTimeout(timer);root?.removeEventListener("click",activity,true);root?.removeEventListener("input",activity,true);root?.removeEventListener("change",activity,true);if(root){delete root.dataset.mobileCreate;delete root.dataset.mcPanel;delete root.dataset.mcAdvanced;for(const el of Array.from(root.querySelectorAll<HTMLElement>("[data-mc-role]")))delete el.dataset.mcRole}for(const el of [style,top,chips,bottom,shade,sheetHead,more,modeFoot])el.remove();document.body.style.overflow=""};
   };locate();if(!cleanup)cleanup=()=>{cancelled=true;window.clearTimeout(timer);observer?.disconnect()};
  };
  activate();media.addEventListener("change",activate);return()=>{media.removeEventListener("change",activate);cleanup?.()}
 },[]);
 return null;
}
