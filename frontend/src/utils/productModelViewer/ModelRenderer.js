/**
 * Browser Three.js viewer (behavior aligned with wechat-mp ModelRenderer.js).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DecalProjector } from './DecalShader.js';

export class ModelRenderer {
  constructor(canvas, options = {}) {
    const {
      bgColor = '#b3b3b3',
      envMap = null,
      showSkybox = false,
      width = 0,
      height = 0,
    } = options;

    const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const W = width || canvas.clientWidth || 300;
    const H = height || canvas.clientHeight || 300;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(DPR);
    renderer.setClearColor(bgColor, 1);
    renderer.shadowMap.enabled = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 7);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0x8888ff, 0.3);
    fill.position.set(-5, -2, -5);
    scene.add(fill);

    this._canvas = canvas;
    this._renderer = renderer;
    this._scene = scene;
    this._camera = camera;
    this._target = new THREE.Vector3(0, 0, 0);
    this._currentModel = null;
    this._orbit = {
      theta: 0.4,
      phi: 1.1,
      radius: 5,
      isRotating: false,
      isPinching: false,
      lastX: 0,
      lastY: 0,
      lastPinchDist: 0,
    };
    this._rafId = null;
    this._disposed = false;
    this._decal = null;
    this._envTexture = null;

    if (envMap) this._loadEnvMap(envMap, showSkybox);
  }

  setSize(width, height) {
    if (!width || !height || this._disposed) return;
    this._camera.aspect = width / height;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(width, height);
  }

  loadModel(url) {
    return fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`加载模型失败: ${r.status}`);
        return r.arrayBuffer();
      })
      .then(
        (buf) =>
          new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.parse(
              buf,
              '',
              (gltf) => {
                const object = gltf.scene;
                this._centerAndScale(object);
                this._clearCurrentModel();
                this._currentModel = object;
                this._scene.add(object);
                this._startLoop();
                setTimeout(() => this._stopLoop(), 120);
                resolve();
              },
              reject
            );
          })
      );
  }

  switchModel(url) {
    this._clearCurrentModel();
    return this.loadModel(url);
  }

  dispose() {
    this._disposed = true;
    this._stopLoop();
    this._clearCurrentModel();
    if (this._renderer) {
      try {
        this._renderer.dispose();
      } catch {
        /* ignore */
      }
    }
    if (this._envTexture) this._envTexture.dispose();
    if (this._decal) this._decal.dispose();
    this._canvas = null;
  }

  setEnvMap(url, showSkybox = false) {
    this._loadEnvMap(url, showSkybox);
  }

  applyDecal(url, options = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (this._disposed) return;
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;

        let cylinderRadius = 1.0;
        if (this._currentModel) {
          const box = new THREE.Box3().setFromObject(this._currentModel);
          const size = box.getSize(new THREE.Vector3());
          cylinderRadius = (size.x + size.z) / 4;
        }

        if (this._decal) this._decal.dispose();
        this._decal = new DecalProjector(tex, {
          ...options,
          cylinderRadius,
          textureWidth: img.width,
          textureHeight: img.height,
        });

        if (options.angle !== undefined) this._decal.setAngle(options.angle);
        if (options.height !== undefined) this._decal.setHeight(options.height);

        if (this._currentModel) this._decal.applyToModel(this._currentModel);

        this._startLoop();
        setTimeout(() => this._stopLoop(), 120);
        resolve();
      };
      img.onerror = () => reject(new Error('贴花图加载失败'));
      img.src = url;
    });
  }

  updateDecal(angle, height, scaleX = 1.0, scaleY = 1.0) {
    if (!this._decal) return;
    this._decal.setAngle(angle);
    this._decal.setHeight(height);
    this._decal.setScaleX(scaleX);
    this._decal.setScaleY(scaleY);
    this._startLoop();
    setTimeout(() => this._stopLoop(), 120);
  }

  removeDecal() {
    if (this._decal) {
      this._decal.remove();
      this._decal = null;
      this._startLoop();
      setTimeout(() => this._stopLoop(), 120);
    }
  }

  onTouchStart(e) {
    const t = e.touches;
    const o = this._orbit;
    if (t.length === 1) {
      o.isRotating = true;
      o.isPinching = false;
      o.lastX = t[0].clientX;
      o.lastY = t[0].clientY;
    } else if (t.length === 2) {
      o.isRotating = false;
      o.isPinching = true;
      o.lastPinchDist = this._pinchDist(t);
    }
    this._startLoop();
  }

  onTouchMove(e) {
    const t = e.touches;
    const o = this._orbit;
    if (o.isRotating && t.length === 1) {
      o.theta -= (t[0].clientX - o.lastX) * 0.008;
      o.phi = Math.max(0.05, Math.min(Math.PI - 0.05, o.phi - (t[0].clientY - o.lastY) * 0.008));
      o.lastX = t[0].clientX;
      o.lastY = t[0].clientY;
    } else if (o.isPinching && t.length === 2) {
      const d = this._pinchDist(t);
      o.radius = Math.max(1, Math.min(30, o.radius + (o.lastPinchDist - d) * 0.03));
      o.lastPinchDist = d;
    }
  }

  onTouchEnd(e) {
    const o = this._orbit;
    if (e.touches.length === 0) {
      o.isRotating = false;
      o.isPinching = false;
      this._stopLoop();
    } else if (e.touches.length === 1) {
      o.isPinching = false;
      o.isRotating = true;
      o.lastX = e.touches[0].clientX;
      o.lastY = e.touches[0].clientY;
    }
  }

  onPointerDown(clientX, clientY) {
    const o = this._orbit;
    o.isRotating = true;
    o.isPinching = false;
    o.lastX = clientX;
    o.lastY = clientY;
    this._startLoop();
  }

  onPointerDrag(clientX, clientY) {
    const o = this._orbit;
    if (!o.isRotating) return;
    o.theta -= (clientX - o.lastX) * 0.008;
    o.phi = Math.max(0.05, Math.min(Math.PI - 0.05, o.phi - (clientY - o.lastY) * 0.008));
    o.lastX = clientX;
    o.lastY = clientY;
  }

  onPointerUp() {
    this._orbit.isRotating = false;
    this._orbit.isPinching = false;
    this._stopLoop();
  }

  onWheel(deltaY) {
    const o = this._orbit;
    o.radius = Math.max(1, Math.min(30, o.radius + deltaY * 0.01));
    this._startLoop();
    setTimeout(() => this._stopLoop(), 80);
  }

  _clearCurrentModel() {
    if (this._currentModel) {
      this._scene.remove(this._currentModel);
      this._currentModel.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
      this._currentModel = null;
    }
  }

  _centerAndScale(object) {
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const s = 2 / maxDim;
      object.scale.setScalar(s);
      object.position.sub(center.multiplyScalar(s));
    }
  }

  _startLoop() {
    if (this._rafId != null || this._disposed) return;
    const loop = () => {
      if (this._disposed) return;
      const o = this._orbit;
      const t = this._target;
      this._camera.position.set(
        t.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
        t.y + o.radius * Math.cos(o.phi),
        t.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta)
      );
      this._camera.lookAt(t);
      this._renderer.render(this._scene, this._camera);
      this._rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  _stopLoop() {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
  }

  _pinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  _loadEnvMap(url, showSkybox) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (this._disposed) return;
      this._applyEnvImage(img, showSkybox);
    };
    img.onerror = () => {
      console.warn('[ModelRenderer] envMap load failed:', url);
    };
    img.src = url;
  }

  _applyEnvImage(img, showSkybox) {
    const tex = new THREE.Texture(img);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;

    if (this._envTexture) this._envTexture.dispose();
    this._envTexture = tex;

    this._scene.environment = tex;
    if (showSkybox) this._scene.background = tex;

    this._startLoop();
    setTimeout(() => this._stopLoop(), 120);
  }
}
