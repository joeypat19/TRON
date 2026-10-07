const tabs = [];
let activeTabId = null;
let tabSequence = 0;
let updateReady = false;
let latestInstallInProgress = false;
const FALLBACK = "data:image/svg+xml;charset=utf-8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='8.5' fill='none' stroke='#9aa0a6' stroke-width='1.6'/><path d='M3.5 12h17M12 3.5c2.4 2.4 3.6 5.2 3.6 8.5S14.4 18.1 12 20.5c-2.4-2.4-3.6-5.2-3.6-8.5S9.6 5.9 12 3.5Z' fill='none' stroke='#9aa0a6' stroke-width='1.2'/></svg>");
const tabStrip = document.getElementById("tab-strip");
const content = document.getElementById("browser-content");
const addressInput = document.getElementById("address-input");
const updateButton = document.getElementById("update-tron");

function applyBuildInfo(info) {
  const version = info?.version || "unknown";
  const commit = info?.commit && info.commit !== "local" ? ` · ${info.commit}` : "";
  const channel = info?.channel === "development" ? " · development" : "";
  document.querySelectorAll("[data-build-info]").forEach(function(element) {
    element.textContent = `TRON ${version}${commit}${channel}`;
  });
}

function setUpdateButtons(label, disabled, title) {
  [updateButton].concat(Array.from(document.querySelectorAll("[data-update]"))).forEach(function(button) {
    button.disabled = disabled;
    button.textContent = label;
    if (title) button.title = title;
  });
}

try {
  window.localStorage.clear();
  window.sessionStorage.clear();
} catch (_) {
  // Storage may be unavailable in hardened or first-run contexts.
}

function esc(value) { return String(value == null ? "" : value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }
function svg(name) {
  const p = {
    plus:"<path d='M12 5v14M5 12h14'/>",
    mic:"<rect x='9' y='3' width='6' height='11' rx='3'/><path d='M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6'/>",
    lens:"<path d='M8 4H6a2 2 0 0 0-2 2v2M16 4h2a2 2 0 0 1 2 2v2M8 20H6a2 2 0 0 1-2-2v-2M16 20h2a2 2 0 0 0-2-2v-2'/><rect x='7' y='7' width='10' height='10' rx='2'/>",
    sparkle:"<path d='m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm6.5 13 .8 2.7L22 19l-2.7.8L18.5 22l-.8-2.2L15 19l2.7-1.3.8-2.7Z' fill='currentColor' stroke='none'/>",
    arrow:"<path d='M5 12h13M13 6l6 6-6 6'/>",
    share:"<circle cx='18' cy='5' r='2'/><circle cx='6' cy='12' r='2'/><circle cx='18' cy='19' r='2'/><path d='m7.8 11 8.4-5M7.8 13l8.4 5'/>",
    apps:"<circle cx='5' cy='5' r='1.6' fill='currentColor' stroke='none'/><circle cx='12' cy='5' r='1.6' fill='currentColor' stroke='none'/><circle cx='19' cy='5' r='1.6' fill='currentColor' stroke='none'/><circle cx='5' cy='12' r='1.6' fill='currentColor' stroke='none'/><circle cx='12' cy='12' r='1.6' fill='currentColor' stroke='none'/><circle cx='19' cy='12' r='1.6' fill='currentColor' stroke='none'/><circle cx='5' cy='19' r='1.6' fill='currentColor' stroke='none'/><circle cx='12' cy='19' r='1.6' fill='currentColor' stroke='none'/><circle cx='19' cy='19' r='1.6' fill='currentColor' stroke='none'/>"
  };
  return "<svg class='ui-icon' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>" + (p[name] || "") + "</svg>";
}
function current() { return tabs.find(function(t) { return t.id === activeTabId; }) || null; }
function newInternal() { return {id:"tab-" + (++tabSequence),kind:"internal",title:"TRON",url:"tron://home",route:"home",query:"",page:1,data:null,loading:false,error:null,favicon:"./tron-logo.png"}; }
function tabIcon(tab) {
  const holder = document.createElement("span"); holder.className = "tab-favicon";
  const image = document.createElement("img"); image.src = tab.favicon || FALLBACK; image.alt = "";
  image.onerror = function() { image.src = FALLBACK; }; holder.append(image); return holder;
}
function renderTabs() {
  tabStrip.replaceChildren();
  tabs.forEach(function(tab) {
    const node = document.createElement("div"); node.className = "tab" + (tab.id === activeTabId ? " active" : ""); node.title = tab.title || tab.url;
    node.onclick = function() { activate(tab.id); }; node.append(tabIcon(tab));
    const title = document.createElement("span"); title.className = "tab-title"; title.textContent = tab.title || "New tab"; node.append(title);
    const close = document.createElement("button"); close.className = "tab-close"; close.type = "button"; close.textContent = "×"; close.setAttribute("aria-label","Close tab");
    close.onclick = function(event) { event.stopPropagation(); closeTab(tab.id); }; node.append(close); tabStrip.append(node);
  });
}
function updateAddress(tab) { if (!tab) return; addressInput.value = tab.kind === "internal" ? (tab.route === "home" || tab.route === "chat" ? "" : "tron://search?q=" + encodeURIComponent(tab.query)) : tab.url; document.title = "TRON"; }
function external(url,title) {
  const webview = document.createElement("webview"); webview.setAttribute("partition","persist:tron"); webview.setAttribute("allowpopups",""); webview.src = url;
  const tab = {id:"tab-" + (++tabSequence),kind:"external",title:title || "Loading…",url:url,favicon:null,webview:webview}; tabs.push(tab); content.append(webview);
  webview.addEventListener("did-start-loading",function(){tab.favicon=null;renderTabs();});
  webview.addEventListener("page-favicon-updated",function(e){tab.favicon=(e.favicons || []).find(function(x){return typeof x==="string" && (/^https?:\/\//i.test(x) || /^data:image\//i.test(x));}) || null;renderTabs();});
  webview.addEventListener("did-navigate",function(){tab.url=webview.getURL() || tab.url;if(activeTabId===tab.id)updateAddress(tab);});
  webview.addEventListener("did-navigate-in-page",function(){tab.url=webview.getURL() || tab.url;if(activeTabId===tab.id)updateAddress(tab);});
  webview.addEventListener("page-title-updated",function(e){tab.title=e.title || "TRON";renderTabs();});
  webview.addEventListener("new-window",function(e){e.preventDefault();external(e.url);});
  activate(tab.id); return tab;
}
function box(query,compact) {
  return "<div class='search-box-wrap" + (compact ? " compact" : "") + "'><form class='search-form' data-search-form><div class='search-shell'><span class='search-plus'>" + svg("plus") + "</span><input name='q' value='" + esc(query || "") + "' placeholder='Ask TRON' autocomplete='off' spellcheck='false'><button type='button' class='search-action'>" + svg("mic") + "</button><button type='button' class='search-action disabled-action' disabled>" + svg("lens") + "</button><a class='ai-button' data-infinity href='tron://infinity'>" + svg("sparkle") + "<span>Ask Infinity</span>" + svg("arrow") + "</a></div></form></div>";
}
function homeHtml() {
  return "<main class='tron-page home-page'><header class='home-header'><a class='home-brand' data-home href='#'><img src='./tron-logo.png' alt='TRON'></a><nav class='home-nav'><button class='download-button' data-update type='button'>Install latest TRON</button></nav></header><section class='home-content'><div class='home-center'><img class='hero-logo' src='./tron-wordmark.png' alt='TRON logo'>" + box("",false) + "</div><p class='home-version' data-build-info>TRON local build</p></section></main>";
}
function dateText(value) { const d=new Date(value); return Number.isNaN(d.getTime()) ? "Stored locally" : "Stored " + new Intl.DateTimeFormat("en",{dateStyle:"medium"}).format(d); }
function resultHtml(r) {
  const favicon = "http://127.0.0.1:938/api/favicon?domain=" + encodeURIComponent(r.domain || "");
  return "<li class='result-card'><div class='result-source'><img class='source-favicon' src='" + favicon + "' alt='' loading='lazy' decoding='async' onerror=\"this.src='" + FALLBACK + "'\"><span>" + esc(r.domain) + "</span><span class='source-separator'>·</span><span>" + esc(r.age || dateText(r.collected_at)) + "</span></div><a class='result-title' data-result-link href='" + esc(r.url) + "'>" + esc(r.title || "Untitled result") + "</a><a class='result-url' data-result-link href='" + esc(r.url) + "'>" + esc(r.display_url) + "</a>" + (r.description ? "<p class='result-description'>" + esc(r.description) + "</p>" : "") + "</li>";
}
function resultsHtml(tab) {
  if (tab.loading) return "<main class='tron-page results-page'><div class='results-loading'><div class='loading-spinner'></div><p>Searching TRON…</p></div></main>";
  if (tab.error) return "<main class='tron-page results-page'><div class='results-state'><span class='state-symbol'>!</span><h1>TRON could not load local results</h1><p>" + esc(tab.error) + "</p><a class='state-action' data-retry href='#'>Try again</a></div></main>";
  const d=tab.data || {results:[],result_count:0,limit:10}; const rs=d.results || []; const total=Math.max(1,Math.ceil((d.result_count || 0)/(d.limit || 10)));
  const pages=Array.from({length:Math.min(total,9)},function(_,i){return i+1;});
  const tool=d.tool ? "<div class='tool-answer'><div class='tool-answer-heading'><span class='tool-answer-icon'>◷</span><span>Local time</span><span class='tool-answer-live'>Live</span></div><div class='tool-answer-time'>" + esc(d.tool.time) + "</div><div class='tool-answer-date'>" + esc(d.tool.date) + "</div><div class='tool-answer-location'>" + esc(d.tool.location) + "</div></div>" : "";
  const list=rs.length ? "<div class='results-list-column'><ol class='result-list'>" + rs.map(resultHtml).join("") + "</ol><nav class='pagination'><div class='pagination-wordmark'>Tr" + "o".repeat(Math.min(total,24)) + "n</div><div class='pagination-pages'>" + (tab.page>1 ? "<a data-page='" + (tab.page-1) + "' href='#'>Previous</a>" : "") + pages.map(function(p){return p===tab.page ? "<span class='pagination-current'>" + p + "</span>" : "<a data-page='" + p + "' href='#'>" + p + "</a>";}).join("") + (tab.page<total ? "<a data-page='" + (tab.page+1) + "' href='#'>Next</a>" : "") + "</div></nav></div>" : "<div class='results-state'><span class='state-symbol'>—</span><h1>No local results for “" + esc(tab.query) + "”</h1><p>TRON only searches its stored local results and did not find a match.</p></div>";
  return "<main class='tron-page results-page'><header class='results-header'><div class='results-header-main'><a class='results-brand' data-home href='#'><img src='./tron-logo.png' alt='TRON'></a>" + box(tab.query,true) + "<div class='results-header-actions'><span class='results-avatar'>T</span></div></div></header><section class='results-content'>" + tool + list + "</section></main>";
}
function renderInternal(tab) {
  content.querySelectorAll(".internal-page").forEach(function(n){n.remove();});
  const page=document.createElement("div"); page.className="internal-page"; page.innerHTML=tab.route==="home" ? homeHtml() : tab.route==="chat" ? window.tronChat.render(tab) : resultsHtml(tab); content.append(page); bind(page,tab); if(tab.route==="chat") window.tronChat.bind(page,tab,function(){renderInternal(tab);});
}
function bind(page,tab) {
  page.querySelectorAll("[data-search-form]").forEach(function(form){form.addEventListener("submit",function(e){e.preventDefault();const q=new FormData(form).get("q");if(typeof q==="string")search(q,1,tab);});});
  page.querySelectorAll("[data-shortcut-query]").forEach(function(a){a.onclick=function(e){e.preventDefault();search(a.dataset.shortcutQuery,1,tab);};});
  page.querySelectorAll("[data-result-link]").forEach(function(a){a.onclick=function(e){e.preventDefault();external(a.href,a.textContent.trim() || "Web page");};});
  page.querySelectorAll("[data-page]").forEach(function(a){a.onclick=function(e){e.preventDefault();search(tab.query,Number(a.dataset.page),tab);};});
  page.querySelectorAll("[data-home]").forEach(function(a){a.onclick=function(e){e.preventDefault();showHome(tab);};});
  page.querySelectorAll("[data-infinity]").forEach(function(a){a.onclick=function(e){e.preventDefault();showChat(tab);};});
  page.querySelectorAll("[data-update]").forEach(function(a){a.onclick=function(){installLatest();};});
  page.querySelectorAll("[data-retry]").forEach(function(a){a.onclick=function(e){e.preventDefault();search(tab.query,tab.page,tab);};});
}
async function search(query,pageNumber,tab) {
  const q=query.trim(); if(!q || !tab || tab.kind!=="internal") return showHome(tab);
  tab.route="results"; tab.query=q; tab.page=pageNumber || 1; tab.title=q; tab.loading=true; tab.error=null; renderTabs(); updateAddress(tab); renderInternal(tab);
  try { tab.data=await window.tronDesktop.search(q,tab.page,10); } catch(e) { tab.error=e instanceof Error ? e.message : "Search service unavailable."; }
  tab.loading=false; if(activeTabId===tab.id) renderInternal(tab);
}
function showHome(tab) { if(!tab || tab.kind!=="internal") return; tab.route="home";tab.query="";tab.page=1;tab.data=null;tab.loading=false;tab.error=null;tab.title="TRON";renderTabs();updateAddress(tab);renderInternal(tab); }
function showChat(tab) { if(!tab || tab.kind!=="internal") return; tab.route="chat";tab.query="";tab.page=1;tab.loading=false;tab.error=null;tab.title="General Chat";if(!tab.chat) tab.chat=window.tronChat.createState();renderTabs();updateAddress(tab);renderInternal(tab); }
function activate(id) { activeTabId=id;const tab=current();content.querySelectorAll("webview").forEach(function(v){v.style.display="none";});if(tab && tab.kind==="external")tab.webview.style.display="flex";if(tab && tab.kind==="internal")renderInternal(tab);renderTabs();updateAddress(tab); }
function closeTab(id) { const i=tabs.findIndex(function(t){return t.id===id;});if(i<0)return;const old=tabs.splice(i,1)[0];if(old.webview)old.webview.remove();if(!tabs.length){const t=newInternal();tabs.push(t);activate(t.id);}else if(activeTabId===id)activate(tabs[Math.max(0,i-1)].id);else renderTabs(); }
function destination(value) { const v=value.trim();if(!v)return {kind:"home"};if(/^tron:\/\/infinity\/?$/i.test(v))return {kind:"chat"};if(/^tron:\/\/search\?q=/i.test(v))return {kind:"search",query:new URL(v).searchParams.get("q") || ""};if(/^[a-z][a-z\d+.-]*:\/\//i.test(v))return {kind:"external",url:v};if(/^[^\s]+\.[^\s]+(\/.*)?$/i.test(v))return {kind:"external",url:"https://" + v};return {kind:"search",query:v}; }
function navigate(value) { const d=destination(value),t=current();if(d.kind==="home")return t && t.kind==="internal" ? showHome(t) : null;if(d.kind==="chat")return t && t.kind==="internal" ? showChat(t) : null;if(d.kind==="search"){const s=t && t.kind==="internal" ? t : newInternal();if(!tabs.includes(s))tabs.push(s);activate(s.id);return search(d.query,1,s);}external(d.url); }

document.getElementById("new-tab").onclick=function(){const t=newInternal();tabs.push(t);activate(t.id);};
document.getElementById("address-form").onsubmit=function(e){e.preventDefault();navigate(addressInput.value);};
document.getElementById("go-back").onclick=function(){const t=current();if(t && t.kind==="external")t.webview.goBack();else showHome(t);};
document.getElementById("go-forward").onclick=function(){const t=current();if(t && t.kind==="external")t.webview.goForward();};
document.getElementById("reload-page").onclick=function(){const t=current();if(t && t.kind==="external")t.webview.reload();else if(t && t.route==="results")search(t.query,t.page,t);};
document.getElementById("bookmark-page").onclick=function(){addressInput.focus();};
document.getElementById("extensions").onclick=function(){addressInput.blur();};
document.getElementById("profile").onclick=function(){addressInput.blur();};
document.getElementById("browser-menu").onclick=function(){addressInput.blur();};
document.getElementById("minimize-window").onclick=function(){window.tronDesktop.minimize();};
document.getElementById("maximize-window").onclick=function(){window.tronDesktop.toggleMaximize();};
document.getElementById("close-window").onclick=function(){window.tronDesktop.close();};
async function installLatest() {
  if (latestInstallInProgress) return;
  latestInstallInProgress = true;
  setUpdateButtons("Checking release…", true, "Reading the signed TRON release metadata");
  try {
    await window.tronDesktop.installLatest();
  } catch (error) {
    latestInstallInProgress = false;
    setUpdateButtons("Retry latest install", false, error instanceof Error ? error.message : "TRON could not install the latest release.");
  }
}
updateButton.onclick=installLatest;
document.addEventListener("keydown",function(e){if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="l"){e.preventDefault();addressInput.focus();addressInput.select();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="t"){e.preventDefault();const t=newInternal();tabs.push(t);activate(t.id);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="w"){e.preventDefault();if(activeTabId)closeTab(activeTabId);}});
window.tronDesktop.onUpdateStatus(function(s){if(latestInstallInProgress && s.state!=="installing" && s.state!=="error")return;if(s.state==="checking"){setUpdateButtons("Checking release…",true);}else if(s.state==="downloading"){setUpdateButtons(s.percent ? "Downloading " + s.percent + "%" : "Downloading…",true);}else if(s.state==="installing"){setUpdateButtons("Installing latest…",true);}else if(s.state==="ready"){updateReady=true;setUpdateButtons("Restart to update",false);}else if(s.state==="current"){updateReady=false;setUpdateButtons("Install latest TRON",false);}else if(s.state==="error"){updateReady=false;latestInstallInProgress=false;setUpdateButtons("Retry latest install",false,s.message || "TRON could not install the latest release.");}});
const first=newInternal();tabs.push(first);activate(first.id);
window.tronRenderer={showHome:showHome,showChat:showChat};
window.tronDesktop.getBuildInfo().then(applyBuildInfo).catch(function() {});
