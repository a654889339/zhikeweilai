/**
 * DecalShader
 * Injects cylindrical-projection decal onto existing MeshStandardMaterial
 * via onBeforeCompile, preserving full PBR lighting.
 *
 * Projection model:
 *   - A virtual infinite cylinder aligned to world Y axis
 *   - U = angle around Y axis, centered on `decalAngle`
 *   - V = world Y height, centered on `decalHeight`
 *
 * Usage:
 *   const decal = new DecalProjector(texture);
 *   decal.applyToModel(gltfScene);
 *   decal.setAngle(Math.PI / 2);
 *   decal.setHeight(0.5);
 *   decal.remove();
 */

const THREE = require('../../../libs/three.min.js');

// GLSL injected after map_fragment — modifies diffuseColor before lighting
const DECAL_FRAGMENT_INJECT = /* glsl */`
  {
    vec3 wp = vDecalWorldPos;

    float angle = atan(wp.z, wp.x);
    float u = (angle - decalAngle) / decalArcWidth + 0.5;
    // v is scaled by aspect (arcLen/heightRange) so 1 unit in v = 1 unit in u (world space)
    float v = (wp.y - decalHeight) / decalHeightRange / decalAspect + 0.5;

    u = (u - 0.5) / decalScaleX + 0.5;
    v = (v - 0.5) / decalScaleY + 0.5;

    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
      vec4 dc = texture2D(decalTexture, vec2(1.0 - u, v));
      diffuseColor.rgb = mix(diffuseColor.rgb, dc.rgb, dc.a * decalOpacity);
    }
  }
`;

// GLSL injected into the vertex shader to pass world position
const DECAL_VERTEX_INJECT = /* glsl */`
  vDecalWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
`;

class DecalProjector {
  /**
   * @param {THREE.Texture} texture  The decal texture (RGBA recommended)
   * @param {object} options
   * @param {number} options.arcWidth   Angular width in radians (default π/3 ≈ 60°)
   * @param {number} options.heightRange  Height span in world units (default 1.0)
   * @param {number} options.opacity   Blend opacity 0–1 (default 1.0)
   */
  constructor(texture, options = {}) {
    const {
      arcWidth = Math.PI / 3,
      heightRange = 1.0,
      opacity = 1.0,
      scaleX = 1.0,
      scaleY = 1.0,
      cylinderRadius = 1.0,
      textureWidth = 1,
      textureHeight = 1,
    } = options;

    const aspect = (arcWidth * cylinderRadius / heightRange) * (textureHeight / textureWidth);
    console.log('[Decal] radius:', cylinderRadius.toFixed(3), 'texRatio:', (textureWidth/textureHeight).toFixed(3), 'aspect:', aspect.toFixed(3));

    this._texture = texture;
    this._uniforms = {
      decalTexture:     { value: texture },
      decalAngle:       { value: 0 },
      decalHeight:      { value: 0 },
      decalArcWidth:    { value: arcWidth },
      decalHeightRange: { value: heightRange },
      decalOpacity:     { value: opacity },
      decalScaleX:      { value: scaleX },
      decalScaleY:      { value: scaleY },
      decalAspect:      { value: aspect },
    };
    this._cylinderRadius = cylinderRadius;
    this._patchedMaterials = [];
  }

  /** Angle (radians) of the decal center around the world Y axis. */
  setAngle(rad) {
    this._uniforms.decalAngle.value = rad;
  }

  /** World-Y coordinate of the decal center. */
  setHeight(y) {
    this._uniforms.decalHeight.value = y;
  }

  setArcWidth(rad) {
    this._uniforms.decalArcWidth.value = rad;
    this._uniforms.decalAspect.value = rad / this._uniforms.decalHeightRange.value;
  }

  setHeightRange(h) {
    this._uniforms.decalHeightRange.value = h;
    this._uniforms.decalAspect.value = this._uniforms.decalArcWidth.value / h;
  }

  /** Blend opacity 0–1. */
  setOpacity(v) {
    this._uniforms.decalOpacity.value = v;
  }

  /** Horizontal scale (>1 stretches, <1 shrinks). */
  setScaleX(v) {
    this._uniforms.decalScaleX.value = v;
  }

  /** Vertical scale (>1 stretches, <1 shrinks). */
  setScaleY(v) {
    this._uniforms.decalScaleY.value = v;
  }

  /**
   * Patch all MeshStandardMaterial / MeshPhysicalMaterial in the model.
   * Safe to call multiple times — already-patched materials are skipped.
   * @param {THREE.Object3D} model
   */
  applyToModel(model) {
    model.traverse((obj) => {
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        if (!mat || mat._decalPatched) return;
        this._patchMaterial(mat);
      });
    });
  }

  /**
   * Remove decal from all patched materials.
   * Restores original onBeforeCompile and forces shader recompile.
   */
  remove() {
    this._patchedMaterials.forEach((mat) => {
      mat.onBeforeCompile = mat._originalOnBeforeCompile || (() => {});
      mat._decalPatched = false;
      mat.needsUpdate = true;
    });
    this._patchedMaterials = [];
  }

  dispose() {
    this.remove();
    if (this._texture) this._texture.dispose();
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _patchMaterial(mat) {
    const uniforms = this._uniforms;
    const prevCompile = mat.onBeforeCompile;
    mat._originalOnBeforeCompile = prevCompile;

    mat.onBeforeCompile = (shader) => {
      if (prevCompile) prevCompile(shader);

      Object.assign(shader.uniforms, uniforms);

      // Vertex: declare varying + inject world pos
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          'varying vec3 vDecalWorldPos;\nvoid main() {'
        )
        .replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n' + DECAL_VERTEX_INJECT
        );

      // Fragment: declare uniforms + varying + inject blend before output
      shader.fragmentShader = shader.fragmentShader
        .replace(
          'void main() {',
          [
            'uniform sampler2D decalTexture;',
            'uniform float decalAngle;',
            'uniform float decalHeight;',
            'uniform float decalArcWidth;',
            'uniform float decalHeightRange;',
            'uniform float decalOpacity;',
            'uniform float decalScaleX;',
            'uniform float decalScaleY;',
            'uniform float decalAspect;',
            'varying vec3 vDecalWorldPos;',
            'void main() {',
          ].join('\n')
        )
        .replace(
          '#include <map_fragment>',
          '#include <map_fragment>\n' + DECAL_FRAGMENT_INJECT
        );

      // Force shader recompile — customProgramCacheKey makes Three.js treat this
      // as a distinct program even if the base material was already compiled.
    };

    mat.customProgramCacheKey = () => 'decal_' + Date.now();

    mat._decalPatched = true;
    mat.needsUpdate = true;
    this._patchedMaterials.push(mat);
  }
}

module.exports = DecalProjector;
