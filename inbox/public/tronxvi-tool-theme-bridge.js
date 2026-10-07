(() => {
  "use strict";

  const messageType = "tronxvi:tool-theme";
  const root = document.documentElement;
  const themeSafetyNetCss = `
    /* Keep every embedded tool scrollable without showing native scrollbar
       tracks/thumbs or the oversized rails they create at narrow widths. */
    html,
    body,
    #root,
    * {
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
      scrollbar-gutter: auto !important;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar,
    #root::-webkit-scrollbar,
    *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }

    html::-webkit-scrollbar-track,
    body::-webkit-scrollbar-track,
    #root::-webkit-scrollbar-track,
    *::-webkit-scrollbar-track,
    html::-webkit-scrollbar-thumb,
    body::-webkit-scrollbar-thumb,
    #root::-webkit-scrollbar-thumb,
    *::-webkit-scrollbar-thumb,
    html::-webkit-scrollbar-button,
    body::-webkit-scrollbar-button,
    #root::-webkit-scrollbar-button,
    *::-webkit-scrollbar-button,
    html::-webkit-scrollbar-corner,
    body::-webkit-scrollbar-corner,
    #root::-webkit-scrollbar-corner,
    *::-webkit-scrollbar-corner {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
      border: 0 !important;
      background: transparent !important;
    }

    html, body, #root {
      background-color: var(--theme-page-bg, var(--bg, #010304)) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body :where(
      button,
      input,
      textarea,
      select,
      [role="button"]
    ) {
      border-color: var(--theme-lock-ui-border, var(--line, rgba(242, 245, 247, 0.16))) !important;
      background-color: var(--theme-surface, var(--panel, #030506)) !important;
      color: var(--text, #f2f5f7) !important;
      accent-color: var(--accent, #f2f5f7);
    }

    body :where([data-tronxvi-accent-button]) {
      color: var(--accent-contrast, var(--theme-button-text, var(--appearance-text, var(--theme-page-bg, #010304)))) !important;
      -webkit-text-fill-color: var(--accent-contrast, var(--theme-button-text, var(--appearance-text, var(--theme-page-bg, #010304)))) !important;
    }

    body :where(input, textarea, select)::placeholder {
      color: var(--text-muted, var(--theme-lock-muted, var(--muted, #aab2ba))) !important;
    }

    body :where(
      button:hover,
      button:focus-visible,
      [role="button"]:hover,
      [role="button"]:focus-visible,
      input:focus-visible,
      textarea:focus-visible,
      select:focus-visible
    ) {
      border-color: var(--accent, #f2f5f7) !important;
      outline-color: var(--accent, #f2f5f7) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body :where(
      nav,
      header,
      footer,
      aside,
      [class*="sidebar"],
      [class*="rail"],
      [class*="toolbar"],
      [class*="topbar"],
      [class*="navbar"],
      [class*="ribbon"],
      [class*="header"],
      [class*="footer"],
      [class*="status"],
      [class*="inspector"],
      [class*="timeline"],
      [class*="panel"],
      [class*="workbench"],
      [class*="shell"],
      [class*="workspace"],
      [class*="control"],
      [class*="menu"],
      [class*="dialog"],
      [class*="modal"],
      [class*="drawer"],
      [class*="settings"],
      [class*="composer"],
      [class*="search"],
      [class*="filter"],
      [class*="pagination"],
      [class*="calendar"],
      [class*="agenda"],
      [class*="view-switcher"],
      [class*="time-slot"],
      [class*="day-cell"],
      [class*="layout"],
      [class*="bar"],
      [class*="stage"],
      [class*="preview"],
      [class*="popover"],
      [class*="gallery"],
      [class*="section"],
      [class*="editor"]
    ) {
      border-color: var(--theme-lock-ui-border, var(--line, rgba(242, 245, 247, 0.16))) !important;
    }

    body :where(
      nav,
      header,
      footer,
      aside,
      [class*="sidebar"],
      [class*="rail"],
      [class*="toolbar"],
      [class*="topbar"],
      [class*="navbar"],
      [class*="ribbon"],
      [class*="header"],
      [class*="footer"],
      [class*="status"],
      [class*="inspector"],
      [class*="timeline"],
      [class*="workspace"],
      [class*="control"],
      [class*="menu"],
      [class*="dialog"],
      [class*="modal"],
      [class*="drawer"],
      [class*="settings"],
      [class*="composer"],
      [class*="search"],
      [class*="filter"],
      [class*="pagination"],
      [class*="calendar"],
      [class*="agenda"],
      [class*="view-switcher"],
      [class*="time-slot"],
      [class*="day-cell"],
      [class*="layout"],
      [class*="bar"],
      [class*="stage"],
      [class*="preview"],
      [class*="popover"],
      [class*="gallery"],
      [class*="section"],
      [class*="editor"]
    ) {
      background-color: var(--theme-surface, var(--panel, #030506)) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body :where(
      [class*="panel"],
      [class*="workbench"],
      [class*="shell"],
      [class*="card"],
      [class*="list"],
      [class*="table"],
      [class*="form"],
      [class*="layout"],
      [class*="bar"],
      [class*="stage"],
      [class*="preview"],
      [class*="popover"],
      [class*="gallery"],
      [class*="section"],
      [class*="editor"]
    ) {
      background-color: var(--theme-surface-strong, var(--panel-strong, #070a0c)) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body :where(
      nav,
      header,
      footer,
      aside,
      [class*="sidebar"],
      [class*="rail"],
      [class*="toolbar"],
      [class*="topbar"],
      [class*="navbar"],
      [class*="ribbon"],
      [class*="header"],
      [class*="footer"],
      [class*="status"],
      [class*="inspector"],
      [class*="timeline"],
      [class*="panel"],
      [class*="workbench"],
      [class*="shell"],
      [class*="workspace"],
      [class*="control"],
      [class*="menu"],
      [class*="dialog"],
      [class*="modal"],
      [class*="drawer"],
      [class*="settings"],
      [class*="composer"],
      [class*="search"],
      [class*="filter"],
      [class*="pagination"],
      [class*="calendar"],
      [class*="agenda"],
      [class*="view-switcher"],
      [class*="time-slot"],
      [class*="day-cell"],
      [class*="layout"],
      [class*="bar"],
      [class*="stage"],
      [class*="preview"],
      [class*="popover"],
      [class*="gallery"],
      [class*="section"],
      [class*="editor"]
    ) :where(h1, h2, h3, h4, h5, h6, p, span, strong, small, label, th, td) {
      color: var(--text, #f2f5f7) !important;
    }

    body :where(a) {
      color: var(--text, #dfe6eb) !important;
    }

    body :where(svg) {
      color: var(--text, #f2f5f7);
      stroke: currentColor;
    }

    body :where(svg [fill="currentColor"]) {
      fill: currentColor !important;
    }

    body :where(
      button[aria-pressed="true"],
      button[aria-selected="true"],
      [role="tab"][aria-selected="true"],
      [data-active="true"],
      .is-active,
      .active
    ) {
      border-color: var(--accent, #f2f5f7) !important;
    }

    /* Accent owns filled/selected controls; Appearance owns their labels. */
    body :where(
      [data-tronxvi-accent-button],
      button[aria-pressed="true"],
      button[aria-selected="true"],
      [role="tab"][aria-selected="true"],
      [role="option"][aria-selected="true"],
      [data-active="true"],
      [data-state="active"],
      .creation-rebuild__mode-option--active,
      .creation-rebuild__quality-option--active,
      .creation-rebuild__primary-button,
      .control-button--primary,
      .ads-workbench__topbar-button--primary,
      .ads-workbench__primary-button,
      .ads-workbench__cta-button
    ) {
      background-color: var(--accent, #f2f5f7) !important;
      border-color: var(--accent, #f2f5f7) !important;
      color: var(--accent-contrast, var(--theme-button-text, var(--appearance-text, var(--text, #010304)))) !important;
      -webkit-text-fill-color: var(--accent-contrast, var(--theme-button-text, var(--appearance-text, var(--text, #010304)))) !important;
    }

    /* User-authored pages, slides, media, and canvases keep their own content
       colors; only their surrounding workspace chrome is normalized here. */
    body :where(.page, .page-content, .slide-canvas, .editor-slide-canvas, canvas, img, video) {
      color: revert-layer;
    }

    /* Manifest owns these selectors, but their colors still come from the
       live TronXVI theme. This scoped layer runs after the generic safety net
       so generic embedded-tool defaults cannot repaint Manifest chrome. */
    body:has(.top-navbar) .top-navbar {
      background-color: var(--theme-surface-strong, var(--panel-strong, #070a0c)) !important;
      background-image: none !important;
      border-color: var(--line, rgba(242, 245, 247, 0.18)) !important;
      color: var(--accent, var(--text, #f2f5f7)) !important;
    }

    body:has(.top-navbar) .top-navbar__nav-item,
    body:has(.top-navbar) .top-navbar__nav-item:hover,
    body:has(.top-navbar) .top-navbar__nav-item:focus-visible,
    body:has(.top-navbar) .top-navbar__nav-item--active,
    body:has(.top-navbar) .top-navbar__nav-item .top-navbar__nav-text strong,
    body:has(.top-navbar) .top-navbar__nav-item:hover .top-navbar__nav-text strong,
    body:has(.top-navbar) .top-navbar__nav-item--active .top-navbar__nav-text strong {
      background-color: transparent !important;
      color: var(--accent, var(--text, #f2f5f7)) !important;
      -webkit-text-fill-color: var(--accent, var(--text, #f2f5f7)) !important;
    }

    body:has(.top-navbar) .top-navbar__nav-item--active::after {
      background: var(--accent, var(--text, #f2f5f7)) !important;
      box-shadow: none !important;
    }

    body:has(.creation-rebuild) .creation-rebuild,
    body:has(.creation-rebuild) .creation-rebuild__main,
    body:has(.creation-rebuild) .creation-rebuild__stage {
      background: var(--theme-page-bg, var(--bg, #010304)) !important;
      background-image: none !important;
      color: var(--text, #f2f5f7) !important;
    }

    body:has(.creation-rebuild) .creation-rebuild__canvas,
    body:has(.creation-rebuild) .creation-rebuild__sidebar,
    body:has(.creation-rebuild) .creation-rebuild__sidebar-scroll,
    body:has(.creation-rebuild) .creation-rebuild__section {
      background: var(--theme-surface-strong, var(--panel-strong, #070a0c)) !important;
      background-image: none !important;
      border-color: var(--line, rgba(242, 245, 247, 0.18)) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body:has(.creation-rebuild) .creation-rebuild__mode-toggle,
    body:has(.creation-rebuild) .creation-rebuild__quality-row {
      background: var(--theme-surface-soft, var(--panel-soft, #090c0e)) !important;
      background-image: none !important;
      border-color: var(--line, rgba(242, 245, 247, 0.18)) !important;
    }

    body:has(.creation-rebuild) .creation-rebuild__mode-option,
    body:has(.creation-rebuild) .creation-rebuild__quality-option {
      background: transparent !important;
      color: var(--accent, var(--text, #f2f5f7)) !important;
      border-color: transparent !important;
    }

    body:has(.creation-rebuild) .creation-rebuild__mode-option--active,
    body:has(.creation-rebuild) .creation-rebuild__quality-option--active {
      background: var(--accent, #f2f5f7) !important;
      border-color: var(--accent, #f2f5f7) !important;
      color: var(--accent-contrast, var(--theme-button-text, var(--text, #010304))) !important;
      -webkit-text-fill-color: var(--accent-contrast, var(--theme-button-text, var(--text, #010304))) !important;
    }

    /* Car Finder ships a large standalone stylesheet with its own historical
       black/white palette. Keep its layout and imagery intact, but route all
       workspace chrome through the live Infinity Appearance/Accent tokens. */
    body:has(.site-nav) {
      background: var(--theme-page-bg, var(--bg, #010304)) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body:has(.site-nav) .page-shell,
    body:has(.site-nav) .page-content,
    body:has(.site-nav) .site-workspace,
    body:has(.site-nav) .results-panel,
    body:has(.site-nav) .statistics-page,
    body:has(.site-nav) .statistics-content {
      background: var(--theme-page-bg, var(--bg, #010304)) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body:has(.site-nav) .site-nav,
    body:has(.site-nav) .statistics-nav,
    body:has(.site-nav) .filter-sidebar,
    body:has(.site-nav) .statistics-sidebar {
      background: var(--theme-surface, var(--surface, #030506)) !important;
      border-color: var(--line, rgba(242, 245, 247, 0.16)) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body:has(.site-nav) .search-card,
    body:has(.site-nav) .listing-card,
    body:has(.site-nav) .brands-filters,
    body:has(.site-nav) .brands-stats > div,
    body:has(.site-nav) .brand-chart,
    body:has(.site-nav) .financial-table-section,
    body:has(.site-nav) .financial-unavailable,
    body:has(.site-nav) .brand-price-chart,
    body:has(.site-nav) .statistics-metrics > div {
      background: var(--theme-surface-strong, var(--surface-raised, #070a0c)) !important;
      border-color: var(--line, rgba(242, 245, 247, 0.16)) !important;
      color: var(--text, #f2f5f7) !important;
      box-shadow: none;
    }

    body:has(.site-nav) .quick-search,
    body:has(.site-nav) .select-button,
    body:has(.site-nav) .secondary-filter,
    body:has(.site-nav) .clear-button,
    body:has(.site-nav) .sort-button,
    body:has(.site-nav) .currency-selector select,
    body:has(.site-nav) .select-menu,
    body:has(.site-nav) .secondary-menu,
    body:has(.site-nav) .sort-menu {
      background: var(--theme-surface-soft, var(--panel-soft, #090c0e)) !important;
      border-color: var(--line, rgba(242, 245, 247, 0.16)) !important;
      color: var(--text, #f2f5f7) !important;
    }

    body:has(.site-nav) .ask-button,
    body:has(.site-nav) .show-button,
    body:has(.site-nav) .nav-cta {
      background: var(--accent, #f2f5f7) !important;
      border-color: var(--accent, #f2f5f7) !important;
      color: var(--theme-button-text, var(--accent-contrast, #010304)) !important;
      -webkit-text-fill-color: var(--theme-button-text, var(--accent-contrast, #010304)) !important;
    }

    body:has(.site-nav) .quick-search.active,
    body:has(.site-nav) .select-button.open,
    body:has(.site-nav) .secondary-filter.open,
    body:has(.site-nav) .sort-button.open,
    body:has(.site-nav) .category.selected,
    body:has(.site-nav) .category:hover,
    body:has(.site-nav) .category:focus-visible {
      background: var(--accent, #f2f5f7) !important;
      border-color: var(--accent, #f2f5f7) !important;
      color: var(--theme-button-text, var(--accent-contrast, #010304)) !important;
      -webkit-text-fill-color: var(--theme-button-text, var(--accent-contrast, #010304)) !important;
    }

    body:has(.site-nav) :where(h1, h2, h3, h4, h5, h6, p, label, dt, dd, strong, small, span, th, td),
    body:has(.site-nav) .brand-mark,
    body:has(.site-nav) .nav-links a,
    body:has(.site-nav) .listing-link {
      color: var(--text, #f2f5f7) !important;
      -webkit-text-fill-color: var(--text, #f2f5f7);
    }

    body:has(.site-nav) a:not(.nav-cta),
    body:has(.site-nav) .nav-links a:hover,
    body:has(.site-nav) .nav-links a:focus-visible,
    body:has(.site-nav) .listing-link:hover,
    body:has(.site-nav) .listing-link:focus-visible {
      color: var(--accent, #f2f5f7) !important;
      -webkit-text-fill-color: var(--accent, #f2f5f7);
    }

    body:has(.site-nav) :where(input, select, textarea) {
      background: var(--theme-surface-soft, var(--panel-soft, #090c0e)) !important;
      border-color: var(--line-strong, rgba(242, 245, 247, 0.3)) !important;
      color: var(--text, #f2f5f7) !important;
      caret-color: var(--accent, #f2f5f7);
    }

    body:has(.site-nav) :where(input, textarea)::placeholder {
      color: var(--text-placeholder, var(--theme-lock-muted, #aab2ba)) !important;
    }

    body:has(.site-nav) :where(button, a):focus-visible {
      outline-color: var(--accent, #f2f5f7) !important;
    }

    body:has(.site-nav) :where(.listing-card, .brand-chart-row, .brand-average-row):hover {
      background: var(--theme-surface-soft, var(--panel-soft, #090c0e)) !important;
    }

    body:has(.site-nav) :where(.brand-price-chart-grid, .chart-grid-line) {
      stroke: var(--line, rgba(242, 245, 247, 0.16)) !important;
    }

    body:has(.site-nav) :where(.brand-price-chart-line, .chart-line, .brand-bar-fill, .brand-average-fill) {
      stroke: var(--accent, #f2f5f7) !important;
      background: var(--accent, #f2f5f7) !important;
    }

    body:has(.site-nav) :where(.brand-price-chart-point, .chart-point) {
      fill: var(--accent, #f2f5f7) !important;
      stroke: var(--theme-button-text, var(--accent-contrast, #010304)) !important;
    }

    /* Genesis syntax highlighting is part of its tool chrome, so it follows
       the selected Appearance/Accent instead of retaining a fixed palette. */
    body:has(.workspace-sidebar) .code-editor__highlight-layer .code-token--keyword,
    body:has(.workspace-sidebar) .code-editor__highlight-layer .code-token--number,
    body:has(.workspace-sidebar) .code-editor__highlight-layer .code-token--operator,
    body:has(.workspace-sidebar) .code-editor__highlight-layer .code-token--punctuation {
      color: var(--accent, #f2f5f7) !important;
    }

    body:has(.workspace-sidebar) .code-editor__highlight-layer .code-token--string,
    body:has(.workspace-sidebar) .code-editor__highlight-layer .code-token--plain {
      color: color-mix(in srgb, var(--text, #f2f5f7) 78%, var(--accent, #f2f5f7)) !important;
    }

    body:has(.workspace-sidebar) .code-editor__highlight-layer .code-token--comment {
      color: var(--text-muted, var(--theme-lock-muted, #aab2ba)) !important;
    }
  `;

  function ensureThemeSafetyNet() {
    if (document.getElementById("tronxvi-tool-theme-safety-net")) return;
    const style = document.createElement("style");
    style.id = "tronxvi-tool-theme-safety-net";
    style.textContent = themeSafetyNetCss;
    (document.head || document.documentElement).appendChild(style);
  }

  // These aliases keep older workspace selectors compatible while making the
  // repository theme tokens the only values that can change at runtime.
  const aliases = {
    "--tronxvi-black": "var(--theme-page-bg, #010304)",
    "--tronxvi-black-soft": "var(--theme-surface-strong, #070a0c)",
    "--tronxvi-rail": "var(--theme-surface, #030506)",
    "--tronxvi-white": "var(--text, #f2f5f7)",
    "--tronxvi-secondary": "var(--theme-lock-text, var(--accent, #aab2ba))",
    "--tronxvi-line": "var(--line, rgba(242, 245, 247, 0.16))",
    "--orange": "var(--accent, #f2f5f7)",
    "--orange-dark": "var(--accent-strong, #ffffff)",
    "--orange-soft": "var(--theme-surface-soft, #030506)",
    "--green": "var(--accent, #f2f5f7)",
    "--deep": "var(--text, #f2f5f7)",
    "--pale": "var(--theme-surface-soft, #030506)",
    "--canva-black": "var(--theme-page-bg, #010304)",
    "--canva-black-soft": "var(--theme-surface-strong, #070a0c)",
    "--canva-white": "var(--theme-surface, #030506)",
    "--canva-white-soft": "var(--theme-lock-text, var(--accent, #aab2ba))",
    "--canva-gold": "var(--accent, #f2f5f7)",
    "--canva-gold-bright": "var(--theme-lock-text, var(--accent, #ffffff))",
    "--canva-gold-dark": "var(--theme-lock-text, var(--accent, #dfe6eb))",
    "--canva-line": "var(--line, rgba(242, 245, 247, 0.16))",
    "--ppt-titlebar-bg": "var(--appearance-header-top, var(--theme-surface-strong, #070a0c))",
    "--ppt-tabbar-bg": "var(--theme-surface-strong, #070a0c)",
    "--ppt-ribbon-bg": "var(--theme-surface, #030506)",
    "--ppt-rail-bg": "var(--theme-surface, #030506)",
    "--ppt-main-bg": "var(--theme-page-bg, #010304)",
    "--ppt-hover-bg": "var(--theme-surface-soft, #070a0c)",
    "--ppt-workspace-left": "var(--theme-surface, #030506)",
    "--ppt-workspace-center": "var(--theme-surface-strong, #070a0c)",
    "--ppt-workspace-right": "var(--theme-surface, #030506)",
    "--ppt-notes-bg": "var(--theme-surface-strong, #070a0c)",
    "--ppt-status-bg": "var(--theme-surface, #030506)",
    "--ppt-text": "var(--text, #f2f5f7)",
    "--ppt-secondary": "var(--theme-lock-text, var(--accent, #aab2ba))",
    "--ppt-divider": "var(--line, rgba(242, 245, 247, 0.16))",
    "--ppt-accent": "var(--accent, #f2f5f7)",
    "--ppt-accent-hover": "var(--theme-lock-text, var(--accent, #ffffff))",
    "--word-blue": "var(--accent, #f2f5f7)",
    "--word-blue-hover": "var(--theme-lock-text, var(--accent, #ffffff))",
    "--word-main-surface": "var(--theme-page-bg, #010304)",
    "--word-white": "var(--theme-surface-strong, #070a0c)",
    "--word-text": "var(--text, #f2f5f7)",
    "--word-muted-text": "var(--theme-lock-text, var(--accent, #aab2ba))",
    "--word-divider": "var(--line, rgba(242, 245, 247, 0.16))",
    "--word-control-border": "var(--line-strong, rgba(242, 245, 247, 0.32))",
    "--word-file-blue": "var(--theme-lock-text, var(--accent, #dfe6eb))",
    "--word-rail": "var(--theme-surface, #030506)",
    "--word-template-border": "var(--line, rgba(242, 245, 247, 0.16))",
    "--word-template-background": "var(--theme-surface-strong, #070a0c)",
    "--tm-bg-page": "var(--theme-page-bg, #010304)",
    "--tm-bg-sidebar": "var(--theme-surface, #030506)",
    "--tm-bg-panel": "var(--theme-surface-strong, #070a0c)",
    "--tm-bg-panel-soft": "var(--theme-surface-soft, #090c0e)",
    "--tm-bg-canvas": "var(--theme-page-bg, #000000)",
    "--tm-bg-control": "var(--theme-surface, #030506)",
    "--tm-bg-control-hover": "var(--theme-surface-soft, #070a0c)",
    "--tm-text-main": "var(--text, #f2f5f7)",
    "--tm-text-muted": "var(--theme-lock-muted, var(--text-muted, var(--muted, #aab2ba)))",
    "--tm-text-dim": "var(--theme-lock-muted, var(--text-muted, var(--muted, #797979)))",
    "--tm-text-inverse": "var(--accent-contrast, var(--theme-button-text, var(--appearance-text, var(--theme-page-bg, #010304))))",
    "--tm-accent-primary": "var(--accent, #f2f5f7)",
    "--tm-accent-secondary": "var(--theme-lock-text, var(--accent, #dfe6eb))",
    "--tm-accent-hot": "var(--accent-strong, var(--accent, #ffffff))",
    "--tm-border-soft": "var(--line, rgba(242, 245, 247, 0.1))",
    "--tm-border-medium": "var(--line, rgba(242, 245, 247, 0.18))",
    "--tm-border-strong": "var(--line-strong, rgba(242, 245, 247, 0.3))",
    "--tm-logo-gold": "var(--accent, #f2f5f7)",
    "--tm-logo-gold-bright": "var(--theme-lock-text, var(--accent, #ffffff))",
    "--tm-logo-gold-soft": "var(--theme-lock-text, var(--accent, #aab2ba))",
    "--tm-brand-gradient": "var(--accent-gradient, linear-gradient(135deg, #f2f5f7, #ffffff))",
    "--tm-brand-gradient-strong": "var(--accent-gradient, linear-gradient(135deg, #ffffff, #f2f5f7))",
  };

  function applyTheme(message) {
    if (!message || message.type !== messageType || !message.variables) return;

    ensureThemeSafetyNet();

    Object.entries(message.variables).forEach(([name, value]) => {
      if (name.startsWith("--") && typeof value === "string") {
        root.style.setProperty(name, value);
      }
    });

    Object.entries(aliases).forEach(([name, value]) => root.style.setProperty(name, value));
    root.dataset.appearance = message.appearance || "grey";
    root.dataset.theme = message.theme || "white";
    root.dataset.rainbowAppearance = message.appearance === "rainbow" ? "true" : "false";
    root.dataset.rainbow = message.theme === "rainbow" ? "true" : "false";
    root.dataset.tronxviAppearance = message.appearance || "grey";
    root.dataset.tronxviTheme = message.theme || "white";
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    applyTheme(event.data);
  });

  if (window.parent !== window) {
    window.parent.postMessage({ type: "tronxvi:tool-theme-ready" }, window.location.origin);
  }
})();
