import { PREFECTURES } from "./prefectures.ts";
import { REGIONS } from "./regions.ts";
import { startPuzzle, startPreview, type PuzzleOptions, type Difficulty } from "./engine.ts";
import { renderPrefectureMap, renderRegionMap } from "./map-selector.ts";

/** 現在の難易度（デフォルトはかんたん） */
let currentDifficulty: Difficulty = "easy";

// --- モード選択画面 ---

export function showModeSelect(app: HTMLDivElement): void {
  app.innerHTML = `
    <div class="header">
      <h1>市区町村パズル</h1>
      <div class="difficulty-toggle" id="diff-toggle"></div>
    </div>
    <div class="select-screen">
      <h2>モードをえらぶ</h2>
      <div class="mode-cards">
        <div class="mode-card-wrap">
          <button class="mode-card" id="mode-japan">
            <div class="mode-icon">🗾</div>
            <div class="mode-title">全国モード</div>
            <div class="mode-desc">47都道府県を日本地図に配置</div>
            <div class="mode-pieces">47ピース</div>
          </button>
          <button class="preview-link" id="preview-japan">完成形を見る</button>
        </div>
        <div class="mode-card-wrap">
          <button class="mode-card" id="mode-region">
            <div class="mode-icon">🏔️</div>
            <div class="mode-title">地方モード</div>
            <div class="mode-desc">地方内の市区町村を配置</div>
            <div class="mode-pieces">95〜355ピース</div>
          </button>
          <button class="preview-link" id="preview-region">完成形を見る</button>
        </div>
        <div class="mode-card-wrap">
          <button class="mode-card" id="mode-pref">
            <div class="mode-icon">📍</div>
            <div class="mode-title">県内モード</div>
            <div class="mode-desc">都道府県内の市区町村を配置</div>
            <div class="mode-pieces">10〜194ピース</div>
          </button>
          <button class="preview-link" id="preview-pref">完成形を見る</button>
        </div>
      </div>
    </div>
  `;

  renderDifficultyToggle(app);

  app.querySelector("#mode-japan")!.addEventListener("click", () => {
    launchPuzzle(app, { mode: "japan" }, () => showModeSelect(app));
  });
  app.querySelector("#mode-region")!.addEventListener("click", () => {
    showRegionSelect(app);
  });
  app.querySelector("#mode-pref")!.addEventListener("click", () => {
    showPrefectureSelect(app);
  });

  // 完成形プレビューボタン
  app.querySelector("#preview-japan")!.addEventListener("click", () => {
    showPreviewWarning(app, () => startPreview(app, { mode: "japan" }, () => showModeSelect(app)));
  });
  app.querySelector("#preview-region")!.addEventListener("click", () => {
    showPreviewWarning(app, () => showRegionSelect(app, true));
  });
  app.querySelector("#preview-pref")!.addEventListener("click", () => {
    showPreviewWarning(app, () => showPrefectureSelect(app, true));
  });
}

// --- 難易度トグル ---

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "かんたん" },
  { key: "normal", label: "ふつう" },
  { key: "hard", label: "むずかしい" },
];

function renderDifficultyToggle(app: HTMLDivElement): void {
  const container = app.querySelector("#diff-toggle")!;
  container.innerHTML = "";
  for (const d of DIFFICULTIES) {
    const btn = document.createElement("button");
    btn.className = "diff-btn" + (d.key === currentDifficulty ? " active" : "");
    btn.textContent = d.label;
    btn.addEventListener("click", () => {
      currentDifficulty = d.key;
      renderDifficultyToggle(app);
    });
    container.appendChild(btn);
  }
}

// --- 地方選択画面 ---

function showRegionSelect(app: HTMLDivElement, isPreview = false): void {
  const pageTitle = isPreview ? "完成形を見る — 地方をえらぶ" : "地方をえらぶ";
  app.innerHTML = `
    <div class="header">
      <button class="back-btn" id="back-btn">← 戻る</button>
      <h1>市区町村パズル</h1>
      ${isPreview ? '<span class="diff-label preview-badge">完成形</span>' : '<div class="difficulty-toggle" id="diff-toggle"></div>'}
    </div>
    <div class="select-screen" id="select-screen">
      <div class="select-screen-top">
        <h2>${pageTitle}</h2>
        <div class="view-tabs">
          <button class="view-tab active" id="tab-map">地図</button>
          <button class="view-tab" id="tab-list">一覧</button>
        </div>
      </div>
      <div class="view-content" id="view-map-content"></div>
      <div class="view-content" id="view-list-content" style="display:none">
        <div class="region-grid"></div>
      </div>
    </div>
  `;

  if (!isPreview) renderDifficultyToggle(app);
  app.querySelector("#back-btn")!.addEventListener("click", () => showModeSelect(app));

  const selectScreen = app.querySelector<HTMLElement>("#select-screen")!;
  const tabMap = app.querySelector<HTMLButtonElement>("#tab-map")!;
  const tabList = app.querySelector<HTMLButtonElement>("#tab-list")!;
  const mapContent = app.querySelector<HTMLElement>("#view-map-content")!;
  const listContent = app.querySelector<HTMLElement>("#view-list-content")!;

  let cleanupMap: (() => void) | null = null;

  function selectRegion(regionName: string) {
    const region = REGIONS.find((r) => r.name === regionName)!;
    const opts: PuzzleOptions = { mode: "region", name: region.name, regionPrefCodes: region.prefCodes };
    if (isPreview) {
      startPreview(app, opts, () => showRegionSelect(app, true));
    } else {
      launchPuzzle(app, opts, () => showRegionSelect(app));
    }
  }

  function showMapTab() {
    tabMap.classList.add("active");
    tabList.classList.remove("active");
    mapContent.style.display = "";
    listContent.style.display = "none";
    selectScreen.classList.add("map-mode");
    if (!cleanupMap) {
      cleanupMap = renderRegionMap(mapContent, selectRegion);
    }
  }

  function showListTab() {
    tabMap.classList.remove("active");
    tabList.classList.add("active");
    mapContent.style.display = "none";
    listContent.style.display = "";
    selectScreen.classList.remove("map-mode");
  }

  tabMap.addEventListener("click", showMapTab);
  tabList.addEventListener("click", showListTab);

  // 地方一覧グリッド構築
  const grid = app.querySelector(".region-grid")!;
  for (const region of REGIONS) {
    const btn = document.createElement("button");
    btn.className = "region-btn";
    btn.innerHTML = `<span class="region-name">${region.name}</span>`;
    btn.addEventListener("click", () => selectRegion(region.name));
    grid.appendChild(btn);
  }

  showMapTab();
}

// --- 都道府県選択画面 ---

function showPrefectureSelect(app: HTMLDivElement, isPreview = false): void {
  const pageTitle = isPreview ? "完成形を見る — 都道府県をえらぶ" : "都道府県をえらぶ";
  app.innerHTML = `
    <div class="header">
      <button class="back-btn" id="back-btn">← 戻る</button>
      <h1>市区町村パズル</h1>
      ${isPreview ? '<span class="diff-label preview-badge">完成形</span>' : '<div class="difficulty-toggle" id="diff-toggle"></div>'}
    </div>
    <div class="select-screen" id="select-screen">
      <div class="select-screen-top">
        <h2>${pageTitle}</h2>
        <div class="view-tabs">
          <button class="view-tab active" id="tab-map">地図</button>
          <button class="view-tab" id="tab-list">一覧</button>
        </div>
      </div>
      <div class="view-content" id="view-map-content"></div>
      <div class="view-content" id="view-list-content" style="display:none">
        <div class="prefecture-grid"></div>
      </div>
    </div>
  `;

  if (!isPreview) renderDifficultyToggle(app);
  app.querySelector("#back-btn")!.addEventListener("click", () => showModeSelect(app));

  const selectScreen = app.querySelector<HTMLElement>("#select-screen")!;
  const tabMap = app.querySelector<HTMLButtonElement>("#tab-map")!;
  const tabList = app.querySelector<HTMLButtonElement>("#tab-list")!;
  const mapContent = app.querySelector<HTMLElement>("#view-map-content")!;
  const listContent = app.querySelector<HTMLElement>("#view-list-content")!;

  let cleanupMap: (() => void) | null = null;

  function selectPref(code: string, name: string) {
    const opts: PuzzleOptions = { mode: "prefecture", code, name };
    if (isPreview) {
      startPreview(app, opts, () => showPrefectureSelect(app, true));
    } else {
      launchPuzzle(app, opts, () => showPrefectureSelect(app));
    }
  }

  function showMapTab() {
    tabMap.classList.add("active");
    tabList.classList.remove("active");
    mapContent.style.display = "";
    listContent.style.display = "none";
    selectScreen.classList.add("map-mode");
    if (!cleanupMap) {
      cleanupMap = renderPrefectureMap(mapContent, selectPref);
    }
  }

  function showListTab() {
    tabMap.classList.remove("active");
    tabList.classList.add("active");
    mapContent.style.display = "none";
    listContent.style.display = "";
    selectScreen.classList.remove("map-mode");
  }

  tabMap.addEventListener("click", showMapTab);
  tabList.addEventListener("click", showListTab);

  // 都道府県グリッド構築
  const grid = app.querySelector(".prefecture-grid")!;
  for (const pref of PREFECTURES) {
    const btn = document.createElement("button");
    btn.className = "prefecture-btn";
    btn.textContent = pref.name;
    btn.addEventListener("click", () => selectPref(pref.code, pref.name));
    grid.appendChild(btn);
  }

  showMapTab();
}

// --- Launch ---

function launchPuzzle(app: HTMLDivElement, opts: PuzzleOptions, backFn?: () => void): void {
  startPuzzle(app, opts, currentDifficulty, backFn);
}

// --- 完成形プレビュー 注意アナウンス ---

function showPreviewWarning(app: HTMLDivElement, onConfirm: () => void): void {
  const overlay = document.createElement("div");
  overlay.className = "preview-warning-overlay";
  overlay.innerHTML = `
    <div class="preview-warning-box">
      <div class="preview-warning-icon">⚠️</div>
      <h3>完成形を見ますか？</h3>
      <p>完成形を見るとパズルの答えがわかってしまい、<br>ゲームの楽しさが半減するかもしれません。</p>
      <div class="preview-warning-btns">
        <button class="btn-primary" id="warn-ok">それでも見る</button>
        <button class="back-btn" id="warn-cancel">やめる</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector("#warn-ok")!.addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });
  overlay.querySelector("#warn-cancel")!.addEventListener("click", () => overlay.remove());
}
