import { useEffect, useRef, useState } from 'react'

// Věrný 3D viewer relikvií — three.js (lazy z unpkg přes importmap). Na rozdíl od
// model-vieweru umí znovu sestavit HOLO fólii legendary karty: GLB nese plochu
// „holo_foil" s maskou (map) + ghost (emissiveMap) + parametry v userData
// (export z nástroje), tady se z toho poskládá původní holo shader.

// ── Shader fólie (portováno 1:1 z nástroje historyguessr-karty) ──
const HOLO_VERT = `
  varying vec2 vUv;
  varying vec3 vLocalView;
  uniform mat4 uInvModel;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 toCam = cameraPosition - world.xyz;
    vLocalView = (uInvModel * vec4(toCam, 0.0)).xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`
const HOLO_FRAG = `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vLocalView;
  uniform sampler2D uMask;
  uniform sampler2D uGhost;
  uniform float uTime;
  uniform float uStrength;
  uniform float uScroll;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 tone(float t, float k) {
    vec3 BLUE=vec3(0.16,0.55,1.0); vec3 VIOLET=vec3(0.62,0.28,1.0);
    vec3 ORANGE=vec3(1.0,0.55,0.16); vec3 GREEN=vec3(0.20,0.94,0.55);
    vec3 a=t<0.0?BLUE:ORANGE; vec3 b=t<0.0?VIOLET:GREEN;
    return mix(a,b,clamp(abs(t)*1.15+k,0.0,1.0));
  }
  void main() {
    vec4 m = texture2D(uMask, vUv);
    float ring=m.r; float art=m.g;
    if (ring+art < 0.003) discard;
    vec3 V = normalize(vLocalView);
    float cosT = clamp(abs(V.z),0.0,1.0);
    float grazing = 1.0 - cosT;
    vec2 tilt = V.xy / max(V.z, 0.35);
    vec2 dirA=vec2(0.94,0.34); vec2 dirB=vec2(-0.42,0.91);
    float scrollT = uTime * uScroll;
    float pA = dot(vUv*vec2(1.0,1.39),dirA)*26.0 + dot(tilt,dirA)*9.0 + scrollT*1.3;
    float pB = dot(vUv*vec2(1.0,1.39),dirB)*17.0 + dot(tilt,dirB)*6.2 + scrollT*0.85;
    float bA=0.5+0.5*sin(pA); float bB=0.5+0.5*sin(pB);
    float bands = pow(bA,2.6)*0.62 + pow(bB,2.2)*0.38;
    float shift = sin(pA*0.5)*0.22 + sin(pB*0.37)*0.16;
    vec3 col = tone(tilt.x, shift);
    col = mix(col, vec3(1.0), pow(bands,3.0)*0.45);
    float ghost = texture2D(uGhost, vUv).r;
    float tiltAmt = smoothstep(0.06,0.62,length(tilt));
    float ghostA = ghost * tiltAmt * (0.35 + bands*0.85) * 0.42;
    float sparkA = 0.0;
    for (int i=0;i<2;i++) {
      float sc = i==0?190.0:96.0;
      vec2 cell = floor(vUv*vec2(sc,sc*1.39));
      float h = hash(cell+float(i)*17.0);
      float on = step(0.982-float(i)*0.006,h);
      float tw = sin(uTime*2.1 + h*40.0 + tilt.x*7.0)*0.5+0.5;
      sparkA += on*pow(tw,3.0)*(i==0?0.75:0.45);
    }
    sparkA *= (ring*0.85+art*0.55)*(0.25+tiltAmt*0.9);
    float angular = 0.42 + grazing*1.55 + tiltAmt*0.55;
    float foilA = (ring*1.05+art*0.65)*bands*angular;
    float dither = (hash(gl_FragCoord.xy+uTime)-0.5)*0.02;
    float a = clamp((foilA + ghostA*ring*1.3 + sparkA*1.2)*uStrength + dither, 0.0, 1.0);
    vec3 rgb = col*(0.75+bands*1.35) + vec3(sparkA*1.15);
    gl_FragColor = vec4(rgb, a);
  }
`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Mods = { THREE: any; GLTFLoader: any; OrbitControls: any }
let modsPromise: Promise<Mods | null> | null = null
function loadThree(): Promise<Mods | null> {
  if (modsPromise) return modsPromise
  modsPromise = (async () => {
    try {
      // specifiery přes proměnné → Vite/TS je neřeší staticky, resolvují se
      // runtime přes importmap v index.html (three + three/addons z unpkg)
      const sThree = 'three', sGltf = 'three/addons/loaders/GLTFLoader.js'
      const sOrbit = 'three/addons/controls/OrbitControls.js'
      const THREE = await import(/* @vite-ignore */ sThree)
      const { GLTFLoader } = await import(/* @vite-ignore */ sGltf)
      const { OrbitControls } = await import(/* @vite-ignore */ sOrbit)
      return { THREE, GLTFLoader, OrbitControls }
    } catch { return null }
  })()
  return modsPromise
}

export default function RelicViewer3D({ modelUrl, imageUrl, glow, fallback }: {
  modelUrl?: string | null
  imageUrl?: string | null
  glow?: 'gold' | 'stone'
  fallback?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!modelUrl) return
    let alive = true
    let cleanup: (() => void) | null = null
    loadThree().then((M) => {
      if (!alive || !M || !wrapRef.current) { if (!M) setFailed(true); return }
      cleanup = initScene(M, wrapRef.current, modelUrl, glow === 'gold')
    })
    return () => { alive = false; if (cleanup) cleanup() }
  }, [modelUrl, glow])

  if (!modelUrl || failed) {
    if (imageUrl) return <img src={imageUrl} alt="" style={{ position: 'relative', width: '62%', height: '76%', objectFit: 'contain' }}/>
    return <span style={{ position: 'relative', fontSize: 76, color: glow === 'gold' ? '#E8C88A' : '#D8CFBF' }}>{fallback ?? '🏺'}</span>
  }
  return <div ref={wrapRef} style={{ width: '100%', height: '100%', minHeight: 120, touchAction: 'none' }}/>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function initScene(M: Mods, wrap: HTMLDivElement, url: string, gold: boolean): () => void {
  const { THREE, GLTFLoader, OrbitControls } = M
  const W = wrap.clientWidth || 300, H = wrap.clientHeight || 300
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(W, H)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  wrap.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  // Světla a prostředí 1:1 jako v nástroji „3D export karet" — aby legendary
  // karta (kov, folie, holo) vypadala stejně jako tam.
  scene.add(new THREE.HemisphereLight(0xE8DECD, 0x120E0A, 0.55))
  const key = new THREE.DirectionalLight(0xFFF3DC, 2.2); key.position.set(0.16, 0.28, 0.3); scene.add(key)
  const fill = new THREE.DirectionalLight(0xBFD2E6, 0.75); fill.position.set(-0.3, 0.1, 0.2); scene.add(fill)
  const rim = new THREE.DirectionalLight(0xFFD98A, 1); rim.position.set(-0.1, 0.3, -0.3); scene.add(rim)
  // Prostředí: stejný gradientní equirect „studiový" HDRI (teplé horní světlo,
  // tmavé dno) → stejné odlesky na kovovém rámu.
  ;(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256
    const ctx = c.getContext('2d'); if (!ctx) return
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#FFF6E4'); g.addColorStop(0.42, '#8B7C66'); g.addColorStop(0.55, '#2A231B'); g.addColorStop(1, '#0B0907')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256)
    const soft = (x: number, y: number, rx: number, ry: number, col: string) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry))
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / Math.max(rx, ry)); ctx.translate(-x, -y)
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, Math.max(rx, ry), 0, Math.PI * 2); ctx.fill(); ctx.restore()
    }
    soft(150, 55, 150, 78, 'rgba(255,255,255,.9)')
    soft(390, 85, 120, 66, 'rgba(255,228,186,.55)')
    soft(280, 195, 200, 90, 'rgba(120,105,88,.35)')
    const t = new THREE.CanvasTexture(c)
    t.mapping = THREE.EquirectangularReflectionMapping
    t.colorSpace = THREE.SRGBColorSpace
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromEquirectangular(t).texture
    pmrem.dispose(); t.dispose()
  })()

  const camera = new THREE.PerspectiveCamera(32, W / H, 0.01, 100)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.autoRotate = true
  controls.autoRotateSpeed = 1.1
  controls.rotateSpeed = 0.9

  const holos: any[] = []
  const loader = new GLTFLoader()
  loader.load(url, (gltf: any) => {
    const root = gltf.scene
    root.traverse((o: any) => {
      if (!o.isMesh) return
      const isHolo = o.userData?.hgHolo || o.name === 'holo_foil'
      if (isHolo && o.material) {
        const mask = o.material.map || null
        const ghost = o.material.emissiveMap || null
        if (mask) mask.colorSpace = THREE.NoColorSpace
        if (ghost) ghost.colorSpace = THREE.NoColorSpace
        o.material = new THREE.ShaderMaterial({
          vertexShader: HOLO_VERT, fragmentShader: HOLO_FRAG,
          uniforms: {
            uMask: { value: mask }, uGhost: { value: ghost },
            uInvModel: { value: new THREE.Matrix4() }, uTime: { value: 0 },
            uStrength: { value: o.userData?.hgStrength ?? 1.15 }, uScroll: { value: o.userData?.hgScroll ?? 0 },
          },
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        })
        o.renderOrder = 2
        holos.push(o)
      }
    })
    scene.add(root)
    // Vycentruj a nastav kameru dle velikosti
    const box = new THREE.Box3().setFromObject(root)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    root.position.sub(center)
    const radius = Math.max(size.x, size.y, size.z) * 0.5
    const dist = radius / Math.sin((camera.fov * Math.PI / 180) / 2) * 1.25
    // mírná elevace jako v nástroji (kamera nad středem) → folie je nakloněná
    // a holo spektrum je vidět i v klidu, nejen při rotaci
    camera.position.set(0, dist * 0.16, dist * 0.985)
    camera.near = dist / 100; camera.far = dist * 10; camera.updateProjectionMatrix()
    controls.target.set(0, 0, 0)
    controls.minDistance = dist * 0.65
    controls.maxDistance = dist * 2.0
    controls.update()
  })

  const clock = new THREE.Clock()
  let raf = 0
  const inv = new THREE.Matrix4()
  const tick = () => {
    raf = requestAnimationFrame(tick)
    const t = clock.getElapsedTime()
    for (const h of holos) {
      h.updateWorldMatrix(true, false)
      inv.copy(h.matrixWorld).invert()
      h.material.uniforms.uInvModel.value.copy(inv)
      h.material.uniforms.uTime.value = t
    }
    controls.update()
    renderer.render(scene, camera)
  }
  tick()

  const ro = new ResizeObserver(() => {
    const w = wrap.clientWidth || 300, h = wrap.clientHeight || 300
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix()
  })
  ro.observe(wrap)

  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
    controls.dispose?.()
    renderer.dispose?.()
    scene.traverse((o: any) => { if (o.isMesh) { o.geometry?.dispose?.(); const m = o.material; if (Array.isArray(m)) m.forEach((x: any) => x.dispose?.()); else m?.dispose?.() } })
    if (renderer.domElement.parentNode === wrap) wrap.removeChild(renderer.domElement)
  }
}
