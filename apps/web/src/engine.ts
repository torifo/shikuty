import * as d3 from "d3";
import { feature as topoFeature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { showModeSelect } from "./screens.ts";

// --- Types ---

type AnyProps = Record<string, unknown>;

interface PieceState {
  feature: Feature<Geometry, AnyProps>;
  ox: number;
  oy: number;
  placed: boolean;
  name: string;
}

export type Difficulty = "easy" | "normal" | "hard";

export interface PuzzleOptions {
  mode: "japan" | "region" | "prefecture";
  code?: string;
  name?: string;
  regionPrefCodes?: string[];
}

// --- Difficulty settings ---

interface DifficultyConfig {
  /** snap threshold as fraction of min(W,H) */
  snapFraction: number;
  /** show ghost outlines */
  showGhost: boolean;
  /** ghost opacity (0-1) */
  ghostOpacity: number;
  /** show name on hover */
  showTooltip: boolean;
  /** piece border width */
  strokeWidth: number;
  /** piece border color */
  strokeColor: string;
  /** show drag name bar on mobile */
  showDragNameBar: boolean;
  /** enable time-based hints (easy mode) */
  enableHints: boolean;
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { snapFraction: 0.06, showGhost: true, ghostOpacity: 0.12, showTooltip: true, strokeWidth: 1.5, strokeColor: "#555", showDragNameBar: true, enableHints: true },
  normal: { snapFraction: 0.03, showGhost: true, ghostOpacity: 0.05, showTooltip: true, strokeWidth: 0.8, strokeColor: "#444", showDragNameBar: true, enableHints: false },
  hard: { snapFraction: 0.015, showGhost: false, ghostOpacity: 0, showTooltip: false, strokeWidth: 0.3, strokeColor: "#333", showDragNameBar: false, enableHints: false },
};

// --- Colors ---

const PALETTE = [
  "#e63946", "#457b9d", "#2a9d8f", "#e9c46a", "#f4a261",
  "#264653", "#a8dadc", "#6d6875", "#b5838d", "#ffb4a2",
  "#6a994e", "#bc6c25", "#606c38", "#dda15e", "#9b2226",
  "#ae2012", "#bb3e03", "#ca6702", "#ee9b00", "#e9d8a6",
  "#94d2bd", "#0a9396", "#005f73", "#540b0e", "#283618",
];

/**
 * 地形色: area_km2 に基づく色分け
 * 小面積（都市部）→ 緑、大面積（山間部）→ 茶色
 */
function terrainColor(areaKm2: number): string {
  // 面積の対数スケールで 0-1 に正規化
  // ~10km2(都心) → 0, ~1000km2(山間部) → 1
  const logMin = Math.log10(5);
  const logMax = Math.log10(1500);
  const t = Math.max(0, Math.min(1, (Math.log10(Math.max(1, areaKm2)) - logMin) / (logMax - logMin)));

  // 緑(都市) → 黄緑 → 黄 → 茶(山間部)
  const colors = [
    [76, 175, 80],   // 緑 (#4CAF50)
    [139, 195, 74],  // 黄緑 (#8BC34A)
    [205, 220, 57],  // ライム (#CDDC39)
    [255, 193, 7],   // アンバー (#FFC107)
    [141, 110, 99],  // 茶 (#8D6E63)
    [93, 64, 55],    // 濃茶 (#5D4037)
  ];

  const idx = t * (colors.length - 1);
  const i = Math.min(Math.floor(idx), colors.length - 2);
  const f = idx - i;
  const c0 = colors[i];
  const c1 = colors[i + 1];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * f);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * f);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * f);
  return `rgb(${r},${g},${b})`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * ピースを50音順にソートしてグリッド配置する。
 * @param pieces       全ピース配列（ox/oy を上書きする）
 * @param scatterBox   スキャッタエリアの矩形 [x, y, w, h]
 * @param pathGen      重心算出に使う geoPath
 */
function assignGridPositions(
  pieces: PieceState[],
  scatterBox: [number, number, number, number],
  pathGen: d3.GeoPath
): void {
  const [bx, by, bw, bh] = scatterBox;
  const n = pieces.length;
  if (n === 0) return;

  // 50音順ソート（安定ソートなので同名は元順を保つ）
  pieces.sort((a, b) => a.name.localeCompare(b.name, "ja"));

  // グリッドの列数: アスペクト比に合わせて決定
  const aspect = bw / bh;
  const cols = Math.max(1, Math.round(Math.sqrt(n * aspect)));
  const rows = Math.ceil(n / cols);

  const cellW = bw / cols;
  const cellH = bh / rows;

  pieces.forEach((piece, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // セル中心
    const cx = bx + cellW * (col + 0.5);
    const cy = by + cellH * (row + 0.5);
    const centroid = pathGen.centroid(piece.feature);
    piece.ox = cx - centroid[0];
    piece.oy = cy - centroid[1];
  });
}

// --- Entry ---

export async function startPuzzle(
  app: HTMLDivElement,
  opts: PuzzleOptions,
  difficulty: Difficulty = "easy"
): Promise<void> {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const diffLabel = { easy: "かんたん", normal: "ふつう", hard: "むずかしい" }[difficulty];

  const title =
    opts.mode === "japan"
      ? "全国 47都道府県"
      : opts.mode === "region"
        ? `${opts.name!} 地方`
        : `${opts.name!}`;

  app.innerHTML = `
    <div class="header">
      <button class="back-btn" id="back-btn">← 戻る</button>
      <h1>${title} パズル</h1>
      <div class="header-stats">
        <span class="diff-label">${diffLabel}</span>
        <span>配置: <span class="value" id="count">0/0</span></span>
        <span>時間: <span class="value" id="timer">0:00</span></span>
      </div>
    </div>
    <div class="puzzle-screen">
      <div class="drag-name-bar" id="drag-name-bar"></div>
      <div class="puzzle-area">
        <div class="loading">読み込み中...</div>
      </div>
    </div>
  `;

  let timerHandle = 0;

  app.querySelector("#back-btn")!.addEventListener("click", () => {
    clearInterval(timerHandle);
    showModeSelect(app);
  });

  // --- Load TopoJSON ---
  let topo: Topology;
  try {
    let url: string;
    if (opts.mode === "japan") {
      url = "/api/v1/topojson/prefectures";
    } else if (opts.mode === "region") {
      url = "/api/v1/topojson/japan";
    } else {
      url = `/api/v1/topojson/prefectures/${opts.code}`;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    topo = await res.json();
  } catch (e) {
    console.error("Failed to load topojson:", e);
    app.querySelector(".loading")!.textContent = "データの読み込みに失敗しました";
    return;
  }

  // --- Convert TopoJSON → GeoJSON ---
  const objectKey = Object.keys(topo.objects)[0];
  const fc = topoFeature(
    topo,
    topo.objects[objectKey] as GeometryCollection
  ) as FeatureCollection<Geometry, AnyProps>;

  console.log(`[puzzle] Loaded ${fc.features.length} features from '${objectKey}'`);

  // --- Filter features for region mode ---
  let puzzleFeatures: Feature<Geometry, AnyProps>[];
  if (opts.mode === "region" && opts.regionPrefCodes) {
    const codes = new Set(opts.regionPrefCodes);
    puzzleFeatures = fc.features.filter(
      (f) => codes.has(f.properties!.prefecture_code as string)
    );
  } else {
    puzzleFeatures = fc.features;
  }

  console.log(`[puzzle] ${puzzleFeatures.length} puzzle pieces`);

  // --- Setup SVG ---
  app.querySelector(".loading")!.remove();

  const puzzleArea = app.querySelector<HTMLDivElement>(".puzzle-area")!;
  const rect = puzzleArea.getBoundingClientRect();
  const W = rect.width || window.innerWidth;
  const H = rect.height || window.innerHeight - 44;

  const svg = d3
    .select(puzzleArea)
    .append("svg")
    .attr("width", W)
    .attr("height", H);

  // --- Zoom wrapper ---
  const zoomG = svg.append("g");

  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.5, 8])
    .on("zoom", (event) => {
      zoomG.attr("transform", event.transform);
    });
  svg.call(zoom);

  // --- Projection ---
  // geoIdentity + reflectY: 座標を直接スケーリング（geoMercatorだと離島で破綻するため）
  // 離島（小笠原・先島等）で全体が極端に小さくならないよう、
  // 面積上位95%のフィーチャーのbboxでフィットさせる
  const mainFc = buildMainExtentFc(puzzleFeatures, opts.mode);

  // デバイス幅に応じてマップ領域とスキャッタ領域を切り替え
  const isPhone = W <= 480;
  const isTablet = W > 480 && W <= 768;

  let fitExtentBox: [[number, number], [number, number]];
  if (isPhone) {
    // スマホ: 上下分割（マップ上65%、ピース下35%）
    fitExtentBox = [[W * 0.03, H * 0.03], [W * 0.97, H * 0.60]];
  } else if (isTablet) {
    // タブレット: 左右分割（マップ広め60%）
    fitExtentBox = [[W * 0.03, H * 0.02], [W * 0.58, H * 0.95]];
  } else {
    // PC: 左右分割（マップ左55%）
    fitExtentBox = [[W * 0.05, H * 0.02], [W * 0.55, H * 0.95]];
  }

  const projection = d3.geoIdentity()
    .reflectY(true)
    .fitExtent(fitExtentBox, mainFc);
  const pathGen = d3.geoPath(projection);

  // --- Ghost outlines ---
  let ghostGroup: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;
  if (cfg.showGhost) {
    ghostGroup = zoomG.append("g");
    ghostGroup
      .selectAll("path")
      .data(puzzleFeatures)
      .join("path")
      .attr("class", "ghost")
      .attr("d", (d) => pathGen(d) ?? "")
      .style("fill", `rgba(100, 255, 218, ${cfg.ghostOpacity})`)
      .style("stroke", "#2a2a4e")
      .style("stroke-width", "0.5");
  }

  // --- Name helper ---
  function getName(f: Feature<Geometry, AnyProps>): string {
    const p = f.properties!;
    if (opts.mode === "japan") return (p.prefecture_name as string) ?? "";
    return (
      (p.municipality_name as string) ||
      (p.district_name as string) ||
      (p.full_name as string) ||
      ""
    );
  }

  // --- Piece states (50音順グリッド配置) ---
  // ox/oy は assignGridPositions で上書きされるので 0 で初期化
  const pieces: PieceState[] = puzzleFeatures.map((f) => ({
    feature: f,
    ox: 0,
    oy: 0,
    placed: false,
    name: getName(f),
  }));

  // スキャッタエリアの定義（グリッド範囲）
  let scatterBox: [number, number, number, number]; // [x, y, w, h]
  if (isPhone) {
    scatterBox = [W * 0.02, H * 0.63, W * 0.96, H * 0.32];
  } else if (isTablet) {
    scatterBox = [W * 0.60, H * 0.03, W * 0.38, H * 0.93];
  } else {
    scatterBox = [W * 0.57, H * 0.03, W * 0.41, H * 0.93];
  }
  assignGridPositions(pieces, scatterBox, pathGen);

  // --- Counter & Timer ---
  let placedCount = 0;
  const totalCount = pieces.length;
  const countEl = app.querySelector("#count")!;
  const timerEl = app.querySelector("#timer")!;
  countEl.textContent = `0/${totalCount}`;

  const t0 = Date.now();
  timerHandle = window.setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 1000);

  // --- Draw pieces ---
  const pieceGroup = zoomG.append("g");
  const labelGroup = zoomG.append("g").attr("class", "label-layer");

  const pathEls = pieceGroup
    .selectAll<SVGPathElement, PieceState>("path")
    .data(pieces)
    .join("path")
    .attr("class", "piece")
    .attr("d", (d) => pathGen(d.feature) ?? "")
    .attr("fill", (_, i) => PALETTE[i % PALETTE.length])
    .style("stroke", cfg.strokeColor)
    .style("stroke-width", cfg.strokeWidth)
    .attr("transform", (d) => `translate(${d.ox},${d.oy})`);

  // --- Tooltip ---
  const tip = d3
    .select(puzzleArea)
    .append("div")
    .attr("class", "tooltip")
    .style("display", "none");

  if (cfg.showTooltip) {
    pathEls
      .on("pointerenter", function (_ev: PointerEvent, d: PieceState) {
        if (d.placed) return;
        tip.style("display", "block").text(d.name);
      })
      .on("pointermove", function (ev: PointerEvent, d: PieceState) {
        if (d.placed) return;
        const r = puzzleArea.getBoundingClientRect();
        tip
          .style("left", ev.clientX - r.left + 14 + "px")
          .style("top", ev.clientY - r.top - 10 + "px");
      })
      .on("pointerleave", () => tip.style("display", "none"));
  }

  // --- Snap threshold ---
  const snapDist = Math.min(W, H) * cfg.snapFraction;

  // --- Drag name bar (mobile) ---
  const dragNameBar = app.querySelector<HTMLDivElement>("#drag-name-bar")!;

  // --- Hint helpers ---
  let hintTimer: ReturnType<typeof setInterval> | null = null;

  function highlightGhost(feature: Feature<Geometry, AnyProps>) {
    if (!ghostGroup) return;
    ghostGroup.selectAll<SVGPathElement, Feature<Geometry, AnyProps>>("path")
      .classed("ghost-hint", (g) => g === feature);
  }

  function clearGhostHint() {
    ghostGroup?.selectAll("path").classed("ghost-hint", false);
  }

  function attractToTarget(d: PieceState, el: d3.Selection<SVGPathElement, PieceState, null, undefined>) {
    d.ox *= 0.9;
    d.oy *= 0.9;
    el.attr("transform", `translate(${d.ox},${d.oy})`);
  }

  function cleanupHint() {
    if (hintTimer !== null) {
      clearInterval(hintTimer);
      hintTimer = null;
    }
    clearGhostHint();
    if (cfg.showDragNameBar) {
      dragNameBar.style.display = "none";
    }
  }

  // --- Drag ---
  const drag = d3
    .drag<SVGPathElement, PieceState>()
    .container(zoomG.node()!)
    .on("start", function (_, d) {
      if (d.placed) return;
      d3.select(this).raise().classed("dragging", true);
      tip.style("display", "none");

      // Show drag name bar (mobile)
      if (cfg.showDragNameBar) {
        dragNameBar.textContent = d.name;
        dragNameBar.style.display = "block";
      }

      // Hint system (easy mode)
      if (cfg.enableHints && ghostGroup) {
        const holdStart = Date.now();
        const gameElapsed = (Date.now() - t0) / 1000;
        const remaining = totalCount - placedCount;
        const baseTime = Math.max(180, Math.min(300, totalCount * 6));
        const hintThreshold = (remaining / totalCount) * baseTime;
        const immediateHint = gameElapsed > hintThreshold;
        const immediateAnswer = gameElapsed > hintThreshold * 1.5;

        if (immediateHint) {
          highlightGhost(d.feature);
        }

        const el = d3.select<SVGPathElement, PieceState>(this);
        hintTimer = setInterval(() => {
          const holdSec = (Date.now() - holdStart) / 1000;
          if (immediateHint || holdSec > 60) {
            highlightGhost(d.feature);
          }
          if (immediateAnswer || holdSec > 90) {
            attractToTarget(d, el);
          }
        }, 1000);
      }
    })
    .on("drag", function (ev, d) {
      if (d.placed) return;
      d.ox += ev.dx;
      d.oy += ev.dy;
      d3.select(this).attr("transform", `translate(${d.ox},${d.oy})`);
    })
    .on("end", function (_, d) {
      if (d.placed) return;
      const el = d3.select<SVGPathElement, PieceState>(this);
      el.classed("dragging", false);
      cleanupHint();

      const currentScale = d3.zoomTransform(svg.node()!).k;
      const adjustedSnapDist = snapDist / currentScale;
      const dist = Math.sqrt(d.ox * d.ox + d.oy * d.oy);
      if (dist < adjustedSnapDist) {
        d.ox = 0;
        d.oy = 0;
        d.placed = true;

        // 地形色に変更
        const area = (d.feature.properties?.area_km2 as number) ?? 100;
        const tColor = terrainColor(area);
        el.transition()
          .duration(200)
          .attr("transform", "translate(0,0)")
          .attr("fill", tColor);
        el.classed("placed", true);
        el.on(".drag", null);

        // 名前ラベルを表示
        const centroid = pathGen.centroid(d.feature);
        if (centroid && isFinite(centroid[0]) && isFinite(centroid[1])) {
          const bounds = pathGen.bounds(d.feature);
          const pieceW = bounds[1][0] - bounds[0][0];
          const fontSize = Math.max(6, Math.min(14, pieceW * 0.25));
          labelGroup
            .append("text")
            .attr("class", "piece-label")
            .attr("x", centroid[0])
            .attr("y", centroid[1])
            .attr("font-size", fontSize)
            .text(d.name);
        }

        placedCount++;
        countEl.textContent = `${placedCount}/${totalCount}`;

        if (placedCount === totalCount) {
          clearInterval(timerHandle);
          showCompleteOverlay(app, puzzleArea, opts, difficulty, totalCount, t0);
        }
      }
    });

  pathEls.call(drag);
}

// --- Helpers ---

/**
 * 離島で全体が極端に小さくならないよう、
 * 面積上位95%のフィーチャーの重心に基づいてフィット用のFCを構築する。
 * 重心が大きく外れるフィーチャー（離島）を除外して投影範囲を決定する。
 */
function buildMainExtentFc(
  features: Feature<Geometry, AnyProps>[],
  mode: PuzzleOptions["mode"] = "prefecture"
): FeatureCollection {
  // japan モードでは全都道府県を表示する必要があるためカットオフなし
  if (mode === "japan" || features.length <= 3) {
    return { type: "FeatureCollection", features };
  }

  // 各フィーチャーの重心（緯度経度）を計算
  const centroids: { feat: Feature<Geometry, AnyProps>; cx: number; cy: number }[] = [];
  for (const feat of features) {
    const bbox = geoBbox(feat);
    centroids.push({ feat, cx: (bbox[0] + bbox[2]) / 2, cy: (bbox[1] + bbox[3]) / 2 });
  }

  // 全体の重心
  const avgX = centroids.reduce((s, c) => s + c.cx, 0) / centroids.length;
  const avgY = centroids.reduce((s, c) => s + c.cy, 0) / centroids.length;

  // 重心からの距離でソート、上位90%を取る
  const sorted = [...centroids].sort((a, b) => {
    const da = (a.cx - avgX) ** 2 + (a.cy - avgY) ** 2;
    const db = (b.cx - avgX) ** 2 + (b.cy - avgY) ** 2;
    return da - db;
  });
  const cutoff = Math.max(3, Math.ceil(sorted.length * 0.9));
  const main = sorted.slice(0, cutoff).map((c) => c.feat);

  return { type: "FeatureCollection", features: main };
}

/** フィーチャーの地理的bboxを計算 [minX, minY, maxX, maxY] */
function geoBbox(feat: Feature<Geometry, AnyProps>): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const g = feat.geometry as any;
  const polys = g.type === "MultiPolygon" ? g.coordinates : [g.coordinates];
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return [minX, minY, maxX, maxY];
}

// --- Complete overlay ---

function showCompleteOverlay(
  app: HTMLDivElement,
  puzzleArea: HTMLDivElement,
  opts: PuzzleOptions,
  difficulty: Difficulty,
  total: number,
  t0: number
): void {
  const sec = Math.floor((Date.now() - t0) / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const label =
    opts.mode === "japan"
      ? "全国 47都道府県"
      : opts.mode === "region"
        ? `${opts.name} 地方`
        : `${opts.name}`;

  const overlay = document.createElement("div");
  overlay.className = "complete-overlay";
  overlay.innerHTML = `
    <h2>完成!</h2>
    <p>${label} — ${total}ピース</p>
    <p>タイム: ${m}分${String(s).padStart(2, "0")}秒</p>
    <button class="btn-primary" id="retry-btn">もう一度</button>
    <button class="back-btn" id="menu-btn" style="margin-top:8px;">モード選択に戻る</button>
  `;
  puzzleArea.appendChild(overlay);

  overlay.querySelector("#retry-btn")!.addEventListener("click", () => {
    startPuzzle(app, opts, difficulty);
  });
  overlay.querySelector("#menu-btn")!.addEventListener("click", () => {
    showModeSelect(app);
  });
}
