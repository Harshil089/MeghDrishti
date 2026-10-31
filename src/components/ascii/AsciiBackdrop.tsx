"use client";

import { Children, isValidElement, useEffect, useRef, type ReactNode } from "react";

/* Full-page ASCII backdrop, rendered live in one WebGL2 pass.
   Pieces are real ASCII art (see art.ts, generated with ASCII-generator from
   MeghDrishti station data), uploaded as character textures and drawn one
   character per screen cell, each with a live effect and its own parallax depth.
   An optional far layer adds a drifting satellite-style cloud field in the margins. */

// Density ramp: index 0 = blank, 9 = densest. Matches ASCII-generator's "simple" set, reversed.
const RAMP = " .:-=+*#%@";
const MAX = 8;

export const EFFECT = { none: 0, twinkle: 1, isotherm: 2, reveal: 3, sweep: 4 } as const;
export type ArtProps = {
  /** Multiline ASCII art from art.ts. */
  art: string;
  /** CSS selector of the section this piece belongs to ("" = top of page). */
  anchor?: string;
  /** Vertical offset from the anchor's top (or centre, see `center`), in viewport heights. */
  dy?: number;
  /** Measure from the anchor's vertical centre instead of its top. */
  center?: boolean;
  /** Horizontal centre, 0 = left edge, 1 = right edge. */
  x: number;
  /** Parallax depth: 1 moves with the page, 0 stays fixed on screen. */
  depth?: number;
  /** Live effect. */
  effect?: keyof typeof EFFECT;
  /** Opacity multiplier for this piece. */
  strength?: number;
};

const VERT = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes, uCell;
uniform float uTime, uShift, uField;
uniform int uCount;
uniform vec4 uP[${MAX}];  // origin cell x, origin cell y, cols, rows
uniform vec4 uQ[${MAX}];  // texture row offset, effect, strength, 0
uniform vec3 uAccent;
uniform sampler2D uArt;   // R = density 0..9 / 255
uniform sampler2D uAtlas;
out vec4 o;

float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = floor(frag / uCell);
  vec2 local = fract(frag / uCell);

  float g = 0.0, alpha = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 P = uP[i], Q = uQ[i];
    vec2 lc = cell - P.xy;
    if (lc.x < 0.0 || lc.y < 0.0 || lc.x >= P.z || lc.y >= P.w) continue;
    float d = floor(texelFetch(uArt, ivec2(lc.x, Q.x + lc.y), 0).r * 255.0 + 0.5);
    if (d < 1.0) continue;
    float a = 0.3 + 0.07 * d;
    int fx = int(Q.y);
    float t = uTime;
    if (fx == 1) {        // stations reporting: cells flicker on their own clocks
      float k = h2(cell + floor(t * (0.8 + h2(cell) * 1.6)));
      a *= 0.45 + 0.55 * step(0.25, k);
      a += 0.35 * exp(-pow((lc.y / P.w) - fract(t * 0.07), 2.0) * 300.0);
    } else if (fx == 2) { // temperature field: a slow warm wave across the isotherms
      a *= 0.6 + 0.4 * (0.5 + 0.5 * sin((lc.x * 0.12 + lc.y * 0.2) - t * 0.9));
    } else if (fx == 3) { // trace draws itself, bright head, then holds
      float head = fract(t / 14.0) * (P.z + 30.0);
      if (lc.x > head) continue;
      a *= 0.55 + 0.45 * exp(-(head - lc.x) * 0.08);
    } else if (fx == 4) { // radar: sweep lights the returns
      vec2 c = (lc - P.zw * 0.5) * vec2(uCell.x / uCell.y, 1.0);
      float lag = mod(t * 0.8 - atan(c.y, c.x), 6.2831853);
      a *= 0.6 + 0.4 * exp(-lag * 1.6);
    }
    g = d; alpha = min(1.0, a) * Q.z;
    break;
  }

  if (g < 1.0 && uField > 0.0) {
    // Far layer: satellite-style cloud field, only in the side margins.
    vec2 p = (cell + 0.5) * uCell / uRes.y; p.y += uShift;
    vec2 wv = p * 1.9 + vec2(uTime * 0.012, -uTime * 0.006);
    vec2 qq = vec2(fbm(wv), fbm(wv + vec2(5.2, 1.3)));
    float cl = smoothstep(0.5, 0.82, fbm(wv + 1.7 * qq));
    float side = smoothstep(0.32, 0.5, abs(frag.x / uRes.x - 0.5));
    if (cl * side > 0.02) { g = 1.0 + floor(cl * 8.99); alpha = (0.12 + 0.4 * cl) * side * uField; }
  }
  if (g < 1.0) discard;
  float m = texture(uAtlas, vec2((g + local.x) / ${RAMP.length}.0, local.y)).r;
  if (m < 0.05) discard;
  o = vec4(uAccent, m * alpha);
}`;

type Piece = { props: ArtProps; cols: number; rows: number; row: number };

/** Fixed full-page ASCII layer. Children are <AsciiArt> pieces (see AsciiArt.tsx). */
export default function AsciiBackdrop({ children, cell = 11, field = 0, opacity = 1 }: { children?: ReactNode; cell?: number; field?: number; opacity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const props: ArtProps[] = [];
  Children.forEach(children, (ch) => {
    if (isValidElement(ch) && (ch.type as { asciiArt?: boolean }).asciiArt) props.push(ch.props as ArtProps);
  });
  const key = JSON.stringify(props.slice(0, MAX));

  useEffect(() => {
    let gone = false;
    let stop = () => {};
    document.fonts.ready.then(() => {
      if (!gone) stop = start();
    });
    return () => {
      gone = true;
      stop();
    };

    function start(): () => void {
      const el = ref.current;
      const gl = el?.getContext("webgl2", { antialias: false, premultipliedAlpha: false });
      if (!el || !gl) return () => {};
      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
        return s;
      };
      const prog = gl.createProgram()!;
      try {
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
      } catch (e) {
        console.warn("AsciiBackdrop disabled:", e);
        return () => {};
      }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const u = (n: string) => gl.getUniformLocation(prog, n);

      // Pack every piece's characters into one density texture, stacked by rows.
      const list: ArtProps[] = JSON.parse(key);
      let row = 0;
      const pieces: Piece[] = list.map((p) => {
        const lines = p.art.split("\n");
        const piece = { props: p, cols: Math.max(...lines.map((l) => l.length)), rows: lines.length, row };
        row += lines.length;
        return piece;
      });
      const texW = Math.max(1, ...pieces.map((p) => p.cols)), texH = Math.max(1, row);
      const data = new Uint8Array(texW * texH);
      pieces.forEach((p) =>
        p.props.art.split("\n").forEach((line, y) => {
          for (let x = 0; x < line.length; x++) data[(p.row + y) * texW + x] = Math.max(0, RAMP.indexOf(line[x]));
        })
      );
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const artTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, artTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, texW, texH, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.uniform1i(u("uArt"), 0);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const ch = Math.round(cell * dpr), cw = Math.round(cell * 0.6 * dpr);
      const atlas = document.createElement("canvas");
      atlas.width = cw * 2 * RAMP.length;
      atlas.height = ch * 2;
      const ctx = atlas.getContext("2d")!;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, atlas.width, atlas.height);
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const mono = getComputedStyle(document.body).getPropertyValue("--font-geist-mono").trim() || "monospace";
      ctx.font = `700 ${Math.round(ch * 1.6)}px ${mono}, ui-monospace, monospace`;
      [...RAMP].forEach((c, i) => ctx.fillText(c, (i + 0.5) * cw * 2, ch * 1.08));
      const atlasTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, atlasTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(u("uAtlas"), 1);

      const hex = getComputedStyle(document.documentElement).getPropertyValue("--c-accent").trim() || "#2f5fd0";
      const n = parseInt(hex.slice(1), 16);
      gl.uniform3f(u("uAccent"), ((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
      gl.uniform2f(u("uCell"), cw, ch);
      gl.uniform1f(u("uField"), field);
      gl.uniform1i(u("uCount"), pieces.length);
      const Q = new Float32Array(MAX * 4);
      pieces.forEach((p, i) => Q.set([p.row, EFFECT[p.props.effect ?? "none"], (p.props.strength ?? 1) * opacity, 0], i * 4));
      gl.uniform4fv(u("uQ"), Q);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      // Each piece's resting page position, re-measured when the layout changes.
      let rest: number[] = [];
      const measure = () => {
        el.width = Math.round(el.clientWidth * dpr);
        el.height = Math.round(el.clientHeight * dpr);
        gl.viewport(0, 0, el.width, el.height);
        gl.uniform2f(u("uRes"), el.width, el.height);
        rest = pieces.map(({ props: p }) => {
          const a = p.anchor ? document.querySelector(p.anchor) : null;
          const r = a?.getBoundingClientRect();
          const top = r ? r.top + window.scrollY + (p.center ? r.height / 2 : 0) : 0;
          return top + (p.dy ?? 0) * window.innerHeight;
        });
        wake();
      };

      const P = new Float32Array(MAX * 4);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t0 = performance.now();
      let raf = 0;
      const draw = (now: number) => {
        raf = 0;
        const vh = window.innerHeight, sy = window.scrollY;
        pieces.forEach((p, i) => {
          // Lined up with its section when that section is centred; lags (depth < 1) otherwise.
          const s0 = rest[i] - vh / 2;
          const yCss = vh / 2 - (sy - s0) * (p.props.depth ?? 0.5);
          const cx = (p.props.x * el.width) / cw, cy = (yCss * dpr) / ch;
          P.set([Math.round(cx - p.cols / 2), Math.round(cy - p.rows / 2), p.cols, p.rows], i * 4);
        });
        gl.uniform4fv(u("uP"), P);
        gl.uniform1f(u("uTime"), still ? 9 : (now - t0) / 1000);
        gl.uniform1f(u("uShift"), (sy * 0.12) / vh);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!still && !document.hidden) raf = requestAnimationFrame(draw);
      };
      function wake() {
        if (!raf) raf = requestAnimationFrame(draw);
      }
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(document.body);
      window.addEventListener("scroll", wake, { passive: true });
      document.addEventListener("visibilitychange", wake);
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("scroll", wake);
        document.removeEventListener("visibilitychange", wake);
        gl.deleteTexture(artTex);
        gl.deleteTexture(atlasTex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      };
    }
  }, [key, cell, field, opacity]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-dvh w-screen" />;
}
