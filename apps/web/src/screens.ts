import { PREFECTURES } from "./prefectures.ts";
import { REGIONS } from "./regions.ts";
import { startPuzzle, startPreview, type PuzzleOptions, type Difficulty } from "./engine.ts";

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
    <div class="select-screen">
      <h2>${pageTitle}</h2>
      <div class="region-grid"></div>
    </div>
  `;

  if (!isPreview) renderDifficultyToggle(app);
  app.querySelector("#back-btn")!.addEventListener("click", () => showModeSelect(app));

  const grid = app.querySelector(".region-grid")!;
  for (const region of REGIONS) {
    const btn = document.createElement("button");
    btn.className = "region-btn";
    btn.innerHTML = `<span class="region-name">${region.name}</span>`;
    const opts: PuzzleOptions = { mode: "region", name: region.name, regionPrefCodes: region.prefCodes };
    if (isPreview) {
      btn.addEventListener("click", () => startPreview(app, opts, () => showRegionSelect(app, true)));
    } else {
      btn.addEventListener("click", () => launchPuzzle(app, opts, () => showRegionSelect(app)));
    }
    grid.appendChild(btn);
  }
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
    <div class="select-screen">
      <h2>${pageTitle}</h2>
      <div class="prefecture-grid"></div>
    </div>
  `;

  if (!isPreview) renderDifficultyToggle(app);
  app.querySelector("#back-btn")!.addEventListener("click", () => showModeSelect(app));

  const grid = app.querySelector(".prefecture-grid")!;
  for (const pref of PREFECTURES) {
    const btn = document.createElement("button");
    btn.className = "prefecture-btn";
    btn.textContent = pref.name;
    const opts: PuzzleOptions = { mode: "prefecture", code: pref.code, name: pref.name };
    if (isPreview) {
      btn.addEventListener("click", () => startPreview(app, opts, () => showPrefectureSelect(app, true)));
    } else {
      btn.addEventListener("click", () => launchPuzzle(app, opts, () => showPrefectureSelect(app)));
    }
    grid.appendChild(btn);
  }
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
