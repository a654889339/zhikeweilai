const THREE = require('../../../libs/three.min.js');
require('../../../libs/GLTFLoader.js');
const DecalProjector = require('./DecalShader.js');

const CACHE_PREFIX = 'model_cache_';

/**
 * ModelRenderer
 * Wraps Three.js scene/camera/renderer and GLB/GLTF model loading for WeChat miniprogram.
 * Usage:
 *   const r = new ModelRenderer(canvas, { bgColor: '#b3b3b3' });
 *   await r.loadModel('https://cdn.example.com/model.glb');
 *   r.onTouchStart(e); r.onTouchMove(e); r.onTouchEnd(e);
 *   r.dispose();
 */
class ModelRenderer {
  constructor(canvas, options = {}) {
    const {
      bgColor = '#b3b3b3',
      // envMap: URL of an equirectangular PNG/JPG used as environment map.
      //   - Drives PBR reflections on metallic/glossy materials.
      //   - Pass showSkybox: true to also render it as the visible background.
      envMap = null,
      showSkybox = false,
      // Actual CSS pixel size of the canvas element. Pass these from the
      // SelectorQuery boundingClientRect result so the camera aspect ratio
      // matches the rendered area exactly, avoiding stretching.
      width = 0,
      height = 0,
    } = options;

    if (!canvas.addEventListener) {
      canvas.addEventListener = () => {};
      canvas.removeEventListener = () => {};
      canvas.dispatchEvent = () => {};
    }
    if (!canvas.style) canvas.style = {};

    const info = wx.getWindowInfo();
    const DPR = info.pixelRatio || 1;
    // Prefer explicitly passed size; fall back to window size only if not provided.
    const W = width || info.windowWidth;
    const H = height || info.windowHeight;

    const gl = canvas.getContext('webgl');
    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(DPR);
    renderer.setClearColor(bgColor, 1);
    renderer.shadowMap.enabled = false;
    // Required for correct env-map tone mapping with PBR materials
    renderer.outputEncoding = THREE.sRGBEncoding;
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
      theta: 0.4, phi: 1.1, radius: 5,
      isRotating: false, isPinching: false,
      lastX: 0, lastY: 0, lastPinchDist: 0,
    };

    this._startLoop();

    if (envMap) this._loadEnvMap(envMap, showSkybox);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Load a GLB/GLTF model from a CDN URL (with local cache).
   * @param {string} url
   * @returns {Promise<void>}
   */
  loadModel(url) {
    return this._fetchFile(url).then(localPath => {
      return new Promise((resolve, reject) => {
        const fs = wx.getFileSystemManager();
        fs.readFile({
          filePath: localPath,
          success: (res) => {
            const loader = new THREE.GLTFLoader();
            THREE.GLTFLoader.setCanvas(this._canvas);
            loader.parse(res.data, '', (gltf) => {
              const object = gltf.scene;
              this._centerAndScale(object);
              this._clearCurrentModel();
              this._currentModel = object;
              this._scene.add(object);
              // 渲染一帧让模型显示，然后停止循环
              this._startLoop();
              setTimeout(() => this._stopLoop(), 100);
              resolve();
            }, reject);
          },
          fail: reject,
        });
      });
    });
  }

  /**
   * Remove current model and load a new one.
   * @param {string} url
   * @returns {Promise<void>}
   */
  switchModel(url) {
    this._clearCurrentModel();
    return this.loadModel(url);
  }

  dispose() {
    this._disposed = true;
    this._stopLoop();
    if (this._renderer) {
      // Patch the canvas on the Three.js renderer context to prevent it from
      // calling cancelAnimationFrame on a null node during dispose (WeChat mp bug).
      try {
        const ctx = this._renderer.getContext();
        if (ctx && ctx.canvas) {
          ctx.canvas.cancelAnimationFrame = () => {};
          ctx.canvas.requestAnimationFrame = () => 0;
        }
      } catch (e) {}
      try { this._renderer.dispose(); } catch (e) {}
    }
    if (this._envTexture) this._envTexture.dispose();
    if (this._decal) this._decal.dispose();
    this._canvas = null;
  }

  /**
   * Set or replace the environment map at runtime.
   * @param {string} url  Equirectangular PNG/JPG URL
   * @param {boolean} showSkybox  Also render as visible background
   */
  setEnvMap(url, showSkybox = false) {
    this._loadEnvMap(url, showSkybox);
  }

  // ── Decal API ──────────────────────────────────────────────────────────────

  /**
   * Apply a cylindrical decal to the current model.
   * @param {string} url  URL of the decal texture (PNG with alpha recommended)
   * @param {object} options
   * @param {number} options.angle        Center angle in radians around world Y (default 0)
   * @param {number} options.height       Center height in world units (default 0)
   * @param {number} options.arcWidth     Angular width in radians (default π/3)
   * @param {number} options.heightRange  Height span in world units (default 1.0)
   * @param {number} options.opacity      Blend opacity 0–1 (default 1.0)
   * @returns {Promise<void>}
   */
  applyDecal(url, options = {}) {
    return this._fetchFile(url).then((localPath) => {
      return new Promise((resolve, reject) => {
        const img = this._canvas.createImage();
        img.onload = () => {
          if (this._disposed) return;
          const tex = new THREE.Texture(img);
          tex.encoding = THREE.sRGBEncoding;
          tex.needsUpdate = true;

          // Estimate cylinder radius from model bounding box (XZ plane average)
          let cylinderRadius = 1.0;
          if (this._currentModel) {
            const box = new THREE.Box3().setFromObject(this._currentModel);
            const size = box.getSize(new THREE.Vector3());
            cylinderRadius = (size.x + size.z) / 4;
            console.log('[Decal] model size:', size.x.toFixed(3), size.y.toFixed(3), size.z.toFixed(3), 'radius:', cylinderRadius.toFixed(3));
          }

          if (this._decal) this._decal.dispose();
          this._decal = new DecalProjector(tex, {
            ...options,
            cylinderRadius,
            textureWidth: img.width,
            textureHeight: img.height,
          });
          console.log('[Decal] texture size:', img.width, img.height);

          if (options.angle !== undefined) this._decal.setAngle(options.angle);
          if (options.height !== undefined) this._decal.setHeight(options.height);

          if (this._currentModel) this._decal.applyToModel(this._currentModel);

          this._startLoop();
          setTimeout(() => this._stopLoop(), 100);
          resolve();
        };
        img.onerror = reject;
        img.src = localPath;
      });
    });
  }

  /**
   * Update decal position and scale without reloading the texture.
   * @param {number} angle   Center angle in radians around world Y
   * @param {number} height  Center height in world units
   * @param {number} scaleX  Horizontal scale (default 1.0)
   * @param {number} scaleY  Vertical scale (default 1.0)
   */
  updateDecal(angle, height, scaleX = 1.0, scaleY = 1.0) {
    if (!this._decal) return;
    this._decal.setAngle(angle);
    this._decal.setHeight(height);
    this._decal.setScaleX(scaleX);
    this._decal.setScaleY(scaleY);
    this._startLoop();
    setTimeout(() => this._stopLoop(), 100);
  }

  /** Remove the current decal from the model. */
  removeDecal() {
    if (this._decal) {
      this._decal.remove();
      this._decal = null;
      this._startLoop();
      setTimeout(() => this._stopLoop(), 100);
    }
  }

  // ── Touch Orbit ────────────────────────────────────────────────────────────

  onTouchStart(e) {
    const t = e.touches;
    const o = this._orbit;
    if (t.length === 1) {
      o.isRotating = true; o.isPinching = false;
      o.lastX = t[0].clientX; o.lastY = t[0].clientY;
    } else if (t.length === 2) {
      o.isRotating = false; o.isPinching = true;
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
      o.lastX = t[0].clientX; o.lastY = t[0].clientY;
    } else if (o.isPinching && t.length === 2) {
      const d = this._pinchDist(t);
      o.radius = Math.max(1, Math.min(30, o.radius + (o.lastPinchDist - d) * 0.03));
      o.lastPinchDist = d;
    }
  }

  onTouchEnd(e) {
    const o = this._orbit;
    if (e.touches.length === 0) {
      o.isRotating = false; o.isPinching = false;
      this._stopLoop();
    } else if (e.touches.length === 1) {
      o.isPinching = false; o.isRotating = true;
      o.lastX = e.touches[0].clientX; o.lastY = e.touches[0].clientY;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _clearCurrentModel() {
    if (this._currentModel) {
      this._scene.remove(this._currentModel);
      this._currentModel.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => m.dispose());
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
    if (this._rafId) return; // 已在跑
    const loop = () => {
      if (this._disposed) return; // canvas 已销毁，停止
      const o = this._orbit;
      const t = this._target;
      this._camera.position.set(
        t.x + o.radius * Math.sin(o.phi) * Math.sin(o.theta),
        t.y + o.radius * Math.cos(o.phi),
        t.z + o.radius * Math.sin(o.phi) * Math.cos(o.theta)
      );
      this._camera.lookAt(t);
      this._renderer.render(this._scene, this._camera);
      this._rafId = this._canvas.requestAnimationFrame(loop);
    };
    loop();
  }

  _stopLoop() {
    if (this._rafId && this._canvas) {
      this._canvas.cancelAnimationFrame(this._rafId);
    }
    this._rafId = null;
  }

  _pinchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Load an equirectangular image as a PMREM environment map.
   * Uses canvas.createImage() — the only DOM-like image API available in
   * WeChat miniprogram WebGL canvas (no document.createElementNS).
   */
  _loadEnvMap(url, showSkybox) {
    this._fetchFile(url).then((localPath) => {
      if (this._disposed) return;
      const ext = localPath.split('.').pop().toLowerCase();
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';

      const tryLoad = (src, fallback) => {
        const img = this._canvas.createImage();
        img.onload = () => {
          if (this._disposed) return;
          this._applyEnvImage(img, showSkybox);
        };
        img.onerror = () => {
          if (fallback) {
            console.warn('[ModelRenderer] envMap src failed, trying fallback:', fallback);
            tryLoad(fallback, null);
          } else {
            console.error('[ModelRenderer] envMap all sources failed, path:', localPath);
          }
        };
        img.src = src;
      };

      // Primary: base64 data URI. Fallback: raw local path (works on some devices).
      const fs = wx.getFileSystemManager();
      fs.readFile({
        filePath: localPath,
        encoding: 'base64',
        success: (res) => {
          if (this._disposed) return;
          console.log('[ModelRenderer] envMap base64 length:', res.data && res.data.length, 'path:', localPath);
          tryLoad(`data:${mime};base64,${res.data}`, localPath);
        },
        fail: () => {
          console.warn('[ModelRenderer] envMap readFile failed, trying path directly');
          tryLoad(localPath, null);
        },
      });
    }).catch((err) => {
      console.error('[ModelRenderer] envMap fetch failed:', err);
    });
  }

  _applyEnvImage(img, showSkybox) {
    const tex = new THREE.Texture(img);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;

    if (this._envTexture) this._envTexture.dispose();
    this._envTexture = tex;

    this._scene.environment = tex;
    if (showSkybox) this._scene.background = tex;

    this._startLoop();
    setTimeout(() => this._stopLoop(), 100);
  }

  /**
   * Download a GLB file from CDN, cache the local path in wx.storage.
   * @returns {Promise<string>} local file path
   */
  _fetchFile(url) {
    return new Promise((resolve, reject) => {
      const key = CACHE_PREFIX + url;
      let cached;
      try { cached = wx.getStorageSync(key); } catch (e) {}

      if (cached) {
        try {
          wx.getFileSystemManager().accessSync(cached);
          console.log('[ModelRenderer] cache hit:', url);
          return resolve(cached);
        } catch (e) {
          // cached file was cleaned up, re-download
        }
      }

      wx.downloadFile({
        url,
        success(res) {
          if (res.statusCode !== 200) {
            return reject(new Error('Download failed: ' + res.statusCode));
          }
          const fs = wx.getFileSystemManager();
          const ext = url.split('?')[0].split('.').pop();
          const dest = wx.env.USER_DATA_PATH + '/' + key.replace(/[^a-zA-Z0-9_]/g, '_') + '.' + ext;
          try {
            fs.copyFileSync(res.tempFilePath, dest);
            wx.setStorageSync(key, dest);
            resolve(dest);
          } catch (e) {
            resolve(res.tempFilePath);
          }
        },
        fail(err) { reject(err); },
      });
    });
  }
}

module.exports = ModelRenderer;
