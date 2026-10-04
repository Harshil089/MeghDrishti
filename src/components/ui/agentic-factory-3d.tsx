'use client'

import { useEffect, useRef } from 'react'
import { Box, Layers, Mouse, Package, PanelsTopLeft, Pause, Play, Workflow } from 'lucide-react'

import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/** Weather pipeline adapted for MeghDrishti.
 * Original scene by OpenAI Codex, React port by Claude.
 * Source: https://github.com/eugeneshilow/agentic-3d-templates
 * Made with AI agents: https://vibecoding.tech
 */
export type AgenticFactory3DProps = {
  height?: number | string
  className?: string
  embed?: boolean
  onStation?: (id: StationId) => void
  onReady?: () => void
}

export default function AgenticFactory3D({
  height = '100vh', className, embed = false, onStation, onReady,
}: AgenticFactory3DProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  const handlers = useRef({ onStation, onReady })
  useEffect(() => {
    handlers.current = { onStation, onReady }
  }, [onStation, onReady])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let dispose: (() => void) | undefined
    let cancelled = false
    // Wait for fonts before painting the in-scene screens.
    document.fonts.ready.then(() => {
      if (cancelled) return
      dispose = initMachineScene(root, getComputedStyle(root).fontFamily, {
        embedded: embed,
        onStation: (id) => handlers.current.onStation?.(id),
        onReady: () => handlers.current.onReady?.(),
      })
    })
    return () => {
      cancelled = true
      dispose?.()
    }
  }, [embed])

  return (
    <div ref={rootRef} className={['agentic-factory-3d', embed && 'embed', className].filter(Boolean).join(' ')} style={{ height }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div
        id="scene"
        role="img"
        aria-label="Interactive 3D machine with five stations: Ingestion, Quality Checks, ML, Context and Decision Fusion. Drag to rotate, scroll or pinch to zoom. Hover or tap a station to take a closer look."
      />
      <div className="vignette" />
      <header className="topbar debug-ui">
        <div className="identity">
          <div className="mark">
            <Workflow size={17} />
          </div>
          <div>
            <strong>MeghDrishti</strong>
            <small>Weather intelligence pipeline</small>
          </div>
        </div>
        <div className="status" id="status">
          <i />
          <span id="status-text">Pipeline running</span>
          <span>SERIES 001</span>
        </div>
      </header>
      <div className="scene-heading debug-ui">
        From reading to evidence <span className="index">5 MODULES / 1 SYSTEM</span>
      </div>
      <div className="coordinates debug-ui">MEGHDRISHTI — FROM SENSOR TO DECISION</div>
      <div id="journey" className="debug-ui">
        <div className="journey-icon">
          <Package size={13} />
        </div>
        <div>
          <strong id="journey-title">New reading</strong>
          <small id="journey-detail">Ingestion · weather observation</small>
        </div>
        <div className="track">
          <i id="journey-progress" />
        </div>
      </div>
      <div id="labels" />
      <div id="tooltip" role="tooltip">
        <strong />
        <p />
      </div>
      <div className="controls debug-ui">
        <nav className="mode-bar" aria-label="Machine mode">
          <button type="button" data-mode="assembled" aria-pressed="true">
            <Box />
            Assembled
          </button>
          <button type="button" data-mode="cutaway" aria-pressed="false">
            <PanelsTopLeft />
            Cutaway
          </button>
          <button type="button" data-mode="stations" aria-pressed="false">
            <Layers />
            Stations
          </button>
          <button type="button" data-mode="reading" aria-pressed="false">
            <Play />
            One reading
          </button>
        </nav>
        <nav className="camera-row" aria-label="Camera">
          <span className="caption">VIEW</span>
          <button type="button" data-camera="overview" aria-pressed="true">
            Overview
          </button>
          <button type="button" data-camera="side" aria-pressed="false">
            Side
          </button>
          <button type="button" data-camera="top" aria-pressed="false">
            Top
          </button>
          <button type="button" data-camera="station" aria-pressed="false">
            Station
          </button>
          <button type="button" data-camera="flight" aria-pressed="false">
            Flight
          </button>
          <span className="divider" />
          <button type="button" id="play" aria-label="Pause the animation" aria-pressed="false">
            <Pause data-play-icon="pause" size={12} /><Play data-play-icon="play" size={12} style={{ display: 'none' }} />
          </button>
        </nav>
      </div>
      <footer className="footer">
        <a className="wordmark" href="https://vibecoding.tech" target="_blank" rel="noopener">
          made with AI agents · <span>vibecoding.tech</span>
        </a>
        <span className="footer-center debug-ui">DESIGNED BY YOU</span>
        <span className="hint debug-ui">
          <Mouse size={16} />
          Rotate. Zoom. Explore.
        </span>
      </footer>
      <div id="loading">
        <i />
        <span>Loading the weather pipeline</span>
      </div>
      <div id="error" role="alert">
        <strong>Could not start the 3D scene</strong>
        <p>Check that WebGL is turned on in your browser.</p>
        <button type="button" onClick={() => location.reload()}>Try again</button>
      </div>
    </div>
  )
}

// Weather-specific geometry and telemetry panels use the original scene's
// camera, picking, layout and lifecycle. All assets are procedural.

export type MachineMode = 'assembled' | 'cutaway' | 'stations' | 'reading'
export type MachineCamera = 'overview' | 'side' | 'top' | 'station' | 'flight'
export type StationId = 'qc' | 'ml' | 'context' | 'ingestion' | 'fusion'

export type MachineApi = {
  setMode: (name: string) => boolean
  focusStation: (id: string) => boolean
  setCamera: (name: string) => boolean
  play: () => boolean
  pause: () => boolean
}

declare global {
  interface Window {
    __machine?: MachineApi
    __machineDebug?: { getState: () => Record<string, unknown> }
  }
}

export type MachineSceneOptions = {
  embedded: boolean
  onStation?: (id: StationId) => void
  onReady?: () => void
}

function initMachineScene(root: HTMLElement, fontFamily: string, options: MachineSceneOptions): () => void {
  const frameWidth = () => root.clientWidth
  const frameHeight = () => root.clientHeight
  const cleanups: Array<() => void> = []
  // Every listener goes through here, so dispose() can take it off again.
  const listen = (target: EventTarget, type: string, handler: (event: never) => void) => {
    const fn = handler as unknown as EventListener
    target.addEventListener(type, fn)
    cleanups.push(() => target.removeEventListener(type, fn))
  }
  function $<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = root.querySelector<T>(`#${id}`)
    if (!el) throw new Error(`Scene markup is missing #${id}`)
    return el
  }
  function showError(message?: string) {
    $('loading').classList.add('done')
    $('error').style.display = 'block'
    if (message) $('error').querySelector('p')!.textContent = message
  }
  const dispose = () => {
    for (const fn of cleanups.reverse()) fn()
    cleanups.length = 0
  }
  try {
    const TAU = Math.PI * 2
    const embedded = options.embedded
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
    const palette = { amber: 0xff7a1a, white: 0xf4f1ea, dark: 0x171b21, steel: 0x59616b }
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(33, frameWidth() / frameHeight(), 0.1, 150)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      })
    } catch (e) {
      showError(
        'WebGL is not available. Turn on hardware acceleration in your browser settings and reload the page.'
      )
      throw e
    }
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(frameWidth(), frameHeight())
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.localClippingEnabled = true
    $('scene').appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.065
    controls.enablePan = false
    controls.minDistance = 7
    controls.maxDistance = 55
    controls.minPolarAngle = 0.09
    controls.maxPolarAngle = Math.PI * 0.475
    controls.rotateSpeed = 0.48
    controls.zoomSpeed = 0.7
    // Embedded in a landing page: the wheel and the finger scroll the page, not the scene.
    if (embedded) {
      controls.enableZoom = false
      if (matchMedia('(pointer:coarse)').matches) controls.enableRotate = false
    }
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment()
    const env = pmrem.fromScene(room, 0.04)
    scene.environment = env.texture
    scene.environmentIntensity = 0.62
    room.dispose()
    pmrem.dispose()
    scene.add(new THREE.HemisphereLight(0xdbe5f4, 0x29211a, 2))
    const key = new THREE.DirectionalLight(0xfff1d8, 4.2)
    key.position.set(-4, 12, 7)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, {
      left: -10,
      right: 10,
      top: 9,
      bottom: -9,
      near: 0.5,
      far: 35,
    })
    key.shadow.normalBias = 0.035
    key.shadow.bias = -0.0002
    key.shadow.radius = 4
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xc4d4ed, 3.1)
    rim.position.set(3, 7, -8)
    scene.add(rim)
    const warm = new THREE.PointLight(0xffbd42, 28, 20, 2)
    warm.position.set(-4, 5, 3)
    scene.add(warm)
    const front = new THREE.DirectionalLight(0xffffff, 1)
    front.position.set(5, 3, 10)
    scene.add(front)

    const mat = (
      color: number,
      metalness = 0.1,
      roughness = 0.4,
      extra: THREE.MeshStandardMaterialParameters = {}
    ) => new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra })
    const M = {
      body: mat(0x30363f, 0.75, 0.29),
      base: mat(0x292f37, 0.85, 0.32),
      edge: mat(0x707986, 0.85, 0.24),
      chrome: mat(0xc3cad0, 0.92, 0.18),
      dark: mat(0x12171d, 0.45, 0.38),
      rubber: mat(0x0b1015, 0.1, 0.6),
      amber: mat(palette.amber, 0.52, 0.28),
      ivory: mat(0xe0ded4, 0.48, 0.26),
      copper: mat(0xc57e45, 0.85, 0.3),
      black: mat(0x050909, 0, 0.6),
      light: mat(0xff7a1a, 0.2, 0.25, { emissive: 0xff7a1a, emissiveIntensity: 1.5 }),
      whiteLight: mat(0xfff3d7, 0.1, 0.3, { emissive: 0xfff0d0, emissiveIntensity: 1.8 }),
      green: mat(0xc6d9a1, 0.1, 0.3, { emissive: 0x91b364, emissiveIntensity: 0.7 }),
      glass: mat(0x81949e, 0.45, 0.16, { transparent: true, opacity: 0.19, depthWrite: false }),
      paper: mat(0xf4f1ea, 0, 0.85),
    }
    type Vec3 = [number, number, number]
    type Material = THREE.Material
    const geometries = new Map<string, THREE.BufferGeometry>()
    function boxGeo(w: number, h: number, d: number, r = 0.04) {
      const k = `b${w},${h},${d},${r}`
      if (!geometries.has(k))
        geometries.set(
          k,
          r
            ? new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 3, h / 3, d / 3))
            : new THREE.BoxGeometry(w, h, d)
        )
      return geometries.get(k)!
    }
    function box(
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      m: Material = M.body,
      r = 0.04
    ) {
      const o = new THREE.Mesh(boxGeo(w, h, d, r), m)
      o.position.set(x, y, z)
      o.castShadow = true
      o.receiveShadow = true
      parent.add(o)
      return o
    }
    function cyl(
      parent: THREE.Object3D,
      r: number,
      h: number,
      x: number,
      y: number,
      z: number,
      m: Material = M.chrome,
      r2: number = r,
      segments = 40
    ) {
      const k = `c${r},${r2},${h},${segments}`
      if (!geometries.has(k)) geometries.set(k, new THREE.CylinderGeometry(r, r2, h, segments))
      const o = new THREE.Mesh(geometries.get(k)!, m)
      o.position.set(x, y, z)
      o.castShadow = true
      o.receiveShadow = true
      parent.add(o)
      return o
    }
    function ball(
      parent: THREE.Object3D,
      r: number,
      x: number,
      y: number,
      z: number,
      m: Material = M.chrome
    ) {
      const k = `s${r}`
      if (!geometries.has(k)) geometries.set(k, new THREE.SphereGeometry(r, 32, 20))
      const o = new THREE.Mesh(geometries.get(k)!, m)
      o.position.set(x, y, z)
      parent.add(o)
      return o
    }
    function tube(parent: THREE.Object3D, pts: Vec3[], r: number, m: Material = M.chrome) {
      const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
      const o = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(12, pts.length * 7), r, 8, false),
        m
      )
      o.castShadow = true
      parent.add(o)
      return o
    }
    function screw(parent: THREE.Object3D, x: number, y: number, z: number) {
      cyl(parent, 0.055, 0.026, x, y, z, M.chrome, undefined, 12)
      box(parent, 0.068, 0.005, 0.009, x, y + 0.014, z, M.dark, 0)
    }
    type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void
    function canvasTexture(w: number, h: number, draw: Draw) {
      const c = document.createElement('canvas')
      c.width = w * 2
      c.height = h * 2
      const ctx = c.getContext('2d')!
      ctx.scale(2, 2)
      draw(ctx, w, h)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = renderer.capabilities.getMaxAnisotropy()
      return { texture: t, canvas: c, ctx }
    }
    function print(
      ctx: CanvasRenderingContext2D,
      txt: string,
      x: number,
      y: number,
      size = 20,
      color = '#f4f1ea',
      weight = 500
    ) {
      ctx.fillStyle = color
      ctx.font = `${weight} ${size}px ${fontFamily}`
      ctx.fillText(txt, x, y)
    }
    function screenMaterial(texture: THREE.Texture) {
      return new THREE.MeshBasicMaterial({ map: texture, toneMapped: false })
    }
    type Painted = THREE.Texture | { texture: THREE.Texture }
    function screen(
      parent: THREE.Object3D,
      w: number,
      h: number,
      x: number,
      y: number,
      z: number,
      tex: Painted
    ) {
      const map = 'texture' in tex ? tex.texture : tex
      const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), screenMaterial(map))

      o.position.set(x, y, z)
      parent.add(o)
      return o
    }
    const machine = new THREE.Group()
    scene.add(machine)
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70),
      new THREE.ShadowMaterial({ opacity: 0.23 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.43
    floor.receiveShadow = true
    scene.add(floor)
    const shadow = canvasTexture(128, 128, (c, w, h) => {
      const g = c.createRadialGradient(64, 64, 12, 64, 64, 64)
      g.addColorStop(0, 'rgba(0,0,0,.8)')
      g.addColorStop(0.55, 'rgba(0,0,0,.45)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = g
      c.fillRect(0, 0, w, h)
    })
    const contact = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 13),
      new THREE.MeshBasicMaterial({
        map: shadow.texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.65,
      })
    )
    contact.rotation.x = -Math.PI / 2
    contact.position.y = -0.415
    scene.add(contact)
    // A chamfered, layered platform with engraved nomenclature and captive screws.
    box(machine, 12.8, 0.38, 8.25, 0, -0.09, 0, M.base, 0.17)
    box(machine, 12.6, 0.055, 8.08, 0, 0.13, 0, M.edge, 0.11)
    box(machine, 12.49, 0.09, 7.96, 0, 0.19, 0, M.body, 0.1)
    box(machine, 12.55, 0.027, 8.02, 0, -0.19, 0, M.dark, 0.06)
    box(machine, 11.9, 0.026, 0.032, 0, -0.17, 4.115, M.light, 0.01)
    for (const x of [-5.6, 5.6])
      for (const z of [-3.35, 3.35]) {
        cyl(machine, 0.39, 0.25, x, -0.31, z, M.rubber)
        cyl(machine, 0.29, 0.09, x, -0.4, z, M.dark)
        screw(machine, x, 0.253, z)
      }
    for (const x of [-6.02, 6.02]) for (const z of [-3.73, 3.73]) screw(machine, x, 0.255, z)
    const engraving = canvasTexture(1536, 176, (c, w, h) => {
      c.fillStyle = '#252b32'
      c.fillRect(0, 0, w, h)
      c.strokeStyle = '#4d545c'
      c.lineWidth = 2
      c.strokeRect(2, 2, w - 4, h - 4)
      print(c, 'MEGHDRISHTI', 45, 79, 32, '#d9d8cd', 650)
      print(c, 'QC  /  ML  /  CONTEXT  /  FUSION', 410, 79, 34, '#b8bdc1', 450)
      print(c, 'FASTAPI    /    CELERY    /    REDIS    /    POSTGRESQL', 47, 133, 19, '#737e88', 500)
      print(c, 'No. 001', 1360, 130, 23, '#c57e45')
    })
    const plate = screen(machine, 7.35, 0.84, -0.4, 0.25, 3.51, engraving)
    plate.rotation.x = -Math.PI / 2
    for (let i = 0; i < 16; i++)
      box(machine, 0.015, 0.009, 0.11 + (i % 4) * 0.035, -5.6 + i * 0.09, 0.249, 3.5, M.edge, 0)
    // Faint drafting marks stay local to the machine, leaving the headline area empty.
    const drafting = new THREE.Group()
    scene.add(drafting)
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x69717a,
      transparent: true,
      opacity: 0.12,
    })
    const draftingPoints = []
    for (const r of [7.5, 8.1])
      for (let i = 0; i < 120; i++)
        for (const j of [i, i + 1]) {
          const a = (j / 120) * TAU
          draftingPoints.push(new THREE.Vector3(Math.cos(a) * r, -0.4, Math.sin(a) * r * 0.72))
        }
    for (let i = 0; i < 52; i++) {
      const a = (i / 52) * TAU,
        r = 8.1
      draftingPoints.push(
        new THREE.Vector3(Math.cos(a) * r, -0.395, Math.sin(a) * r * 0.72),
        new THREE.Vector3(
          Math.cos(a) * (r + (i % 4 === 0 ? 0.16 : 0.07)),
          -0.395,
          Math.sin(a) * (r + (i % 4 === 0 ? 0.16 : 0.07)) * 0.72
        )
      )
    }
    drafting.add(
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(draftingPoints), lineMat)
    )

    // The five stations, left to right along the belt. `step` is the station's place in the
    // reading flow (ingestion, rules, model, context, decision); `output` is what it hands on.
    type StationDef = {
      id: StationId
      name: string
      step: number
      output: string
      pos: Vec3
      desc: string
    }
    type Station = StationDef & {
      group: THREE.Group
      base: THREE.Vector3
      glowMat: THREE.MeshStandardMaterial
      label: HTMLDivElement
      index: number
      anchor: THREE.Vector3
    }
    const definitions: StationDef[] = [
      {
        id: 'qc',
        name: 'Quality checks',
        step: 2,
        output: 'rule evidence',
        pos: [-4.15, 0.29, -0.65],
        desc: 'Deterministic checks detect spikes, drift, missing data and physical limits.',
      },
      {
        id: 'ml',
        name: 'ML',
        step: 3,
        output: 'model evidence',
        pos: [-1.65, 0.29, -2.03],
        desc: 'Isolation Forest scores unusual readings when an approved model is active.',
      },
      {
        id: 'context',
        name: 'Context',
        step: 4,
        output: 'context evidence',
        pos: [1.5, 0.29, -2.08],
        desc: 'Nearby stations and Open-Meteo forecasts add context; ERA5 and GPM are optional.',
      },
      {
        id: 'ingestion',
        name: 'Ingestion',
        step: 1,
        output: 'observation',
        pos: [4.03, 0.29, 0.12],
        desc: 'Source adapters normalize weather readings. FastAPI, Celery and PostgreSQL carry the pipeline.',
      },
      {
        id: 'fusion',
        name: 'Fusion',
        step: 5,
        output: 'decision',
        pos: [0.93, 0.29, 1.85],
        desc: 'Rule, model and context evidence become an explainable decision and operator alert.',
      },
    ]
    const stations: Station[] = [],
      cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10),
      shellMaterials: THREE.Material[] = []
    function shell<T extends THREE.Material>(m: T): T {
      const s = m.clone() as T
      s.clippingPlanes = [cutPlane]
      s.clipShadows = true
      s.side = THREE.DoubleSide
      shellMaterials.push(s)
      return s
    }
    const S = {
      body: shell(M.body),
      ivory: shell(M.ivory),
      amber: shell(M.amber),
      edge: shell(M.edge),
    }
    definitions.forEach((d, i) => {
      const group = new THREE.Group()
      group.position.fromArray(d.pos)
      machine.add(group)
      const glowMat = M.light.clone()
      glowMat.emissiveIntensity = 0.5
      box(group, 2.05, 0.12, 1.78, 0, 0.03, 0, M.dark, 0.1)
      box(group, 1.97, 0.03, 1.7, 0, 0.12, 0, glowMat, 0.09)
      box(group, 2.03, 0.17, 1.75, 0, 0.215, 0, M.body, 0.1)
      for (const x of [-0.85, 0.85]) for (const z of [-0.7, 0.7]) screw(group, x, 0.311, z)
      // Circuit traces and heat sinks under the module housings.
      box(group, 1.65, 0.04, 1.3, 0, 0.34, 0, M.dark, 0.02)
      for (let j = 0; j < 5; j++) {
        box(group, 1.35, 0.016, 0.022, 0, 0.37, -0.45 + j * 0.22, M.copper, 0)
        box(group, 0.25, 0.12, 0.2, -0.55 + j * 0.27, 0.41, 0, M.edge, 0.015)
      }
      const plaque = canvasTexture(512, 116, (c, w, h) => {
        c.fillStyle = '#151a20'
        c.fillRect(0, 0, w, h)
        print(c, String(d.step).padStart(2, '0'), 24, 76, 42, '#ff7a1a', 550)
        print(c, d.name.toUpperCase(), 111, 73, 26, '#d7d9d7', 550)
      })
      screen(group, 1.54, 0.345, 0, 0.27, 0.891, plaque)
      const label = document.createElement('div')
      label.className = 'station-label'
      const stem = document.createElement('div')
      stem.className = 'stem'
      const card = document.createElement('div')
      card.className = 'label-card'
      const title = document.createElement('div')
      title.className = 'label-title'
      const num = document.createElement('span')
      num.textContent = String(d.step).padStart(2, '0')
      title.append(num, document.createTextNode(d.name))
      const meta = document.createElement('div')
      meta.className = 'label-meta'
      meta.textContent = `Step ${d.step} · ${d.output}`
      card.append(title, meta)
      label.append(stem, card)
      $('labels').appendChild(label)
      cleanups.push(() => label.remove())

      stations.push({
        ...d,
        group,
        base: new THREE.Vector3(...d.pos),
        glowMat,
        label,
        index: i,
        anchor: new THREE.Vector3(0, 2.5, 0),
      })
    })
    // Weather-specific artifacts: diagnostics, model compute, forecast context,
    // an automatic weather station, and an operator alert terminal.
    function telemetryPanel(title: string, rows: string[], accent = '#ff7a1a') {
      return canvasTexture(640, 400, (c, w, h) => {
        c.fillStyle = '#101923'
        c.fillRect(0, 0, w, h)
        print(c, title, 30, 54, 26, '#eef2f5', 650)
        c.fillStyle = accent
        c.fillRect(30, 78, w - 60, 3)
        rows.forEach((row, i) => {
          print(c, row, 30, 125 + i * 52, 22, '#b4c6d4', 500)
          c.fillStyle = '#283645'
          c.fillRect(30, 144 + i * 52, w - 60, 1)
        })
        print(c, 'MEGHDRISHTI / ARCHITECTURE', 30, 376, 15, accent, 550)
      })
    }
    const qcTexture = telemetryPanel('QUALITY CONTROL', ['Physical range', 'Spike / drift', 'Time consistency', 'Rule evidence'])
    const modelTexture = telemetryPanel('ISOLATION FOREST', ['Feature vectors', 'Candidate models', 'Explicit activation', 'Anomaly evidence'], '#8bb7dc')
    const contextTexture = telemetryPanel('WEATHER CONTEXT', ['Open-Meteo forecast', 'Neighbor stations', 'Optional ERA5 / GPM', 'Weather agreement'], '#96c6b0')
    const observationTexture = telemetryPanel('WEATHER INGESTION', ['Temperature / humidity', 'Pressure / rainfall', 'Wind speed / direction', 'Canonical observation'])
    const decisionTexture = telemetryPanel('OPERATOR DECISION', ['Rule + model + context', 'Reason codes', 'Station health', 'Redis / WebSocket alerts'])

    // QC is a diagnostic instrument with a waveform display and reference probes.
    const qc = stations[0].group
    box(qc, 1.65, 1.2, 1.1, 0, 0.97, -0.1, S.ivory, 0.09)
    box(qc, 1.46, 0.84, 0.08, 0, 1.13, 0.48, M.dark, 0.04)
    screen(qc, 1.33, 0.74, 0, 1.13, 0.527, qcTexture)
    for (let i = 0; i < 3; i++) {
      const x = -0.48 + i * 0.48
      const port = cyl(qc, 0.09, 0.09, x, 0.62, 0.51, M.chrome)
      port.rotation.x = Math.PI / 2
      ball(qc, 0.035, x, 0.62, 0.565, M.light)
    }
    const waveform = canvasTexture(640, 240, (c, w, h) => {
      c.fillStyle = '#111b26'; c.fillRect(0, 0, w, h)
      c.strokeStyle = '#283746'; c.lineWidth = 1
      for (let x = 20; x < w; x += 40) { c.beginPath(); c.moveTo(x, 20); c.lineTo(x, h - 20); c.stroke() }
      c.strokeStyle = '#ff9a4d'; c.lineWidth = 4; c.beginPath()
      for (let x = 20; x < w - 20; x += 3) {
        const y = 120 + Math.sin(x * 0.035) * 38 + (x > 330 && x < 350 ? -68 : 0)
        if (x === 20) c.moveTo(x, y); else c.lineTo(x, y)
      }
      c.stroke()
    })
    box(qc, 1.46, 0.58, 0.12, 0, 1.9, -0.13, S.body, 0.04)
    screen(qc, 1.3, 0.48, 0, 1.9, -0.063, waveform)
    cyl(qc, 0.045, 0.36, -0.45, 1.66, -0.13, M.chrome)
    cyl(qc, 0.045, 0.36, 0.45, 1.66, -0.13, M.chrome)

    // ML compute: rack servers and a branching decision-tree schematic.
    const ml = stations[1].group
    box(ml, 1.55, 1.7, 1.05, 0, 1.25, -0.14, S.body, 0.08)
    for (let row = 0; row < 4; row++) {
      const y = 0.66 + row * 0.35
      box(ml, 1.35, 0.27, 0.08, 0, y, 0.426, M.dark, 0.025)
      for (let slot = 0; slot < 6; slot++) box(ml, 0.075, 0.12, 0.015, -0.45 + slot * 0.14, y, 0.475, M.edge, 0.008)
      ball(ml, 0.032, 0.49, y, 0.49, row === 0 ? M.light : M.green)
    }
    const tree = new THREE.Group()
    ml.add(tree)
    const treePoints: Vec3[] = [[0, 2.65, 0], [-0.45, 2.32, 0], [0.45, 2.32, 0], [-0.7, 2.04, 0], [-0.22, 2.04, 0], [0.22, 2.04, 0], [0.7, 2.04, 0]]
    for (const [a, b] of [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]]) tube(tree, [treePoints[a], treePoints[b]], 0.019, M.chrome)
    treePoints.forEach(([x, y, z], i) => ball(tree, i === 0 ? 0.1 : 0.075, x, y, z, i === 0 ? M.light : M.green))
    screen(ml, 1.05, 0.66, 0, 1.98, 0.5, modelTexture)

    // Context: a weather radome, antenna dish and a forecast map.
    const context = stations[2].group
    cyl(context, 0.37, 0.18, -0.46, 0.47, -0.1, M.edge)
    cyl(context, 0.09, 0.75, -0.46, 0.9, -0.1, M.chrome)
    const dish = new THREE.Group()
    dish.position.set(-0.46, 1.65, -0.1)
    dish.rotation.z = -0.28
    context.add(dish)
    const reflector = new THREE.Mesh(new THREE.SphereGeometry(0.66, 48, 24, 0, TAU, Math.PI / 2, Math.PI / 2), S.ivory)
    reflector.material.side = THREE.DoubleSide
    dish.add(reflector)
    for (const angle of [0, TAU / 3, TAU * 2 / 3]) tube(dish, [[Math.cos(angle) * 0.58, -0.13, Math.sin(angle) * 0.58], [0, 0.4, 0]], 0.018, M.chrome)
    ball(dish, 0.075, 0, 0.4, 0, M.light)
    const radome = ball(context, 0.39, 0.57, 1.3, -0.28, S.ivory)
    cyl(context, 0.17, 0.62, 0.57, 0.86, -0.28, M.body)
    radome.scale.y = 1.18
    const mapTexture = canvasTexture(640, 400, (c, w, h) => {
      c.fillStyle = '#101e28'; c.fillRect(0, 0, w, h)
      c.strokeStyle = '#29424d'; c.lineWidth = 1
      for (let x = 0; x < w; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke() }
      for (let y = 0; y < h; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke() }
      for (let i = 0; i < 4; i++) {
        c.strokeStyle = ['#487e83', '#5c9893', '#78bba3', '#96ceae'][i]; c.lineWidth = 3
        c.beginPath(); c.ellipse(325, 200, 70 + i * 45, 45 + i * 26, -0.4, 0, TAU); c.stroke()
      }
      for (const [x, y] of [[170, 150], [320, 210], [470, 130]]) { c.fillStyle = '#ff9a4d'; c.beginPath(); c.arc(x, y, 7, 0, TAU); c.fill() }
      print(c, 'FORECAST + NEIGHBORS', 24, 36, 21, '#deeee8', 600)
      print(c, 'ILLUSTRATIVE WEATHER CONTEXT', 24, 376, 14, '#96c6b0')
    })
    box(context, 1.55, 1.01, 0.14, 0.2, 1.08, 0.48, S.body, 0.06)
    screen(context, 1.42, 0.89, 0.2, 1.08, 0.557, mapTexture)

    // Ingestion: an automatic weather station with cup anemometer,
    // wind vane, radiation shield and a tipping-bucket rain gauge.
    const ingestion = stations[3].group
    cyl(ingestion, 0.065, 2.7, -0.12, 1.75, -0.18, M.chrome)
    box(ingestion, 1.65, 0.06, 0.06, -0.12, 2.66, -0.18, M.chrome, 0.015)
    const anemometer = new THREE.Group()
    anemometer.position.set(-0.85, 2.9, -0.18)
    anemometer.userData.moving = true
    ingestion.add(anemometer)
    cyl(ingestion, 0.035, 0.26, -0.85, 2.77, -0.18, M.chrome)
    for (let i = 0; i < 3; i++) {
      const angle = i * TAU / 3
      tube(anemometer, [[0, 0, 0], [Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35]], 0.016, M.chrome)
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16, 0, Math.PI), M.dark)
      cup.position.set(Math.cos(angle) * 0.35, 0, Math.sin(angle) * 0.35)
      cup.rotation.y = -angle
      anemometer.add(cup)
    }
    const vane = new THREE.Group()
    vane.position.set(0.61, 2.84, -0.18)
    vane.userData.moving = true
    ingestion.add(vane)
    box(vane, 0.64, 0.025, 0.025, 0, 0, 0, M.chrome, 0.005)
    box(vane, 0.22, 0.18, 0.015, 0.23, 0.06, 0, M.amber, 0.01)
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.19, 3), M.chrome)
    arrow.rotation.z = Math.PI / 2; arrow.position.x = -0.36; vane.add(arrow)
    for (let i = 0; i < 7; i++) cyl(ingestion, 0.24 - Math.abs(i - 3) * 0.008, 0.04, -0.12, 1.64 + i * 0.08, -0.18, S.ivory)
    tube(ingestion, [[-0.12, 1.62, -0.18], [0.25, 1.4, -0.18], [0.35, 0.65, -0.18]], 0.018, M.dark)
    cyl(ingestion, 0.32, 0.72, 0.55, 0.83, 0.24, S.ivory)
    cyl(ingestion, 0.43, 0.25, 0.55, 1.31, 0.24, M.chrome, 0.28)
    cyl(ingestion, 0.37, 0.008, 0.55, 1.443, 0.24, M.dark)
    box(ingestion, 0.65, 0.58, 0.34, -0.55, 0.79, 0.27, S.body, 0.04)
    screen(ingestion, 0.57, 0.38, -0.55, 0.84, 0.447, observationTexture)

    // Fusion: operator terminal, stacked evidence indicators and an alert beacon.
    const fusion = stations[4].group
    box(fusion, 1.65, 0.28, 1.14, 0, 0.53, 0, S.body, 0.07)
    cyl(fusion, 0.09, 0.6, -0.2, 0.88, -0.12, M.chrome)
    box(fusion, 1.62, 1.03, 0.16, -0.2, 1.52, -0.12, S.ivory, 0.07)
    screen(fusion, 1.46, 0.9, -0.2, 1.52, -0.029, decisionTexture)
    box(fusion, 0.92, 0.04, 0.28, -0.2, 0.7, 0.38, M.dark, 0.02)
    for (let i = 0; i < 3; i++) box(fusion, 0.7, 0.01, 0.025, -0.2, 0.725, 0.3 + i * 0.07, M.edge, 0.005)
    cyl(fusion, 0.055, 1.36, 0.73, 1.12, 0.16, M.chrome)
    cyl(fusion, 0.17, 0.23, 0.73, 1.94, 0.16, M.dark)
    const beaconMaterial = M.light.clone()
    const alertBeacon = cyl(fusion, 0.155, 0.22, 0.73, 2.12, 0.16, beaconMaterial)
    alertBeacon.userData.moving = true
    cyl(fusion, 0.17, 0.04, 0.73, 2.25, 0.16, M.chrome)
    for (let i = 0; i < 3; i++) box(fusion, 0.15, 0.09, 0.12, 0.52, 0.8 + i * 0.15, 0.45, i === 2 ? M.light : M.green, 0.02)

    // Conveyor: a closed spline, instanced treads, continuous rails and phase-locked cargo.
    const path = new THREE.CatmullRomCurve3(
      [
        [-3.95, 0.84, 0.65],
        [-3.1, 0.84, -0.12],
        [-1.45, 0.84, -0.79],
        [1.32, 0.84, -0.8],
        [3.3, 0.84, 0.19],
        [3.43, 0.84, 1.21],
        [1.35, 0.84, 2.7],
        [-1.4, 0.84, 2.52],
        [-3.54, 0.84, 1.65],
      ].map((p) => new THREE.Vector3(...p)),
      true,
      'catmullrom',
      0.25
    )
    // A luminous data bus carries observations between the processing modules.
    const dataBus = new THREE.Group()
    machine.add(dataBus)
    dataBus.add(new THREE.Mesh(new THREE.TubeGeometry(path, 180, 0.045, 12, true), M.edge))
    dataBus.add(new THREE.Mesh(new THREE.TubeGeometry(path, 180, 0.018, 10, true), M.light))
    const links = new THREE.Group()
    machine.add(links)
    for (const station of stations) {
      const port = path.getPointAt(nearestPort(station.base.x, station.base.z))
      tube(links, [[station.base.x, 0.38, station.base.z], [station.base.x, 0.5, station.base.z], [port.x, 0.5, port.z], [port.x, port.y, port.z]], 0.023, M.copper)
    }
    const packetTextures = [observationTexture, qcTexture, modelTexture, contextTexture, decisionTexture]
    const packets: Array<{
      group: THREE.Group
      faces: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[]
      halo: THREE.Mesh
      stage: number
      phase: number
    }> = []
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group()
      g.userData.moving = true
      machine.add(g)
      box(g, 0.42, 0.27, 0.12, 0, 0, 0, M.dark, 0.035)
      const faces = packetTextures.map((tex) => {
        const s = screen(g, 0.39, 0.24, 0, 0, 0.067, tex)
        s.material.side = THREE.DoubleSide
        s.visible = false
        return s
      })
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.414, 40),
        new THREE.MeshBasicMaterial({
          color: 0xff7a1a,
          transparent: true,
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      )
      halo.rotation.x = -Math.PI / 2
      halo.position.y = -0.37
      g.add(halo)
      halo.visible = false
      packets.push({ group: g, faces, halo, stage: -1, phase: 0 })
    }
    let modelPort = 0.2,
      contextPort = 0.37,
      decisionPort = 0.72
    // Find ports by arc length, so the travelling observation arrives at the actual station.
    function nearestPort(x: number, z: number) {
      let best = 0,
        dist = Infinity
      for (let i = 0; i < 300; i++) {
        const p = path.getPointAt(i / 300),
          d = (p.x - x) ** 2 + (p.z - z) ** 2
        if (d < dist) {
          dist = d
          best = i / 300
        }
      }
      return best
    }
    modelPort = nearestPort(-1.65, -0.7)
    contextPort = nearestPort(1.5, -0.7)
    decisionPort = nearestPort(0.93, 2.65)

    // Merge static geometry per parent/material. Moving assemblies remain separate.
    function compact(group: THREE.Object3D) {
      for (const child of [...group.children]) if ((child as THREE.Group).isGroup) compact(child)
      const buckets = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]>()
      for (const object of group.children) {
        const child = object as THREE.Mesh<THREE.BufferGeometry, THREE.Material> & {
          isInstancedMesh?: boolean
        }
        if (
          !child.isMesh ||
          child.isInstancedMesh ||
          child.userData.moving ||
          Array.isArray(child.material)
        )
          continue
        const key = child.material.uuid
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key)!.push(child)
      }
      for (const list of buckets.values()) {
        if (list.length < 2) continue
        const geos = list.map((m) => {
          m.updateMatrix()
          const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()
          return g.applyMatrix4(m.matrix)
        })
        const merged = mergeGeometries(geos, false)
        for (const geo of geos) geo.dispose()
        if (!merged) continue
        const mesh = new THREE.Mesh(merged, list[0].material)
        mesh.castShadow = list.some((x) => x.castShadow)
        mesh.receiveShadow = list.some((x) => x.receiveShadow)
        for (const m of list) group.remove(m)
        group.add(mesh)
      }
    }
    compact(machine)
    stations.forEach((s) =>
      s.group.traverse((o) => {
        o.userData.station = s.id
      })
    )
    const pickables = stations.map((s) => s.group)

    let mode: MachineMode = 'assembled',
      cameraMode: MachineCamera = 'overview',
      playing = !reduceMotion,
      simTime = 0,
      spread = 0,
      selected: string = 'qc',
      hovered: string | null = null

    let width = frameWidth(),
      height = frameHeight(),
      mobile = width <= 900,
      lastInteraction = performance.now(),
      dragging = false,
      wasDragged = false,
      downX = 0,
      downY = 0
    let cameraAnimating = true,
      flightTime = 0,
      visible = true,
      contextLost = false
    const desiredPosition = new THREE.Vector3(),
      desiredTarget = new THREE.Vector3(0, 1, 0)
    const viewDirection = new THREE.Vector3(10.5, 10.8, 17).normalize()
    let baseDistance = 25,
      sized = false,
      readySent = false
    // A zero-size embed (an iframe inside a collapsed panel) used to send the camera to infinity: aspect 0
    // put NaN into the uniforms and left the scene black for good. Wait for a real size; the first real
    // size places the camera at once, without a fly-in.
    function layoutCamera() {
      if (!frameWidth() || !frameHeight()) return
      const first = !sized
      sized = true
      width = frameWidth()
      height = frameHeight()
      mobile = width <= 900
      renderer.setSize(width, height)
      camera.aspect = width / height
      // Embedded in a wide landing hero, a shifted frustum centers the object in the right 58%
      // (the host page's headline goes on the left), without moving the orbit target. The full
      // page and narrow frames keep the machine in the middle.
      camera.setViewOffset(
        width,
        height,
        mobile || !embedded ? 0 : -width * 0.21,
        mobile || embedded ? 0 : height * 0.025,
        width,
        height
      )
      const aspect = width / height
      const availableWidth = mobile ? 0.91 : Math.min(0.55, aspect > 2 ? 0.54 : 0.57)
      const horizontalFit =
        17.3 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect * availableWidth)
      const verticalFit =
        11.5 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (embedded ? 0.85 : 0.62))
      baseDistance =
        (Math.max(horizontalFit, verticalFit) * (mobile ? 0.97 : 1)) /
        (embedded ? (mobile ? 1.15 : 1.45) : 1)
      controls.maxDistance = Math.max(55, baseDistance * 1.6)
      camera.updateProjectionMatrix()
      setCameraGoal()
      cameraAnimating = true
      if (first) {
        camera.position.copy(desiredPosition)
        controls.target.copy(desiredTarget)
        controls.update()
        cameraAnimating = false
      }
    }
    function setCameraGoal() {
      const expand = mode === 'stations' ? 1.2 : 1
      if (cameraMode === 'station') {
        const s = stations.find((s) => s.id === selected)!
        desiredTarget.copy(s.group.position).add(new THREE.Vector3(0, 1.25, 0))
        desiredPosition.copy(desiredTarget).addScaledVector(viewDirection, mobile ? 9 : 12)
      } else {
        desiredTarget.set(0, 1, 0)
        const distance = baseDistance * expand
        if (cameraMode === 'side')
          desiredPosition.set(13, 5, 20).normalize().multiplyScalar(distance).add(desiredTarget)
        else if (cameraMode === 'top') desiredPosition.set(0.01, distance, 0.8).add(desiredTarget)
        else desiredPosition.copy(viewDirection).multiplyScalar(distance).add(desiredTarget)
      }
    }
    function syncButtons() {
      root
        .querySelectorAll<HTMLElement>('[data-mode]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)))
      root
        .querySelectorAll<HTMLElement>('[data-camera]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.camera === cameraMode)))
      $('journey').classList.toggle('visible', mode === 'reading')
    }
    const modeAliases: Record<string, MachineMode> = {
      Assembled: 'assembled',
      Cutaway: 'cutaway',
      Stations: 'stations',
      'One reading': 'reading',
      assembled: 'assembled',
      cutaway: 'cutaway',
      stations: 'stations',
      reading: 'reading',
    }
    const cameraAliases: Record<string, MachineCamera> = {
      Overview: 'overview',
      Side: 'side',
      Top: 'top',
      Station: 'station',
      Flight: 'flight',
      overview: 'overview',
      side: 'side',
      top: 'top',
      station: 'station',
      flight: 'flight',
    }
    function setMode(name: string) {
      if (!Object.hasOwn(modeAliases, name)) return false
      const next = modeAliases[name]
      mode = next
      lastInteraction = performance.now()
      if (mode === 'reading') {
        simTime = 0
        play()
        cameraMode = 'overview'
      } else if (cameraMode === 'station') cameraMode = 'overview'
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }
    function focusStation(id: string) {
      const s = stations.find((s) => s.id === id)
      if (!s) return false
      selected = id
      if (mode === 'reading') mode = 'assembled'
      cameraMode = 'station'
      lastInteraction = performance.now()
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }
    function setCamera(name: string) {
      if (!Object.hasOwn(cameraAliases, name)) return false
      const next = cameraAliases[name]
      cameraMode = next
      if (mode === 'reading') mode = 'assembled'
      lastInteraction = performance.now()
      flightTime = 0
      setCameraGoal()
      cameraAnimating = true
      syncButtons()
      return true
    }
    function syncPlayback() {
      const b = $('play')
      b.setAttribute('aria-label', playing ? 'Pause the animation' : 'Resume the animation')
      b.setAttribute('aria-pressed', String(!playing))
      b.querySelector<SVGElement>('[data-play-icon="pause"]')!.style.display = playing ? 'block' : 'none'
      b.querySelector<SVGElement>('[data-play-icon="play"]')!.style.display = playing ? 'none' : 'block'
      $('status').classList.toggle('paused', !playing)
      $('status-text').textContent = playing ? 'Pipeline running' : 'Pipeline paused'
    }
    function play() {
      playing = true
      syncPlayback()
      return true
    }
    function pause() {
      playing = false
      syncPlayback()
      return true
    }
    const api: MachineApi = { setMode, focusStation, setCamera, play, pause }
    window.__machine = api
    cleanups.push(() => {
      if (window.__machine === api) delete window.__machine
    })
    root
      .querySelectorAll<HTMLElement>('[data-mode]')
      .forEach((b) => listen(b, 'click', () => setMode(b.dataset.mode ?? '')))
    root
      .querySelectorAll<HTMLElement>('[data-camera]')
      .forEach((b) => listen(b, 'click', () => setCamera(b.dataset.camera ?? '')))
    listen($('play'), 'click', () => (playing ? pause() : play()))
    syncPlayback()
    layoutCamera()
    camera.position.copy(desiredPosition)
    controls.target.copy(desiredTarget)
    controls.update()
    cameraAnimating = false
    listen(window, 'resize', layoutCamera)
    const resizeObserver = new ResizeObserver(layoutCamera)
    resizeObserver.observe(root)
    cleanups.push(() => resizeObserver.disconnect())
    controls.addEventListener('start', () => {
      dragging = true
      cameraAnimating = false
      lastInteraction = performance.now()
    })
    controls.addEventListener('end', () => {
      dragging = false
      lastInteraction = performance.now()
    })
    controls.addEventListener('change', () => {
      if (dragging) lastInteraction = performance.now()
    })
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      tooltip = $('tooltip')
    function hitStation(x: number, y: number) {
      pointer.set((x / width) * 2 - 1, (-y / height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(pickables, true)
      return hits.length ? stations.find((s) => s.id === hits[0].object.userData.station) : null
    }
    listen(renderer.domElement, 'pointermove', (e: PointerEvent) => {
      if (Math.hypot((e.clientX - root.getBoundingClientRect().left) - downX, (e.clientY - root.getBoundingClientRect().top) - downY) > 5) wasDragged = true
      if (dragging) return
      const s = hitStation((e.clientX - root.getBoundingClientRect().left), (e.clientY - root.getBoundingClientRect().top))
      hovered = s ? s.id : null
      renderer.domElement.style.cursor = s ? 'pointer' : 'grab'
      tooltip.classList.toggle('visible', !!s)
      if (s) {
        const strong = tooltip.querySelector('strong')!
        strong.textContent = ''
        const sNum = document.createElement('span')
        sNum.textContent = String(s.step).padStart(2, '0')
        strong.append(sNum, document.createTextNode(s.name))
        tooltip.querySelector('p')!.textContent = s.desc
        tooltip.style.left = Math.min(width - 255, Math.max(10, (e.clientX - root.getBoundingClientRect().left) + 16)) + 'px'
        tooltip.style.top = Math.max(10, Math.min(height - 95, (e.clientY - root.getBoundingClientRect().top) - 65)) + 'px'
      }
    })
    listen(renderer.domElement, 'pointerleave', () => {
      hovered = null
      tooltip.classList.remove('visible')
    })
    listen(renderer.domElement, 'pointerdown', (e: PointerEvent) => {
      downX = (e.clientX - root.getBoundingClientRect().left)
      downY = (e.clientY - root.getBoundingClientRect().top)
      wasDragged = false
      tooltip.classList.remove('visible')
    })
    listen(renderer.domElement, 'pointerup', (e: PointerEvent) => {
      if (wasDragged) return
      const s = hitStation((e.clientX - root.getBoundingClientRect().left), (e.clientY - root.getBoundingClientRect().top))
      if (!s) return
      focusStation(s.id)
      options.onStation?.(s.id)
    })
    listen(document, 'visibilitychange', () => {
      visible = !document.hidden
      lastFrame = performance.now()
    })
    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting && !document.hidden
        lastFrame = performance.now()
      },
      { threshold: 0.01 }
    )
    observer.observe(renderer.domElement)
    cleanups.push(() => observer.disconnect())
    listen(renderer.domElement, 'webglcontextlost', (e: Event) => {
      e.preventDefault()
      contextLost = true
      showError(
        'The graphics context was interrupted. The scene comes back on its own once WebGL is available again.'
      )
    })
    listen(renderer.domElement, 'webglcontextrestored', () => {
      contextLost = false
      $('error').style.display = 'none'
      lastFrame = performance.now()
    })

    const scratch = new THREE.Vector3(),
      anchor = new THREE.Vector3()
    const journeySteps = [
      ['New reading', 'Ingestion · weather observation'],
      ['Quality checks', 'QC · deterministic rule evidence'],
      ['Model scoring', 'ML · approved Isolation Forest model'],
      ['Context checks', 'Context · forecasts and nearby stations'],
      ['Decision fusion', 'Fusion · explainable operator alert'],
    ]
    let prevJourney = -1,
      lastFrame = performance.now()
    let lastRender = -Infinity
    let rafId = 0
    function animate(now: number) {
      rafId = requestAnimationFrame(animate)
      // ponytail: 30 fps bounds GPU work; retain sharp Retina resolution.
      if (now - lastRender < 1000 / 30 - 0.5) return
      lastRender = now
      const dt = Math.max(0, Math.min((now - lastFrame) / 1000, 0.045))
      lastFrame = now
      if (!visible || contextLost) return
      if (playing) {
        simTime += dt
        flightTime += dt
      }
      const t = simTime,
        tact = (t * TAU) / 4,
        smooth = 1 - Math.exp(-dt * 5)
      spread = THREE.MathUtils.lerp(spread, mode === 'stations' ? 1 : 0, smooth)
      cutPlane.constant = THREE.MathUtils.lerp(
        cutPlane.constant,
        mode === 'cutaway' ? 0.99 : 10,
        smooth
      )
      stations.forEach((s, i) => {
        s.group.position.copy(s.base)
        s.group.position.x *= 1 + spread * 0.29
        s.group.position.z *= 1 + spread * 0.37
        s.group.position.y += spread * (i % 2 ? 0.32 : 0.55)
        const pulse = Math.pow(Math.max(0, Math.sin(tact - i * 0.9)), 7)
        s.glowMat.emissiveIntensity = THREE.MathUtils.lerp(
          s.glowMat.emissiveIntensity,
          hovered === s.id || (cameraMode === 'station' && selected === s.id)
            ? 3.5
            : 0.55 + pulse * 0.65,
          smooth
        )
      })
      dataBus.scale.set(1 + spread * 0.12, 1, 1 + spread * 0.15)
      links.scale.set(1 + spread * 0.25, 1, 1 + spread * 0.3)
      anemometer.rotation.y = t * 1.4
      vane.rotation.y = Math.sin(t * 0.35) * 0.3
      beaconMaterial.emissiveIntensity = 0.8 + Math.max(0, Math.sin(tact)) * 1.2
      packets.forEach((packet, i) => {
        const phase = (t / 24 + i / 6) % 1
        packet.phase = phase
        let stage
        if (phase < 0.15) {
          stage = 0
          const f = phase / 0.15
          packet.group.position.copy(stations[3].group.position).add(new THREE.Vector3(0, 1.6, 0.6))
          scratch.copy(stations[0].group.position).add(new THREE.Vector3(0, 1.3, 0.65))
          packet.group.position.lerp(scratch, f)
          packet.group.position.y += Math.sin(f * Math.PI) * 2
          packet.group.rotation.set(0, Math.sin(f * Math.PI) * 0.28, Math.sin(f * Math.PI) * -0.1)
        } else {
          const u = ((phase - 0.15) / 0.85) * decisionPort
          path.getPointAt(u, packet.group.position)
          packet.group.position.x *= 1 + spread * 0.12
          packet.group.position.z *= 1 + spread * 0.15
          packet.group.position.y += 0.43
          packet.group.rotation.set(0, 0.18, 0)
          stage = u < modelPort * 0.7 ? 1 : u < contextPort * 0.96 ? 2 : u < decisionPort * 0.83 ? 3 : 4
        }
        if (packet.stage !== stage) {
          packet.faces.forEach((f, j) => (f.visible = j === stage))
          packet.stage = stage
        }
        packet.group.visible = mode !== 'reading' || i === 0
        packet.halo.visible = mode === 'reading' && i === 0
        packet.group.scale.setScalar(mode === 'reading' ? 1.35 : 1)
        if (phase > 0.94) packet.group.scale.multiplyScalar(Math.max(0.05, (1 - phase) / 0.06))
      })
      if (mode === 'reading') {
        const packet = packets[0],
          step = packet.stage
        if (step !== prevJourney) {
          $('journey-title').textContent = journeySteps[step][0]
          $('journey-detail').textContent = journeySteps[step][1]
          prevJourney = step
        }
        $('journey-progress').style.width = packet.phase * 100 + '%'
        if (!dragging && playing) {
          desiredTarget.copy(packet.group.position)
          desiredPosition.copy(desiredTarget).addScaledVector(viewDirection, mobile ? 10 : 15)
          cameraAnimating = true
        }
      } else if (cameraMode === 'flight' && playing && !dragging) {
        const a = flightTime * 0.12,
          d = baseDistance * (mode === 'stations' ? 1.2 : 1)
        desiredTarget.set(0, 1, 0)
        desiredPosition
          .set(
            Math.sin(a + 0.55) * d * 0.83,
            d * (0.5 + Math.sin(a * 0.7) * 0.09),
            Math.cos(a + 0.55) * d * 0.83
          )
          .add(desiredTarget)
        cameraAnimating = true
      } else if (cameraMode === 'station' && cameraAnimating) setCameraGoal()
      if (cameraAnimating && !dragging) {
        const speed = 1 - Math.exp(-dt * (mode === 'reading' ? 2.2 : 3))
        camera.position.lerp(desiredPosition, speed)
        controls.target.lerp(desiredTarget, speed)
        if (
          cameraMode !== 'flight' &&
          mode !== 'reading' &&
          camera.position.distanceTo(desiredPosition) < 0.015 &&
          controls.target.distanceTo(desiredTarget) < 0.015
        )
          cameraAnimating = false
      }
      controls.autoRotate =
        playing &&
        !reduceMotion &&
        !dragging &&
        !cameraAnimating &&
        mode !== 'reading' &&
        cameraMode === 'overview' &&
        now - lastInteraction > 6500
      controls.autoRotateSpeed = 0.24
      controls.update(dt)
      // Project station callouts after the camera update, clamping them inside the iframe.
      stations.forEach((s, i) => {
        const show = mode === 'stations'
        s.label.classList.toggle('visible', show)
        if (!show) return
        anchor.copy(s.group.position).add(s.anchor).project(camera)
        const offsets = mobile
          ? [
              [-30, 25],
              [-27, -50],
              [15, -65],
              [16, -1],
              [-5, 52],
            ]
          : [
              [-48, -14],
              [-8, -64],
              [30, -12],
              [30, 20],
              [-12, 40],
            ]
        let x = (anchor.x * 0.5 + 0.5) * width - 40 + offsets[i][0],
          y = (-anchor.y * 0.5 + 0.5) * height - 52 + offsets[i][1]
        // Embedded in a wide hero the callouts stay out of the headline side (the left 42.5%).
        x = THREE.MathUtils.clamp(
          x,
          mobile || !embedded ? 9 : width * 0.425,
          width - (mobile ? 123 : 165)
        )
        y = THREE.MathUtils.clamp(y, 130, height - 200)
        s.label.style.transform = `translate(${x}px,${y}px)`
      })
      renderer.render(scene, camera)
      // Embed: the first real frame is ready, so the host page can remove its poster from under the frame.
      if (!readySent && sized) {
        readySent = true
        options.onReady?.()
      }
    }
    rafId = requestAnimationFrame(animate)
    cleanups.push(() => {
      cancelAnimationFrame(rafId)
      controls.dispose()
      // Free every GPU resource the scene created, then the context itself.
      const textures = new Set<THREE.Texture>()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const list = mesh.material
          ? Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          : []
        for (const material of list) {
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) textures.add(value)
          material.dispose()
        }
      })
      geometries.forEach((g) => g.dispose())
      textures.forEach((t) => t.dispose())
      env.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    })
    renderer.compile(scene, camera)

    $('loading').classList.add('done')
    $('error').style.display = 'none'
    // Lightweight inspection for integration and automated browser checks; no production UI.
    Object.defineProperty(window, '__machineDebug', {
      value: {
        getState: () => ({
          mode,
          camera: cameraMode,
          playing,
          time: simTime,
          spread,
          cutHeight: cutPlane.constant,
          width,
          height,
          embedded,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          pixelRatio: renderer.getPixelRatio(),
          stations: stations.map((s) => {
            const p = s.group.position
              .clone()
              .add(new THREE.Vector3(0, 1, 0))
              .project(camera)
            return { id: s.id, x: (p.x * 0.5 + 0.5) * width, y: (-0.5 * p.y + 0.5) * height }
          }),
        }),
      },
      configurable: true,
    })
    cleanups.push(() => {
      delete window.__machineDebug
    })
  } catch (error) {
    console.error('Machine: failed to start', error)
    showError()
  }
  return dispose
}

const STYLES = String.raw`
.agentic-factory-3d {
  width: 100%;
  contain: layout;
}
.agentic-factory-3d {
  color-scheme: dark;
  --bg: transparent;
  --white: #f4f1ea;
  --amber: #ff7a1a;
  --muted: #81848b;
  --line: rgba(244, 241, 234, 0.11);
}
.agentic-factory-3d, .agentic-factory-3d * {
  box-sizing: border-box;
}
.agentic-factory-3d {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg);
}
.agentic-factory-3d {
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  color: var(--white);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}
.agentic-factory-3d {
  position: relative;
  overflow: hidden;
}
.agentic-factory-3d button, .agentic-factory-3d a {
  -webkit-tap-highlight-color: transparent;
}
.agentic-factory-3d button {
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.agentic-factory-3d button:focus-visible, .agentic-factory-3d a:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 5px;
}
.agentic-factory-3d #scene {
  position: absolute;
  inset: 0;
  touch-action: none;
  outline: none;
}
.agentic-factory-3d #scene canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.agentic-factory-3d .vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at 50% 48%,
    transparent 30%,
    rgba(0, 0, 0, 0.12) 64%,
    rgba(0, 0, 0, 0.65) 100%
  );
}
.agentic-factory-3d .topbar {
  position: absolute;
  inset: 28px 32px auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  pointer-events: none;
}
.agentic-factory-3d .identity {
  display: flex;
  gap: 13px;
  align-items: center;
}
.agentic-factory-3d .mark {
  width: 30px;
  height: 30px;
  border: 1px solid #55502f;
  border-radius: 9px;
  display: grid;
  place-items: center;
  color: var(--amber);
  background: #1c1b14;
}
.agentic-factory-3d .identity strong {
  display: block;
  font-weight: 550;
  letter-spacing: -0.2px;
  font-size: 13px;
}
.agentic-factory-3d .identity small {
  display: block;
  margin-top: 5px;
  font-size: 9px;
  letter-spacing: 1.55px;
  color: #73777f;
  text-transform: uppercase;
}
.agentic-factory-3d .status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: 0.1px;
  color: #a6a79f;
}
.agentic-factory-3d .status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 10px #ff7a1a60;
}
.agentic-factory-3d .status.paused i {
  background: #777;
  box-shadow: none;
}
.agentic-factory-3d .status span:last-child {
  font-variant-numeric: tabular-nums;
  color: #646971;
  margin-left: 12px;
}
.agentic-factory-3d .scene-heading {
  position: absolute;
  top: 110px;
  left: 24%;
  right: 24%;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 9px;
  letter-spacing: 1.8px;
  color: #959790;
  text-transform: uppercase;
}
.agentic-factory-3d .scene-heading:before {
  content: '';
  width: 22px;
  height: 1px;
  background: var(--amber);
}
.agentic-factory-3d .scene-heading .index {
  margin-left: auto;
  color: #4e535b;
  font-size: 9px;
  letter-spacing: 1px;
}
.agentic-factory-3d .coordinates {
  position: absolute;
  top: 150px;
  right: 33px;
  color: #52575f;
  writing-mode: vertical-rl;
  font:
    9px ui-monospace,
    Menlo,
    SFMono-Regular,
    monospace;
  letter-spacing: 1.5px;
  pointer-events: none;
}
.agentic-factory-3d .controls {
  position: absolute;
  bottom: 79px;
  left: 26px;
  right: 26px;
  display: flex;
  align-items: center;
  flex-direction: column;
  gap: 16px;
  z-index: 5;
}
.agentic-factory-3d .mode-bar {
  display: flex;
  gap: 3px;
  align-items: center;
  padding: 5px;
  border: 1px solid #ffffff13;
  border-radius: 12px;
  background: rgba(25, 28, 32, 0.87);
  box-shadow:
    0 8px 30px #0003,
    inset 0 1px 0 #ffffff03;
  backdrop-filter: blur(16px);
}
.agentic-factory-3d .mode-bar button {
  border: 0;
  background: none;
  color: #a2a4a8;
  white-space: nowrap;
  padding: 11px 15px;
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  font-weight: 500;
  border-radius: 8px;
  transition:
    background 0.2s,
    color 0.2s;
}
.agentic-factory-3d .mode-bar button:hover {
  background: #ffffff08;
  color: var(--white);
}
.agentic-factory-3d .mode-bar button[aria-pressed='true'] {
  background: var(--amber);
  color: #211c0d;
  box-shadow: 0 2px 12px #ff7a1a12;
}
.agentic-factory-3d svg {
  flex-shrink: 0;
  display: block;
}
.agentic-factory-3d .mode-bar svg {
  width: 14px;
  height: 14px;
}
.agentic-factory-3d .camera-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.agentic-factory-3d .camera-row .caption {
  font-size: 9px;
  letter-spacing: 1.4px;
  color: #555b65;
  margin-right: 9px;
}
.agentic-factory-3d .camera-row button {
  border: 0;
  background: transparent;
  color: #6e747e;
  padding: 5px 9px;
  font-size: 10px;
  transition: color 0.2s;
}
.agentic-factory-3d .camera-row button:hover, .agentic-factory-3d .camera-row button[aria-pressed='true'] {
  color: var(--white);
}
.agentic-factory-3d .camera-row button[aria-pressed='true']:after {
  content: '';
  display: block;
  width: 3px;
  height: 3px;
  background: var(--amber);
  border-radius: 50%;
  margin: 5px auto -8px;
}
.agentic-factory-3d .camera-row .divider {
  width: 1px;
  height: 13px;
  background: var(--line);
  margin: 0 8px;
}
.agentic-factory-3d .camera-row #play {
  padding: 5px;
  width: 25px;
  height: 25px;
  display: grid;
  place-items: center;
}
.agentic-factory-3d .footer {
  position: absolute;
  bottom: 25px;
  left: 32px;
  right: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}
.agentic-factory-3d .wordmark {
  font-size: 11px;
  letter-spacing: -0.1px;
  color: #6d7178;
  text-decoration: none;
  pointer-events: auto;
}
.agentic-factory-3d .wordmark span {
  color: #a1a49f;
}
.agentic-factory-3d .hint {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #636972;
  font-size: 10px;
}
.agentic-factory-3d .hint svg {
  color: #8c8f91;
}
.agentic-factory-3d .footer-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font:
    9px ui-monospace,
    Menlo,
    SFMono-Regular,
    monospace;
  letter-spacing: 1.5px;
  color: #3f454d;
}
.agentic-factory-3d #labels {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.agentic-factory-3d .station-label {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  transition: opacity 0.3s;
  will-change: transform;
  pointer-events: none;
  min-width: 138px;
}
.agentic-factory-3d .station-label.visible {
  opacity: 1;
}
.agentic-factory-3d .station-label .stem {
  height: 26px;
  width: 1px;
  background: linear-gradient(#ff7a1a00, #ff7a1a70);
  margin: 0 0 0 10px;
}
.agentic-factory-3d .station-label .label-card {
  background: #14171bee;
  backdrop-filter: blur(10px);
  border: 1px solid #ff7a1a40;
  border-radius: 6px;
  padding: 10px 13px;
  box-shadow: 0 4px 20px #0003;
}
.agentic-factory-3d .station-label .label-title {
  font-weight: 550;
  font-size: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
  white-space: nowrap;
}
.agentic-factory-3d .station-label .label-title span {
  color: var(--amber);
  font:
    9px ui-monospace,
    Menlo,
    monospace;
}
.agentic-factory-3d .station-label .label-meta {
  font-size: 9px;
  color: #8e939c;
  margin: 6px 0 0 24px;
  white-space: nowrap;
}
.agentic-factory-3d #tooltip {
  position: absolute;
  pointer-events: none;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.15s;
  padding: 11px 14px;
  border: 1px solid #ffffff1a;
  background: #171a20ed;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px #0005;
  border-radius: 7px;
  max-width: 240px;
}
.agentic-factory-3d #tooltip.visible {
  opacity: 1;
}
.agentic-factory-3d #tooltip strong {
  font-size: 12px;
  font-weight: 550;
}
.agentic-factory-3d #tooltip strong span {
  font-size: 10px;
  color: var(--amber);
  margin-right: 8px;
}
.agentic-factory-3d #tooltip p {
  font-size: 10px;
  color: #9b9fa7;
  margin: 6px 0 0;
  line-height: 1.5;
}
.agentic-factory-3d #journey {
  position: absolute;
  left: 24%;
  right: 24%;
  top: 148px;
  opacity: 0;
  transform: translateY(-5px);
  transition: 0.4s;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 13px;
}
.agentic-factory-3d #journey.visible {
  opacity: 1;
  transform: none;
}
.agentic-factory-3d .journey-icon {
  width: 28px;
  height: 28px;
  border: 1px solid #ff7a1a40;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--amber);
}
.agentic-factory-3d #journey strong {
  font-size: 11px;
  font-weight: 500;
}
.agentic-factory-3d #journey small {
  display: block;
  font-size: 9px;
  margin-top: 4px;
  color: #7e858d;
}
.agentic-factory-3d #journey .track {
  height: 2px;
  background: #ffffff0b;
  flex: 1;
  margin-left: 8px;
}
.agentic-factory-3d #journey .track i {
  display: block;
  height: 100%;
  background: var(--amber);
  width: 0;
}
.agentic-factory-3d #loading {
  position: absolute;
  left: 50%;
  top: 48%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 12px;
  color: #8c8f95;
  font-size: 11px;
  transition: opacity 0.4s;
  z-index: 20;
}
.agentic-factory-3d #loading i {
  height: 18px;
  width: 18px;
  border-radius: 50%;
  border: 1px solid #ff7a1a22;
  border-top-color: var(--amber);
  animation: agentic-factory-3d-spin 1s linear infinite;
}
@keyframes agentic-factory-3d-spin {
  to {
    transform: rotate(360deg);
  }
}
.agentic-factory-3d #loading.done {
  opacity: 0;
  pointer-events: none;
}
.agentic-factory-3d #error {
  position: absolute;
  left: 27.5%;
  right: 27.5%;
  top: 40%;
  border: 1px solid #ff7a1a30;
  background: #191b1f;
  padding: 24px;
  border-radius: 12px;
  display: none;
  font-size: 13px;
  line-height: 1.7;
}
.agentic-factory-3d #error strong {
  color: var(--amber);
  font-weight: 500;
}
.agentic-factory-3d #error p {
  color: #9da1a8;
  margin: 8px 0 0;
}
.agentic-factory-3d #error button {
  border: 1px solid #ffffff22;
  background: #25292e;
  padding: 8px 14px;
  border-radius: 5px;
  margin-top: 14px;
}
.agentic-factory-3d.embed .debug-ui {
  display: none !important;
}
.agentic-factory-3d.embed .vignette {
  background: radial-gradient(
    ellipse at center,
    transparent 45%,
    var(--background, #05070d) 100%
  );
}
.agentic-factory-3d.embed .footer {
  display: none;
}
.agentic-factory-3d.embed .wordmark {
  opacity: 0.65;
}
@media (min-width: 901px) {
  .agentic-factory-3d.embed #loading {
    left: 71%;
  }
  .agentic-factory-3d.embed #error {
    left: 48%;
    right: 7%;
  }
}
@media (min-width: 1600px) {
  .agentic-factory-3d .topbar {
    inset: 38px 46px auto;
  }
  .agentic-factory-3d .scene-heading {
    top: 142px;
  }
  .agentic-factory-3d .controls {
    bottom: 100px;
    gap: 20px;
  }
  .agentic-factory-3d .mode-bar button {
    padding: 13px 20px;
    font-size: 12px;
  }
  .agentic-factory-3d .camera-row button {
    font-size: 11px;
    padding: 5px 12px;
  }
  .agentic-factory-3d .footer {
    bottom: 35px;
    left: 46px;
    right: 46px;
  }
  .agentic-factory-3d #journey {
    top: 182px;
  }
  .agentic-factory-3d .coordinates {
    right: 47px;
    top: 185px;
  }
}
@media (max-width: 900px) {
  .agentic-factory-3d .topbar {
    inset: 24px 22px auto;
  }
  .agentic-factory-3d .identity strong {
    font-size: 12px;
  }
  .agentic-factory-3d .identity small {
    font-size: 8px;
    letter-spacing: 1.1px;
  }
  .agentic-factory-3d .status {
    font-size: 9px;
  }
  .agentic-factory-3d .status span:last-child {
    display: none;
  }
  .agentic-factory-3d .scene-heading {
    left: 22px;
    right: 22px;
    top: 105px;
    font-size: 8px;
    letter-spacing: 1.3px;
  }
  .agentic-factory-3d .coordinates {
    display: none;
  }
  .agentic-factory-3d .controls {
    left: 12px;
    right: 12px;
    bottom: 84px;
    gap: 18px;
  }
  .agentic-factory-3d .mode-bar {
    gap: 1px;
    padding: 4px;
    border-radius: 10px;
  }
  .agentic-factory-3d .mode-bar button {
    padding: 11px 10px;
    font-size: 10px;
    gap: 6px;
  }
  .agentic-factory-3d .mode-bar svg {
    width: 12px;
    height: 12px;
  }
  .agentic-factory-3d .camera-row {
    gap: 0;
  }
  .agentic-factory-3d .camera-row .caption {
    font-size: 8px;
    margin-right: 6px;
  }
  .agentic-factory-3d .camera-row button {
    padding: 5px 8px;
    font-size: 9px;
  }
  .agentic-factory-3d .camera-row .divider {
    margin: 0 5px;
  }
  .agentic-factory-3d .footer {
    bottom: 25px;
    left: 22px;
    right: 22px;
    align-items: flex-end;
  }
  .agentic-factory-3d .hint {
    font-size: 9px;
    max-width: 175px;
    line-height: 1.6;
  }
  .agentic-factory-3d .footer-center {
    display: none;
  }
  .agentic-factory-3d .vignette {
    background: radial-gradient(ellipse at 50% 47%, transparent 20%, #00000080 100%);
  }
  .agentic-factory-3d #loading {
    left: 50%;
  }
  .agentic-factory-3d #error {
    left: 7%;
    right: 7%;
    top: 35%;
  }
  .agentic-factory-3d #journey {
    left: 24px;
    right: 24px;
    top: 143px;
  }
  .agentic-factory-3d .station-label {
    min-width: 100px;
  }
  .agentic-factory-3d .station-label .label-card {
    padding: 7px 9px;
  }
  .agentic-factory-3d .station-label .label-title {
    font-size: 10px;
    gap: 7px;
  }
  .agentic-factory-3d .station-label .label-meta {
    font-size: 8px;
    margin-left: 0;
  }
  .agentic-factory-3d .station-label .stem {
    height: 17px;
  }
  .agentic-factory-3d.embed .vignette {
    background: radial-gradient(ellipse at center, transparent 45%, var(--background, #05070d) 100%);
  }
}
@media (max-width: 360px) {
  .agentic-factory-3d .mode-bar button {
    padding: 10px 7px;
  }
  .agentic-factory-3d .mode-bar svg {
    display: none;
  }
  .agentic-factory-3d .camera-row .caption {
    display: none;
  }
  .agentic-factory-3d .status {
    display: none;
  }
}
@media (max-height: 570px) {
  .agentic-factory-3d .topbar {
    top: 16px;
  }
  .agentic-factory-3d .scene-heading {
    top: 70px;
  }
  .agentic-factory-3d .controls {
    bottom: 50px;
    gap: 8px;
  }
  .agentic-factory-3d .footer {
    bottom: 14px;
  }
  .agentic-factory-3d #journey {
    top: 96px;
  }
  .agentic-factory-3d .mode-bar button {
    padding-top: 8px;
    padding-bottom: 8px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .agentic-factory-3d, .agentic-factory-3d * {
    transition: none !important;
  }
  .agentic-factory-3d #loading i {
    animation: none;
  }
}

`
