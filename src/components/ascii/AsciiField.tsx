"use client";

import { useEffect, useRef } from "react";

/* Live ASCII "instrument view": a drifting cloud field in the style of satellite IR
   imagery, dotted pressure contours and a slow scan line, drawn as monospace glyphs
   in one WebGL2 pass. It is decoration, not data: nothing here is a real observation. */

const RAMP = " .:-=+*#%@"; // density ramp, index 0 = empty

const VERT = `#version 300 es
layout(location = 0) in vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;      // canvas, device px
uniform vec2 uCell;     // glyph cell (w, h), device px
uniform float uTime;
uniform float uShift;   // parallax offset, viewport heights
uniform float uClear;   // 0..1: how much the centre is cleared for text
uniform float uAlpha;   // overall strength
uniform vec3 uField;    // cloud colour
uniform vec3 uLine;     // contour / grid colour
uniform sampler2D uAtlas;
out vec4 o;

float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = floor(frag / uCell);
  vec2 local = fract(frag / uCell);
  vec2 p = (cell + 0.5) * uCell / uRes.y;
  p.y += uShift;

  // Domain-warped fbm: slow, organic cloud bands like IR imagery.
  vec2 w = p * 1.9 + vec2(uTime * 0.012, -uTime * 0.006);
  vec2 q = vec2(fbm(w), fbm(w + vec2(5.2, 1.3)));
  float d = fbm(w + 1.7 * q + vec2(uTime * 0.004, 0.0));
  float cloud = smoothstep(0.47, 0.8, d);

  // Pressure contours: thin dotted bands of a broad, slowly moving field.
  float pr = fbm(p * 0.7 + vec2(uTime * 0.003, 11.3));
  float iso = step(fract(pr * 11.0), 0.07) * step(0.5, h2(cell + 0.37)) ;

  // Chart grid: a '+' at regular intersections.
  float grid = step(mod(cell.x, 14.0), 0.5) * step(mod(cell.y, 8.0), 0.5);

  // Slow scan line, like an instrument refresh.
  float sy = frag.y / uRes.y;
  float scan = exp(-pow((sy - fract(uTime * 0.045) * 1.3 + 0.15) * 22.0, 2.0));

  // Keep the centre quiet so headline text reads cleanly.
  float cx = abs(frag.x / uRes.x - 0.5) * 2.0;
  float cy = abs(frag.y / uRes.y - 0.42) * 2.0;
  float edge = max(smoothstep(0.42, 0.95, cx), smoothstep(0.7, 1.0, cy));
  float keep = mix(1.0 - uClear, 1.0, edge);

  float g = 0.0; vec3 col = uField; float a = 0.0;
  if (cloud > 0.02) { g = 1.0 + floor(cloud * 8.99); a = 0.22 + 0.7 * cloud; }
  else if (iso > 0.0) { g = 1.0; col = uLine; a = 0.55; }
  else if (grid > 0.0) { g = 5.0; col = uLine; a = 0.35; }
  a = min(1.0, a + scan * 0.35 * step(0.5, g));
  if (g < 0.5) discard;

  float mask = texture(uAtlas, vec2((g + local.x) / ${RAMP.length}.0, local.y)).r;
  if (mask < 0.05) discard;
  o = vec4(col, mask * a * keep * uAlpha);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Fills its positioned parent with the live ASCII field. */
export default function AsciiField({
  cell = 13,
  field = "#2f5fd0",
  line = "#5a6782",
  clear = 0.9,
  strength = 1,
  parallax = 0.25,
}: {
  /** Glyph height in CSS px. */
  cell?: number;
  /** Cloud glyph colour. */
  field?: string;
  /** Contour and grid colour. */
  line?: string;
  /** 0..1, how much the centre is cleared for text. */
  clear?: number;
  /** Overall opacity multiplier. */
  strength?: number;
  /** Share of page scroll the field drifts by. */
  parallax?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

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
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
        return s;
      };
      const prog = gl.createProgram()!;
      try {
        gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
      } catch (e) {
        console.warn("AsciiField disabled:", e);
        return () => {};
      }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const u = (n: string) => gl.getUniformLocation(prog, n);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const ch = Math.round(cell * dpr), cw = Math.round(cell * 0.6 * dpr);
      // Glyph atlas: bold mono, drawn at 2x for crisp sampling.
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
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      gl.uniform2f(u("uCell"), cw, ch);
      gl.uniform1f(u("uClear"), clear);
      gl.uniform1f(u("uAlpha"), strength);
      gl.uniform3fv(u("uField"), hexToRgb(field));
      gl.uniform3fv(u("uLine"), hexToRgb(line));
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      const size = () => {
        el.width = Math.max(1, Math.round(el.clientWidth * dpr));
        el.height = Math.max(1, Math.round(el.clientHeight * dpr));
        gl.viewport(0, 0, el.width, el.height);
        gl.uniform2f(u("uRes"), el.width, el.height);
      };
      size();
      const ro = new ResizeObserver(size);
      ro.observe(el);

      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const t0 = performance.now();
      let raf = 0;
      let visible = true;
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) wake();
      });
      io.observe(el);
      const draw = (now: number) => {
        raf = 0;
        gl.uniform1f(u("uTime"), still ? 30 : (now - t0) / 1000);
        gl.uniform1f(u("uShift"), (window.scrollY * parallax) / window.innerHeight);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!still && visible && !document.hidden) raf = requestAnimationFrame(draw);
      };
      function wake() {
        if (!raf) raf = requestAnimationFrame(draw);
      }
      wake();
      window.addEventListener("scroll", wake, { passive: true });
      document.addEventListener("visibilitychange", wake);
      return () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("scroll", wake);
        document.removeEventListener("visibilitychange", wake);
        gl.deleteTexture(tex);
        gl.deleteBuffer(buf);
        gl.deleteProgram(prog);
      };
    }
  }, [cell, field, line, clear, strength, parallax]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />;
}
