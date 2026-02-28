// Gift Finder (vanilla JS)
// - Search runs ONLY when Search button is clicked
// - Filters can be expanded/collapsed
// - Pagination (default 100 per page)
// - Clickable cards (no Open button), no tags/id shown

const DATA_URL = "./data.json";

const el = {
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  clearBtn: document.getElementById("clearBtn"),

  toggleFiltersBtn: document.getElementById("toggleFiltersBtn"),
  toggleIcon: document.getElementById("toggleIcon"),
  filtersBody: document.getElementById("filtersBody"),

  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),

  typeFilters: document.getElementById("typeFilters"),
  platformFilters: document.getElementById("platformFilters"),

  status: document.getElementById("status"),
  resultsHeader: document.getElementById("resultsHeader"),
  results: document.getElementById("results"),
  emptyState: document.getElementById("emptyState"),

  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  pageInfo: document.getElementById("pageInfo"),
  gotoPageInput: document.getElementById("gotoPageInput"),
  gotoBtn: document.getElementById("gotoBtn"),

  totalCount: document.getElementById("totalCount"),
  matchCount: document.getElementById("matchCount"),
};

let allItems = [];
let hasSearchedOnce = false;

const state = {
  query: "",
  types: new Set(),
  platforms: new Set(),
  pageSize: 100,
  currentPage: 1,
  lastMatches: [], // full filtered results from last search
};

function normalizeStr(v) {
  return String(v ?? "").trim().toLowerCase();
}
function normalizeType(v) {
  return String(v ?? "").trim();
}
function splitTags(tags) {
  return normalizeStr(tags)
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

function buildSearchText(item) {
  // include Title, Tags, type, platform in searchable text (even if not displayed)
  const title = normalizeStr(item.Title);
  const type = normalizeStr(item.type);
  const platform = normalizeStr(item.platform);
  const tags = splitTags(item.Tags).join(" ");
  return `${title} ${type} ${platform} ${tags}`.trim();
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function renderCheckboxList(container, values, groupName, onChange) {
  container.innerHTML = "";
  values.forEach(val => {
    const id = `${groupName}-${val}`.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
    const label = document.createElement("label");
    label.className = "check";
    label.htmlFor = id;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = id;
    input.value = val;

    input.addEventListener("change", () => {
      onChange(val, input.checked);
    });

    const span = document.createElement("span");
    span.textContent = val;

    const count = document.createElement("small");
    count.textContent = String(
      allItems.filter(it => {
        if (groupName === "type") return normalizeType(it.type) === val;
        if (groupName === "platform") return String(it.platform ?? "").trim() === val;
        return false;
      }).length
    );

    label.appendChild(input);
    label.appendChild(span);
    label.appendChild(count);
    container.appendChild(label);
  });
}

function setSelectedValues(container, selectedSet) {
  Array.from(container.querySelectorAll("input[type=checkbox]")).forEach(i => {
    i.checked = selectedSet.has(i.value);
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeHtmlAttr(str) {
  return escapeHtml(str).replaceAll("\n", " ");
}

function cardTemplate(item) {
  const title = item.Title ?? "Untitled";
  const type = normalizeType(item.type) || "Unknown type";
  const platform = String(item.platform ?? "").trim() || "Unknown platform";
  const thumb = item.thumnail || item.thumbnail || "";
  const link = item.link || "#";

  // square placeholder
  const safeThumb = thumb
    ? thumb
    : "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Crect width='100%25' height='100%25' fill='%23121a26'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%239fb0c5' font-family='Arial' font-size='20'%3ENo Image%3C/text%3E%3C/svg%3E";

  return `
    <article class="card">
      <a class="card-link" href="${escapeHtmlAttr(link)}" target="_blank" rel="noopener noreferrer">
        <div class="thumb">
          <img loading="lazy" src="${escapeHtmlAttr(safeThumb)}" alt="${escapeHtmlAttr(title)}" />
        </div>
        <div class="card__body">
          <h3 class="title">${escapeHtml(title)}</h3>
          <div class="badges">
            <span class="badge badge--accent">${escapeHtml(platform)}</span>
            <span class="badge">${escapeHtml(type)}</span>
          </div>
        </div>
      </a>
    </article>
  `;
}

function setStatus(msg) {
  el.status.textContent = msg || "";
}

function showStartState() {
  el.results.innerHTML = "";
  el.resultsHeader.classList.add("hidden");
  el.emptyState.classList.remove("hidden");
  el.matchCount.textContent = "0";
  setStatus("");
}

function applySearchAndFilters() {
  hasSearchedOnce = true;

  const q = normalizeStr(state.query);

  const matches = allItems.filter(item => {
    const type = normalizeType(item.type);
    const platform = String(item.platform ?? "").trim();

    if (state.types.size > 0 && !state.types.has(type)) return false;
    if (state.platforms.size > 0 && !state.platforms.has(platform)) return false;

    if (q) {
      if (!item.__searchText.includes(q)) return false;
    }
    return true;
  });

  state.lastMatches = matches;
  state.currentPage = 1;

  el.matchCount.textContent = String(matches.length);

  const parts = [];
  if (state.query.trim()) parts.push(`"${state.query.trim()}"`);
  if (state.types.size) parts.push(`Types: ${Array.from(state.types).join(", ")}`);
  if (state.platforms.size) parts.push(`Platforms: ${Array.from(state.platforms).join(", ")}`);

  setStatus(parts.length ? `Results for ${parts.join(" • ")}` : "Results");

  renderPage();
}

function renderPage() {
  const matches = state.lastMatches || [];
  const pageSize = state.pageSize;

  const totalPages = Math.max(1, Math.ceil(matches.length / pageSize));
  state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);

  const start = (state.currentPage - 1) * pageSize;
  const pageItems = matches.slice(start, start + pageSize);

  el.pageInfo.textContent = `Page ${state.currentPage} / ${totalPages}`;
  el.prevBtn.disabled = state.currentPage <= 1;
  el.nextBtn.disabled = state.currentPage >= totalPages;

  // show header only after first search
  el.resultsHeader.classList.toggle("hidden", !hasSearchedOnce);

  if (!hasSearchedOnce) return;

  if (matches.length === 0) {
    el.results.innerHTML = "";
    el.emptyState.classList.remove("hidden");
    el.emptyState.querySelector("h2").textContent = "No results";
    el.emptyState.querySelector("p").textContent = "Try different keywords or adjust filters, then click Search.";
    return;
  }

  el.emptyState.classList.add("hidden");
  el.results.innerHTML = pageItems.map(cardTemplate).join("");
}

function toggleFilters() {
  const isCollapsed = el.filtersBody.classList.toggle("collapsed");
  el.toggleFiltersBtn.setAttribute("aria-expanded", String(!isCollapsed));
  el.toggleIcon.textContent = isCollapsed ? "▸" : "▾";
}

function resetFilters() {
  state.types.clear();
  state.platforms.clear();
  setSelectedValues(el.typeFilters, state.types);
  setSelectedValues(el.platformFilters, state.platforms);

  // do NOT auto-run search; user asked search only on button click.
  setStatus("Filters reset. Click Search to apply.");
}

function clearAll() {
  el.searchInput.value = "";
  state.query = "";
  resetFilters();

  // reset results to start state
  hasSearchedOnce = false;
  state.lastMatches = [];
  state.currentPage = 1;
  showStartState();
}

function goToPage(n) {
  const matches = state.lastMatches || [];
  const totalPages = Math.max(1, Math.ceil(matches.length / state.pageSize));
  const page = Math.min(Math.max(1, n), totalPages);
  state.currentPage = page;
  renderPage();
}

async function loadData() {
  setStatus("Loading data.json...");
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${DATA_URL} (${res.status})`);
  const data = await res.json();

  allItems = (Array.isArray(data) ? data : []).map(item => {
    const normalized = {
      ...item,
      type: normalizeType(item.type),
      platform: String(item.platform ?? "").trim(),
    };
    normalized.__searchText = buildSearchText(normalized);
    return normalized;
  });

  el.totalCount.textContent = String(allItems.length);

  // Build filters
  const types = uniqSorted(allItems.map(i => normalizeType(i.type)));
  const platforms = uniqSorted(allItems.map(i => String(i.platform ?? "").trim()));

  renderCheckboxList(el.typeFilters, types, "type", (val, checked) => {
    checked ? state.types.add(val) : state.types.delete(val);
    setStatus("Filter changed. Click Search to apply.");
  });

  renderCheckboxList(el.platformFilters, platforms, "platform", (val, checked) => {
    checked ? state.platforms.add(val) : state.platforms.delete(val);
    setStatus("Filter changed. Click Search to apply.");
  });

  setStatus("");
  showStartState();
}

function wireEvents() {
  el.toggleFiltersBtn.addEventListener("click", toggleFilters);

  el.pageSizeSelect.addEventListener("change", () => {
    state.pageSize = Number(el.pageSizeSelect.value) || 100;
    setStatus("Per-page changed. Click Search to apply.");
  });

  el.searchBtn.addEventListener("click", () => {
    state.query = el.searchInput.value || "";
    applySearchAndFilters();
  });

  el.clearBtn.addEventListener("click", clearAll);

  el.resetFiltersBtn.addEventListener("click", resetFilters);

  el.prevBtn.addEventListener("click", () => {
    state.currentPage -= 1;
    renderPage();
  });

  el.nextBtn.addEventListener("click", () => {
    state.currentPage += 1;
    renderPage();
  });

  el.gotoBtn.addEventListener("click", () => {
    const n = Number(el.gotoPageInput.value);
    if (!Number.isFinite(n) || n <= 0) return;
    goToPage(n);
  });

  el.gotoPageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const n = Number(el.gotoPageInput.value);
      if (!Number.isFinite(n) || n <= 0) return;
      goToPage(n);
    }
  });
}

wireEvents();
loadData().catch(err => {
  console.error(err);
  setStatus(`Error: ${err.message}`);
});