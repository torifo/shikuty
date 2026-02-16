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
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { snapFraction: 0.06, showGhost: true, ghostOpacity: 0.12, showTooltip: true },
  normal: { snapFraction: 0.03, showGhost: true, ghostOpacity: 0.05, showTooltip: true },
  hard: { snapFraction: 0.015, showGhost: false, ghostOpacity: 0, showTooltip: false },
};

// --- Colors ---

const PALETTE = [
  "#e63946", "#457b9d", "#2a9d8f", "#e9c46a", "#f4a261",
  "#264653", "#a8dadc", "#6d6875", "#b5838d", "#ffb4a2",
  "#6a994e", "#bc6c25", "#606c38", "#dda15e", "#9b2226",
  "#ae2012", "#bb3e03", "#ca6702", "#ee9b00", "#e9d8a6",
  "#94d2bd", "#0a9396", "#005f73", "#540b0e", "#283618",
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

  // --- Projection ---
  // geoIdentity + reflectY: 座標を直接スケーリング（geoMercatorだと離島で破綻するため）
  // 離島（小笠原・先島等）で全体が極端に小さくならないよう、
  // 面積上位95%のフィーチャーのbboxでフィットさせる
  const mainFc = buildMainExtentFc(puzzleFeatures);

  const projection = d3.geoIdentity()
    .reflectY(true)
    .fitExtent(
      [
        [W * 0.05, H * 0.05],
        [W * 0.55, H * 0.95],
      ],
      mainFc
    );
  const pathGen = d3.geoPath(projection);

  // --- Ghost outlines ---
  if (cfg.showGhost) {
    svg
      .append("g")
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

  // --- Piece states ---
  const pieces: PieceState[] = shuffle(puzzleFeatures).map((f) => {
    const name = getName(f);
    const centroid = pathGen.centroid(f);
    const scatterX = W * 0.62 + Math.random() * W * 0.3;
    const scatterY = H * 0.05 + Math.random() * H * 0.84;
    return {
      feature: f,
      ox: scatterX - centroid[0],
      oy: scatterY - centroid[1],
      placed: false,
      name,
    };
  });

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
  const pieceGroup = svg.append("g");

  const pathEls = pieceGroup
    .selectAll<SVGPathElement, PieceState>("path")
    .data(pieces)
    .join("path")
    .attr("class", "piece")
    .attr("d", (d) => pathGen(d.feature) ?? "")
    .attr("fill", (_, i) => PALETTE[i % PALETTE.length])
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

  // --- Drag ---
  const drag = d3
    .drag<SVGPathElement, PieceState>()
    .on("start", function (_, d) {
      if (d.placed) return;
      d3.select(this).raise().classed("dragging", true);
      tip.style("display", "none");
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

      const dist = Math.sqrt(d.ox * d.ox + d.oy * d.oy);
      if (dist < snapDist) {
        d.ox = 0;
        d.oy = 0;
        d.placed = true;
        el.transition()
          .duration(200)
          .attr("transform", "translate(0,0)")
          .attr("fill", "#2a9d8f");
        el.classed("placed", true);
        el.on(".drag", null);

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
  features: Feature<Geometry, AnyProps>[]
): FeatureCollection {
  if (features.length <= 3) {
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
