const $ = (s) => document.querySelector(s);
const state = { projects: [], filter: "ALL" };
const esc = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const PLACEHOLDER = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#20201e"/><text x="8" y="4.7" font-size="0.65" fill="#92918d" text-anchor="middle" dominant-baseline="middle" font-family="monospace" letter-spacing="0.08">NO COVER</text></svg>'
);

/* 封面路径：中文/空格做一次安全编码，data:/http(s) 直接返回 */
function coverUrl(p){
  const s = String(p || "").trim();
  if (!s) return PLACEHOLDER;
  if (/^(data:|blob:|https?:)/i.test(s)) return s;
  try {
    return encodeURI(decodeURI(s));
  } catch (e) {
    return encodeURI(s);
  }
}

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
 const projects=visibleProjects();
 const allPublished=state.projects.filter(p=>p.published!==false).sort((a,b)=>(a.order||0)-(b.order||0));
 $("#workCount").textContent=String(allPublished.length).padStart(2,"0");
 const featured=allPublished[0];
 const heroVisual=$("#heroVisual");
 if(featured && heroVisual){
   const heroCover=coverUrl(featured.cover);
   heroVisual.querySelector(".hero-image-placeholder").innerHTML=`<img src="${esc(heroCover)}" alt="${esc(featured.title)}" loading="eager"><span>STORIES IN MOTION</span>`;
   $("#heroCaption").textContent=featured.title||"精选影像";
   const heroImg=heroVisual.querySelector("img");
   heroImg.addEventListener("error",()=>{heroImg.src=PLACEHOLDER},{once:true});
   heroVisual.style.cursor="pointer";
   heroVisual.setAttribute("role","button");heroVisual.setAttribute("tabindex","0");
   heroVisual.onclick=()=>openProject(featured.id);
   heroVisual.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openProject(featured.id)}};
 }
 $("#workGrid").innerHTML=projects.length?projects.map((p,i)=>{
   const cover = coverUrl(p.cover);
   return `<article class="work-card" tabindex="0" role="button" data-id="${esc(p.id)}" aria-label="查看 ${esc(p.title)}"><div class="work-image"><img decoding="async" src="${esc(cover)}" data-fallback="${esc(PLACEHOLDER)}" alt="${esc(p.title)}"><span class="play-indicator">↗</span></div><div class="work-meta"><div><h3>${esc(p.title)}</h3><p>${esc(p.category||"PROJECT")}</p></div><span class="work-index">${String(i+1).padStart(2,"0")}</span></div></article>`;
 }).join(""):`<div class="empty-state">目前没有展示中的作品。</div>`;

 $("#workGrid").querySelectorAll(".work-image img").forEach(img=>{
   img.addEventListener("error", function onErr(){
     img.removeEventListener("error", onErr);
     img.src = img.dataset.fallback || PLACEHOLDER;
   });
 });

 $("#workGrid").querySelectorAll(".work-card").forEach(card=>{const open=()=>openProject(card.dataset.id);card.addEventListener("click",open);card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open()}})});
}

/* ===== 抖音播放器自适应缩放 ===== */
let douyinResizeHandler = null;
let douyinObserver = null;

function clearDouyinResize(){
  if (douyinResizeHandler) {
    window.removeEventListener("resize", douyinResizeHandler);
    douyinResizeHandler = null;
  }
  if (douyinObserver) {
    douyinObserver.disconnect();
    douyinObserver = null;
  }
}

function fitDouyin(box, allowRetry){
  const wrap = box.querySelector(".douyin-scale-wrap");
  if (!wrap) return;
  const iframe = wrap.querySelector("iframe");
  if (!iframe) return;
  const portrait = box.classList.contains("portrait-player");
  const baseW = portrait ? 720 : 1280;
  const baseH = portrait ? 1280 : 720;
  iframe.style.width  = baseW + "px";
  iframe.style.height = baseH + "px";
  wrap.style.width  = baseW + "px";
  wrap.style.height = baseH + "px";
  const availW = box.clientWidth;
  const availH = box.clientHeight;
  if (!availW || !availH) {
    if (allowRetry !== false) setTimeout(() => fitDouyin(box, false), 100);
    return;
  }
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
 const portrait=isDouyin && p.orientation==="portrait";
 box.classList.toggle("douyin-player",isDouyin);
 box.classList.toggle("portrait-player",portrait);
 clearDouyinResize();

 if(url){
   if(isDirectVideo(url)){
     box.innerHTML=`<video controls playsinline src="${esc(url)}"></video>`;
   }else if(isDouyin){
     const iframeUrl=url.replace(/([?&])autoplay=0(&|$)/,"$1autoplay=1$2")
                        .replace(/([?&])muted=[^&]*/,"")
                        + (url.includes("?") ? "&" : "?") + "muted=1";
     const baseW=portrait?720:1280, baseH=portrait?1280:720;
     box.innerHTML=`<div class="douyin-scale-wrap" style="width:${baseW}px;height:${baseH}px"><iframe src="${esc(iframeUrl)}" width="${baseW}" height="${baseH}" style="width:${baseW}px;height:${baseH}px" title="${esc(p.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" scrolling="no" referrerpolicy="unsafe-url" allowfullscreen></iframe></div>`;
     douyinResizeHandler=()=>fitDouyin(box);
     window.addEventListener("resize",douyinResizeHandler);
     if ("ResizeObserver" in window) {
       douyinObserver = new ResizeObserver(() => fitDouyin(box, false));
       douyinObserver.observe(box);
     }
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
 try{const r=await fetch("site-settings.json",{cache:"no-store"});if(r.ok){const s=await r.json();if(s.heroIntro)$("#heroIntro").textContent=s.heroIntro;if(s.aboutText)$("#aboutText").textContent=s.aboutText;if(s.contactText)$("#contactText").textContent=s.contactText;if(s.email){$("#contactChannel").hidden=false;$("#contactEmail").textContent=s.email;$("#contactEmail").innerHTML=`<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`}if(Array.isArray(s.skills))$("#skills").innerHTML=s.skills.map(x=>`<span class="skill">${esc(x)}</span>`).join("")}}
 catch(e){}
}
init();
