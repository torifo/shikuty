import { PREFECTURES } from "./prefectures.ts";
import { REGIONS } from "./regions.ts";
import { startPuzzle, type PuzzleOptions, type Difficulty } from "./engine.ts";

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
        <button class="mode-card" id="mode-japan">
          <div class="mode-icon">🗾</div>
          <div class="mode-title">全国モード</div>
          <div class="mode-desc">47都道府県を日本地図に配置</div>
          <div class="mode-pieces">47ピース</div>
        </button>
        <button class="mode-card" id="mode-region">
          <div class="mode-icon">🏔️</div>
          <div class="mode-title">地方モード</div>
          <div class="mode-desc">地方内の市区町村を配置</div>
          <div class="mode-pieces">95〜355ピース</div>
        </button>
        <button class="mode-card" id="mode-pref">
          <div class="mode-icon">📍</div>
          <div class="mode-title">県内モード</div>
          <div class="mode-desc">都道府県内の市区町村を配置</div>
          <div class="mode-pieces">10〜194ピース</div>
        </button>
      </div>
    </div>
  `;

  renderDifficultyToggle(app);

  app.querySelector("#mode-japan")!.addEventListener("click", () => {
    launchPuzzle(app, { mode: "japan" });
  });
  app.querySelector("#mode-region")!.addEventListener("click", () => {
    showRegionSelect(app);
  });
  app.querySelector("#mode-pref")!.addEventListener("click", () => {
    showPrefectureSelect(app);
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

function showRegionSelect(app: HTMLDivElement): void {
  app.innerHTML = `
    <div class="header">
      <button class="back-btn" id="back-btn">← 戻る</button>
      <h1>市区町村パズル</h1>
      <div class="difficulty-toggle" id="diff-toggle"></div>
    </div>
    <div class="select-screen">
      <h2>地方をえらぶ</h2>
      <div class="region-grid"></div>
    </div>
  `;

  renderDifficultyToggle(app);
  app.querySelector("#back-btn")!.addEventListener("click", () => showModeSelect(app));

  const grid = app.querySelector(".region-grid")!;
  for (const region of REGIONS) {
    const btn = document.createElement("button");
    btn.className = "region-btn";
    btn.innerHTML = `<span class="region-name">${region.name}</span>`;
    btn.addEventListener("click", () => {
      launchPuzzle(app, {
        mode: "region",
        name: region.name,
        regionPrefCodes: region.prefCodes,
      });
    });
    grid.appendChild(btn);
  }
}

// --- 都道府県選択画面 ---

function showPrefectureSelect(app: HTMLDivElement): void {
  app.innerHTML = `
    <div class="header">
      <button class="back-btn" id="back-btn">← 戻る</button>
      <h1>市区町村パズル</h1>
      <div class="difficulty-toggle" id="diff-toggle"></div>
    </div>
    <div class="select-screen">
      <h2>都道府県をえらぶ</h2>
      <div class="prefecture-grid"></div>
    </div>
  `;

  renderDifficultyToggle(app);
  app.querySelector("#back-btn")!.addEventListener("click", () => showModeSelect(app));

  const grid = app.querySelector(".prefecture-grid")!;
  for (const pref of PREFECTURES) {
    const btn = document.createElement("button");
    btn.className = "prefecture-btn";
    btn.textContent = pref.name;
    btn.addEventListener("click", () => {
      launchPuzzle(app, {
        mode: "prefecture",
        code: pref.code,
        name: pref.name,
      });
    });
    grid.appendChild(btn);
  }
}

// --- Launch ---

function launchPuzzle(app: HTMLDivElement, opts: PuzzleOptions): void {
  startPuzzle(app, opts, currentDifficulty);
}
