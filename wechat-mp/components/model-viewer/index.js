const ModelRenderer = require('./utils/ModelRenderer');
Component({
  properties: {
    bgColor:  { type: String, value: '#b3b3b3' },
    canvasId: { type: String, value: 'model-viewer-canvas' },
  },

  data: {
    loading: false,
    error: '',
  },

  lifetimes: {
    ready() {
      setTimeout(() => this._initRenderer(), 300);
    },
    detached() {
      if (this._renderer) this._renderer.dispose();
    },
  },

  methods: {
    /**
     * Load a GLB/GLTF model from a CDN URL.
     * @param {string} url
     * @returns {Promise<void>}
     */
    loadModel(url) {
      if (!this._renderer) {
        return new Promise((resolve, reject) => {
          this._pendingLoad = { url, resolve, reject };
        });
      }
      return this._doLoad(url);
    },

    /**
     * Remove current model and load a new one.
     * @param {string} url
     * @returns {Promise<void>}
     */
    switchModel(url) {
      if (this._renderer) this._renderer._clearCurrentModel();
      return this.loadModel(url);
    },

    /**
     * Apply a cylindrical decal to the current model.
     * @param {string} url  Decal texture URL (PNG with alpha recommended)
     * @param {object} options
     * @param {number} options.angle        Center angle in radians around world Y (default 0)
     * @param {number} options.height       Center height in world units (default 0)
     * @param {number} options.arcWidth     Angular width in radians (default π/3)
     * @param {number} options.heightRange  Height span in world units (default 1.0)
     * @param {number} options.opacity      Blend opacity 0–1 (default 1.0)
     * @returns {Promise<void>}
     */
    applyDecal(url, options = {}) {
      if (!this._renderer) return Promise.reject(new Error('renderer not ready'));
      return this._renderer.applyDecal(url, options);
    },

    /**
     * Update decal position without reloading the texture.
     * @param {number} angle   Center angle in radians around world Y
     * @param {number} height  Center height in world units
     */
    updateDecal(angle, height, scaleX = 1.0, scaleY = 1.0) {
      this._renderer && this._renderer.updateDecal(angle, height, scaleX, scaleY);
    },

    /** Remove the current decal. */
    removeDecal() {
      this._renderer && this._renderer.removeDecal();
    },

    onTouchStart(e) {
      this._renderer && this._renderer.onTouchStart(e);
    },

    onTouchMove(e) {
      this._renderer && this._renderer.onTouchMove(e);
    },

    onTouchEnd(e) {
      this._touchLocked = null;
      this._renderer && this._renderer.onTouchEnd(e);
    },

    _initRenderer() {
      const tryQuery = () => {
        wx.createSelectorQuery()
          .in(this)
          .select('#' + this.data.canvasId)
          .fields({ node: true, size: true })
          .exec((res) => {
            if (!res || !res[0] || !res[0].node) {
              setTimeout(tryQuery, 200);
              return;
            }
            const { node, width, height } = res[0];
            this._renderer = new ModelRenderer(node, {
              bgColor: this.data.bgColor,
              envMap: 'http://106.54.50.88:5301/res/model-viewer/skybox.png',
              showSkybox: true,
              width,
              height,
            });

            if (this._pendingLoad) {
              const { url, resolve, reject } = this._pendingLoad;
              this._pendingLoad = null;
              this._doLoad(url).then(resolve).catch(reject);
            }
          });
      };
      tryQuery();
    },

    _doLoad(url) {
      this.setData({ loading: true, error: '' });
      return this._renderer.loadModel(url)
        .then(() => this.setData({ loading: false }))
        .catch((err) => {
          console.error('[model-viewer] load error:', err);
          this.setData({ loading: false, error: String(err.message || err) });
        });
    },
  },
});
