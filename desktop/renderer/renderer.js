const tabs = [];
let activeTabId = null;
let tabSequence = 0;
let startUrl = "http://127.0.0.1:2343";

const tabStrip = document.getElementById("tab-strip");
const content = document.getElementById("browser-content");
const addressInput = document.getElementById("address-input");
const updateButton = document.getElementById("update-tron");
let updateReady = false;

function createIconElement() {
  const element = document.createElement("span");
  element.className = "tab-favicon";
  element.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.src = "./tron-logo.png";
  image.alt = "";
  element.append(image);
  return element;
}

function normalizeAddress(value) {
  const trimmed = value.trim();
  if (!trimmed) return startUrl;
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)) return trimmed;
  if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(trimmed)) return `http://${trimmed}`;
  if (/^[^\s]+\.[^\s]+(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  return `${startUrl.replace(/\/$/, "")}/search?q=${encodeURIComponent(trimmed)}`;
}

function activeTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}

function updateAddress(tab) {
  if (!tab) return;
  addressInput.value = tab.url || "";
  document.title = "TRON";
}

function renderTabs() {
  tabStrip.replaceChildren();
  for (const tab of tabs) {
    const tabElement = document.createElement("div");
    tabElement.className = `tab${tab.id === activeTabId ? " active" : ""}`;
    tabElement.title = tab.title || tab.url;
    tabElement.addEventListener("click", () => activateTab(tab.id));

    tabElement.append(createIconElement());
    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "New tab";
    tabElement.append(title);

    const close = document.createElement("button");
    close.className = "tab-close";
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", `Close ${tab.title || "tab"}`);
    close.addEventListener("click", (event) => {
      event.stopPropagation();
      closeTab(tab.id);
    });
    tabElement.append(close);
    tabStrip.append(tabElement);
  }
}

function createTab(url = startUrl, activate = true) {
  const id = `tab-${++tabSequence}`;
  const webview = document.createElement("webview");
  webview.setAttribute("partition", "persist:tron");
  webview.setAttribute("allowpopups", "");
  webview.src = url;

  const tab = { id, title: "TRON", url, webview };
  tabs.push(tab);
  content.append(webview);

  webview.addEventListener("did-start-loading", () => {
    if (activeTabId === id) addressInput.value = webview.getURL() || tab.url;
  });
  webview.addEventListener("did-navigate", () => syncTab(tab));
  webview.addEventListener("did-navigate-in-page", () => syncTab(tab));
  webview.addEventListener("page-title-updated", (event) => {
    tab.title = event.title || "TRON";
    renderTabs();
    if (activeTabId === id) updateAddress(tab);
  });
  webview.addEventListener("new-window", (event) => {
    event.preventDefault();
    createTab(event.url);
  });
  webview.addEventListener("dom-ready", () => {
    if (activeTabId === id) syncTab(tab);
  });

  if (activate) activateTab(id);
  return tab;
}

function syncTab(tab) {
  tab.url = tab.webview.getURL() || tab.url;
  if (activeTabId === tab.id) updateAddress(tab);
}

function activateTab(id) {
  activeTabId = id;
  for (const tab of tabs) tab.webview.style.display = tab.id === id ? "flex" : "none";
  renderTabs();
  updateAddress(activeTab());
}

function closeTab(id) {
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index === -1) return;
  const [tab] = tabs.splice(index, 1);
  tab.webview.remove();
  if (tabs.length === 0) {
    createTab(startUrl);
    return;
  }
  if (activeTabId === id) activateTab(tabs[Math.max(0, index - 1)].id);
  else renderTabs();
}

function navigate(value) {
  const tab = activeTab();
  if (!tab) return;
  const url = normalizeAddress(value);
  tab.url = url;
  tab.webview.loadURL(url);
  updateAddress(tab);
}

document.getElementById("new-tab").addEventListener("click", () => createTab(startUrl));
document.getElementById("address-form").addEventListener("submit", (event) => {
  event.preventDefault();
  navigate(addressInput.value);
});
document.getElementById("go-back").addEventListener("click", () => activeTab()?.webview.goBack());
document.getElementById("go-forward").addEventListener("click", () => activeTab()?.webview.goForward());
document.getElementById("reload-page").addEventListener("click", () => activeTab()?.webview.reload());
document.getElementById("bookmark-page").addEventListener("click", () => addressInput.focus());
document.getElementById("extensions").addEventListener("click", () => addressInput.blur());
document.getElementById("profile").addEventListener("click", () => addressInput.blur());
document.getElementById("browser-menu").addEventListener("click", () => addressInput.blur());
updateButton.addEventListener("click", async () => {
  if (updateReady) {
    updateButton.disabled = true;
    updateButton.textContent = "Restarting…";
    await window.tronDesktop.installUpdate();
    return;
  }
  updateButton.disabled = true;
  updateButton.textContent = "Checking…";
  await window.tronDesktop.checkForUpdates();
});
document.getElementById("minimize-window").addEventListener("click", () => window.tronDesktop.minimize());
document.getElementById("maximize-window").addEventListener("click", () => window.tronDesktop.toggleMaximize());
document.getElementById("close-window").addEventListener("click", () => window.tronDesktop.close());

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
    event.preventDefault();
    addressInput.focus();
    addressInput.select();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
    event.preventDefault();
    createTab(startUrl);
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "w") {
    event.preventDefault();
    if (activeTabId) closeTab(activeTabId);
  }
});

window.tronDesktop.getStartUrl().then((url) => {
  startUrl = url;
  createTab(startUrl);
});

window.tronDesktop.onUpdateStatus((status) => {
  if (status.state === "development") {
    updateButton.disabled = false;
    updateButton.textContent = "Check updates";
  } else if (status.state === "checking") {
    updateButton.disabled = true;
    updateButton.textContent = "Checking…";
  } else if (status.state === "downloading") {
    updateButton.disabled = true;
    updateButton.textContent = status.percent ? `Updating ${status.percent}%` : "Downloading…";
  } else if (status.state === "ready") {
    updateReady = true;
    updateButton.disabled = false;
    updateButton.textContent = "Restart to update";
    updateButton.title = `TRON ${status.version} is ready to install`;
  } else if (status.state === "current") {
    updateReady = false;
    updateButton.disabled = false;
    updateButton.textContent = "TRON is up to date";
    window.setTimeout(() => {
      if (!updateReady) updateButton.textContent = "Check for updates";
    }, 3500);
  } else if (status.state === "error") {
    updateReady = false;
    updateButton.disabled = false;
    updateButton.textContent = "Retry update";
    updateButton.title = status.message || "Update check failed";
  }
});
