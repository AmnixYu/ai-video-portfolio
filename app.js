const $ = (s) => document.querySelector(s);
const state = { projects: [], filter: "ALL" };
const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function normalizeEmbed(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  let src = s;
  const match = s.match(/src\s*=\s*["']([^"']+)["']/i);
  if (match) src = match[1];
  if (src.startsWith("//")) src = "https:" + src;
  try {
    const u = new URL(src);
    const allowed = ["player.bilibili.com", "www.youtube-nocookie.com", "www.youtube.com", "player.vimeo.com"];
    if (allowed.includes(u.hostname)) return u.href;
    if (u.hostname === "open.douyin.com" && u.pathname === "/player/video" && u.searchParams.get("vid")) return u.href;
    if ((u.hostname === "www.douyin.com" || u.hostname === "douyin.com") && /^\/video\/\d+/.test(u.pathname)) {
      const id = u.pathname.match(/^\/video\/(\d+)/)[1];
      return `https://open.douyin.com/player/video?vid=${id}&autoplay=1`;
    }
    if (u.protocol === "https:" && /\.(mp4|webm)(\?.*)?$/i.test(u.pathname + u.search)) return u.href;
  } catch (e) {}
  return "";
}
function isDirectVideo(url=""){return /\.(mp4|webm)(\?.*)?$/i.test(url);}
function videoPlatform(url=""){try{return new URL(url).hostname.includes("bilibili.com")?"BILIBILI":new URL(url).hostname.toUpperCase()}catch(e){return "VIDEO"}}
function visibleProjects(){return state.projects.filter(p=>p.published!==false && (state.filter==="ALL"||p.category===state.filter)).sort((a,b)=>(a.order||0)-(b.order||0));}
function renderFilters(){
 const cats=[...new Set(state.projects.filter(p=>p.published!==false).map(p=>p.category||"OTHER"))];
 $("#filters").innerHTML=["ALL",...cats].map(c=>`<button class="filter-button ${state.filter===c?"active":""}" data-filter="${esc(c)}">${c==="ALL"?"全部作品":esc(c)}</button>`).join("");
 $("#filters").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{state.filter=b.dataset.filter;renderFilters();renderGrid()}));
}
function renderGrid(){
 const projects=visibleProjects();$("#workCount").textContent=state.projects.filter(p=>p.published!==false).length;
 $("#workGrid").innerHTML=projects.length?projects.map((p,i)=>`<article class="work-card" tabindex="0" role="button" data-id="${esc(p.id)}" aria-label="查看 ${esc(p.title)}"><div class="work-image"><img loading="lazy" src="${esc(p.cover||"assets/cover-placeholder.svg")}" alt="${esc(p.title)}" onerror="this.src='assets/cover-placeholder.svg'"><span class="play-indicator">↗</span></div><div class="work-meta"><div><h3>${esc(p.title)}</h3><p>${esc(p.category||"PROJECT")}</p></div><span class="work-index">${String(i+1).padStart(2,"0")}</span></div></article>`).join(""):`<div class="empty-state">目前没有展示中的作品。</div>`;
 $("#workGrid").querySelectorAll(".work-card").forEach(card=>{const open=()=>openProject(card.dataset.id);card.addEventListener("click",open);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}})});
}

/* ===== 抖音播放器自适应缩放 ===== */
let douyinResizeHandler = null;

function clearDouyinResize(){
  if (douyinResizeHandler) {
    window.removeEventListener("resize", douyinResizeHandler);
    douyinResizeHandler = null;
  }
}

function fitDouyin(box, allowRetry){
  const wrap = box.querySelector(".douyin-scale-wrap");
  if (!wrap) return;
  const iframe = wrap.querySelector("iframe");
  if (!iframe) return;
  const portrait = box.classList.contains("portrait-player");
  /* 抖音播放器自身可正常渲染的最小宽度（横屏 640，竖屏 400） */
  const MIN_W = portrait ? 400 : 640;
  const ratio = portrait ? 711 / 400 : 360 / 640;
  const availW = box.clientWidth;
  const availH = box.clientHeight;
  if (!availW || !availH) {
    if (allowRetry !== false) setTimeout(() => fitDouyin(box, false), 80);
    return;
  }
  /* 基准尺寸：取"容器宽"和"最小宽度"里较大的那个
     —— 大屏时基准 = 容器宽（不放大、填满）；
     —— 小屏时基准 = 640（抖音最小可渲染宽度），再整体 scale 缩进容器 */
  const baseW = Math.max(MIN_W, availW, availH / ratio);
  const baseH = baseW * ratio;
  iframe.style.width = baseW + "px";
  iframe.style.height = baseH + "px";
  wrap.style.width = baseW + "px";
  wrap.style.height = baseH + "px";
  const scale = Math.min(availW / baseW, availH / baseH);
  wrap.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
/* ===== 抖音播放器适配结束 ===== */

function openProject(id){
 const p=state.projects.find(x=>x.id===id);if(!p)return;
 $("#modalCategory").textContent=p.category||"PROJECT";$("#modalTitle").textContent=p.title||"Untitled";$("#modalSubtitle").textContent=p.subtitle||"";
 $("#modalDescription").textContent=p.description||"";
 $("#modalTags").innerHTML=(p.tags||[]).map(t=>`<span class="modal-tag">${esc(t)}</span>`).join("");
 const url=normalizeEmbed(p.embed||"");const box=$("#modalVideo");
 const isDouyin=!!url && new URL(url).hostname==="open.douyin.com";
 box.classList.toggle("douyin-player",isDouyin);
 box.classList.toggle("portrait-player",isDouyin && p.orientation==="portrait");
 clearDouyinResize();

 if(url){
   if(isDirectVideo(url)){
     box.innerHTML=`<video controls playsinline src="${esc(url)}"></video>`;
   }else if(isDouyin){
     const iframeUrl=url.replace(/([?&])autoplay=0(&|$)/,"$1autoplay=1$2");
     box.innerHTML=`<div class="douyin-scale-wrap"><iframe src="${esc(iframeUrl)}" title="${esc(p.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" scrolling="no" referrerpolicy="unsafe-url" allowfullscreen></iframe></div>`;
     douyinResizeHandler=()=>fitDouyin(box);
     window.addEventListener("resize",douyinResizeHandler);
     requestAnimationFrame(()=>requestAnimationFrame(()=>fitDouyin(box)));
   }else{
     box.innerHTML=`<iframe src="${esc(url)}" title="${esc(p.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" scrolling="no" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
   }
 }else{
   box.innerHTML=`<div style="position:absolute;inset:0;display:grid;place-items:center;color:#999;font-size:13px">请在管理后台添加有效的视频嵌入代码</div>`;
 }

 const ext=$("#originalLink");if(url){ext.style.display="inline-flex";ext.href=url}else{ext.style.display="none";ext.removeAttribute("href")}
 $("#modal").classList.add("open");$("#modal").setAttribute("aria-hidden","false");document.body.classList.add("no-scroll");$("#modalClose").focus();
}

function closeModal(){
 clearDouyinResize();
 $("#modal").classList.remove("open");
 $("#modal").setAttribute("aria-hidden","true");
 $("#modalVideo").innerHTML="";
 document.body.classList.remove("no-scroll");
}

$("#modalClose").addEventListener("click",closeModal);
$("#modal").addEventListener("click",e=>{if(e.target===$("#modal"))closeModal()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal()});

async function init(){
 $("#year").textContent=new Date().getFullYear();
 try{const r=await fetch("projects.json",{cache:"no-store"});if(!r.ok)throw new Error("HTTP "+r.status);state.projects=await r.json();state.projects=state.projects.filter(p=>p.published!==false);renderFilters();renderGrid();}
 catch(e){$("#workGrid").innerHTML='<div class="empty-state">作品列表暂时无法载入。请稍后刷新。</div>';}
 try{const r=await fetch("site-settings.json",{cache:"no-store"});if(r.ok){const s=await r.json();if(s.heroIntro)$("#heroIntro").textContent=s.heroIntro;if(s.aboutText)$("#aboutText").textContent=s.aboutText;if(s.contactText)$("#contactText").textContent=s.contactText;if(s.email){$("#contactLink").textContent=s.email+" ↗";$("#contactLink").href="mailto:"+s.email}if(Array.isArray(s.skills))$("#skills").innerHTML=s.skills.map(x=>`<span class="skill">${esc(x)}</span>`).join("")}}
 catch(e){}
}
init();
