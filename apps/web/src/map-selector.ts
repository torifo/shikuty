/**
 * 選択画面用インタラクティブ日本地図
 * - renderPrefectureMap: 都道府県選択
 * - renderRegionMap: 地方選択（色分け）
 */
import * as d3 from "d3";
import { feature as topoFeature } from "topojson-client";
import type { GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { REGIONS } from "./regions.ts";

type AnyProps = Record<string, unknown>;

// 地方カラーパレット（ゲームテーマに合わせた配色）
const REGION_COLORS: Record<string, string> = {
  "北海道":   "#2a9d8f",
  "東北":     "#457b9d",
  "関東":     "#e63946",
  "中部":     "#e9c46a",
  "近畿":     "#f4a261",
  "中国":     "#6d6875",
  "四国":     "#6a994e",
  "九州・沖縄": "#bc6c25",
};
const REGION_COLORS_HOVER: Record<string, string> = {
  "北海道":   "#3bbcad",
  "東北":     "#5b9bbf",
  "関東":     "#ff5a66",
  "中部":     "#ffd57a",
  "近畿":     "#ffb87a",
  "中国":     "#8e8699",
  "四国":     "#85bb67",
  "九州・沖縄": "#e08235",
};

const SVG_W = 600;
const SVG_H = 520;

// 都道府県フィーチャーキャッシュ（タブ切替で再fetchしない）
let prefFeaturesCache: Feature<Geometry, AnyProps>[] | null = null;

async function loadPrefFeatures(): Promise<Feature<Geometry, AnyProps>[]> {
  if (prefFeaturesCache) return prefFeaturesCache;
  const res = await fetch("/api/v1/topojson/prefectures");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const topo = await res.json();
  const key = Object.keys(topo.objects)[0];
  const fc = topoFeature(topo, topo.objects[key] as GeometryCollection) as FeatureCollection<Geometry, AnyProps>;
  prefFeaturesCache = fc.features;
  return prefFeaturesCache;
}

function buildPrefToRegion(): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of REGIONS) {
    for (const code of r.prefCodes) m.set(code, r.name);
  }
  return m;
}

function makeProjection(features: Feature<Geometry, AnyProps>[]) {
  return d3
    .geoIdentity()
    .reflectY(true)
    .fitExtent(
      [[16, 14], [SVG_W - 16, SVG_H - 14]],
      { type: "FeatureCollection", features } as FeatureCollection
    );
}

function makeTooltip(): HTMLDivElement {
  const tip = document.createElement("div");
  tip.className = "map-select-tooltip";
  tip.style.display = "none";
  document.body.appendChild(tip);
  return tip;
}

function positionTooltip(tip: HTMLDivElement, x: number, y: number) {
  const W = window.innerWidth;
  const tipW = 160; // 最大幅の概算
  const left = x + 12 + tipW > W ? x - tipW - 4 : x + 12;
  tip.style.left = left + "px";
  tip.style.top = (y - 36) + "px";
}

// ---------------------------------------------------------------------------
// 都道府県選択マップ
// ---------------------------------------------------------------------------
export function renderPrefectureMap(
  container: HTMLElement,
  onSelect: (code: string, name: string) => void
): () => void {
  let destroyed = false;
  const tip = makeTooltip();

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "map-select-svg")
    .attr("viewBox", `0 0 ${SVG_W} ${SVG_H}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  // ローディング表示
  svg.append("text")
    .attr("class", "map-loading-text")
    .attr("x", SVG_W / 2)
    .attr("y", SVG_H / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#a8b2d1")
    .attr("font-size", 16)
    .text("地図を読み込み中...");

  loadPrefFeatures().then((features) => {
    if (destroyed) return;
    svg.select(".map-loading-text").remove();

    const projection = makeProjection(features);
    const pathGen = d3.geoPath(projection);

    svg
      .selectAll<SVGPathElement, Feature<Geometry, AnyProps>>("path.map-pref")
      .data(features)
      .join("path")
      .attr("class", "map-pref")
      .attr("d", (d) => pathGen(d) ?? "")
      .attr("fill", "#16213e")
      .attr("stroke", "#64ffda")
      .attr("stroke-width", 0.7)
      .style("cursor", "pointer")
      .on("mouseenter", function (event, d) {
        d3.select(this).attr("fill", "#1e4080");
        const name = d.properties!.prefecture_name as string;
        tip.textContent = name;
        tip.style.display = "block";
        positionTooltip(tip, event.clientX, event.clientY);
      })
      .on("mousemove", (event) => positionTooltip(tip, event.clientX, event.clientY))
      .on("mouseleave", function () {
        d3.select(this).attr("fill", "#16213e");
        tip.style.display = "none";
      })
      .on("click", (_, d) => {
        const code = d.properties!.prefecture_code as string;
        const name = d.properties!.prefecture_name as string;
        onSelect(code, name);
      });
  }).catch(() => {
    if (destroyed) return;
    svg.select(".map-loading-text").text("地図の読み込みに失敗しました");
  });

  return () => {
    destroyed = true;
    tip.remove();
  };
}

// ---------------------------------------------------------------------------
// 地方選択マップ（地方別色分け）
// ---------------------------------------------------------------------------
export function renderRegionMap(
  container: HTMLElement,
  onSelect: (regionName: string) => void
): () => void {
  let destroyed = false;
  const prefToRegion = buildPrefToRegion();
  const tip = makeTooltip();
  let currentRegion = "";

  const svg = d3
    .select(container)
    .append("svg")
    .attr("class", "map-select-svg")
    .attr("viewBox", `0 0 ${SVG_W} ${SVG_H}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  svg.append("text")
    .attr("class", "map-loading-text")
    .attr("x", SVG_W / 2)
    .attr("y", SVG_H / 2)
    .attr("text-anchor", "middle")
    .attr("fill", "#a8b2d1")
    .attr("font-size", 16)
    .text("地図を読み込み中...");

  loadPrefFeatures().then((features) => {
    if (destroyed) return;
    svg.select(".map-loading-text").remove();

    const projection = makeProjection(features);
    const pathGen = d3.geoPath(projection);

    function baseColor(code: string): string {
      const r = prefToRegion.get(code) ?? "";
      return REGION_COLORS[r] ?? "#16213e";
    }
    function hoverColor(code: string): string {
      const r = prefToRegion.get(code) ?? "";
      return REGION_COLORS_HOVER[r] ?? "#1e4080";
    }

    const paths = svg
      .selectAll<SVGPathElement, Feature<Geometry, AnyProps>>("path.map-pref")
      .data(features)
      .join("path")
      .attr("class", "map-pref")
      .attr("d", (d) => pathGen(d) ?? "")
      .attr("fill", (d) => baseColor(d.properties!.prefecture_code as string))
      .attr("stroke", "#1a1a2e")
      .attr("stroke-width", 0.6)
      .style("cursor", "pointer");

    paths
      .on("mouseenter", function (event, d) {
        const code = d.properties!.prefecture_code as string;
        currentRegion = prefToRegion.get(code) ?? "";
        // 同じ地方を明るく、他を暗く
        paths
          .attr("fill", (f) => {
            const fc = f.properties!.prefecture_code as string;
            return prefToRegion.get(fc) === currentRegion
              ? hoverColor(fc)
              : baseColor(fc);
          })
          .attr("opacity", (f) => {
            const fc = f.properties!.prefecture_code as string;
            return prefToRegion.get(fc) === currentRegion ? 1 : 0.45;
          });
        tip.textContent = currentRegion;
        tip.style.display = "block";
        positionTooltip(tip, event.clientX, event.clientY);
      })
      .on("mousemove", (event) => positionTooltip(tip, event.clientX, event.clientY))
      .on("mouseleave", () => {
        currentRegion = "";
        paths
          .attr("fill", (d) => baseColor(d.properties!.prefecture_code as string))
          .attr("opacity", 1);
        tip.style.display = "none";
      })
      .on("click", (_, d) => {
        const code = d.properties!.prefecture_code as string;
        const region = prefToRegion.get(code) ?? "";
        if (region) onSelect(region);
      });

    // 地方名ラベル（各地方の重心に表示）
    const regionCentroids = new Map<string, [number, number][]>();
    for (const feat of features) {
      const code = feat.properties!.prefecture_code as string;
      const region = prefToRegion.get(code) ?? "";
      if (!regionCentroids.has(region)) regionCentroids.set(region, []);
      const c = pathGen.centroid(feat);
      if (isFinite(c[0]) && isFinite(c[1])) {
        regionCentroids.get(region)!.push(c);
      }
    }

    for (const [region, centroids] of regionCentroids) {
      if (centroids.length === 0) continue;
      const cx = centroids.reduce((s, c) => s + c[0], 0) / centroids.length;
      const cy = centroids.reduce((s, c) => s + c[1], 0) / centroids.length;
      svg
        .append("text")
        .attr("class", "map-region-label")
        .attr("x", cx)
        .attr("y", cy)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .attr("fill", "#fff")
        .attr("font-size", 11)
        .attr("font-weight", "700")
        .attr("pointer-events", "none")
        .attr("paint-order", "stroke")
        .attr("stroke", "rgba(0,0,0,0.6)")
        .attr("stroke-width", 3)
        .text(region);
    }
  }).catch(() => {
    if (destroyed) return;
    svg.select(".map-loading-text").text("地図の読み込みに失敗しました");
  });

  return () => {
    destroyed = true;
    tip.remove();
  };
}
