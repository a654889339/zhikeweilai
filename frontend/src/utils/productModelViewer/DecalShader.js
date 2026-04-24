/**
 * Cylindrical decal via onBeforeCompile (aligned with wechat-mp DecalShader.js).
 */
import * as THREE from 'three';

// GLSL injected after map_fragment — overrides diffuseColor.rgb in decal region
const DECAL_FRAGMENT_COLOR = /* glsl */ `
  {
    vec3 wp = vDecalWorldPos;
    float angle = atan(wp.z, wp.x);
    float u = (angle - decalAngle) / decalArcWidth + 0.5;
    float v = (wp.y - decalHeight) / decalHeightRange / decalAspect + 0.5;
    u = (u - 0.5) / decalScaleX + 0.5;
    v = (v - 0.5) / decalScaleY + 0.5;

    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
      vec4 dc = texture2D(decalTexture, vec2(1.0 - u, v));
      vDecalBlend = dc.a * decalOpacity;
      diffuseColor.rgb = mix(diffuseColor.rgb, dc.rgb, vDecalBlend);
      // alpha: decal区域用贴花自己的alpha，不受底层材质透明度影响
      diffuseColor.a = mix(diffuseColor.a, dc.a, vDecalBlend);
    }
  }
`;

// injected after metalnessmap_fragment — override metalness in decal region
const DECAL_FRAGMENT_METALNESS = /* glsl */ `
  metalnessFactor = mix(metalnessFactor, decalMetalness, vDecalBlend);
`;

// injected after roughnessmap_fragment — override roughness in decal region
const DECAL_FRAGMENT_ROUGHNESS = /* glsl */ `
  roughnessFactor = mix(roughnessFactor, decalRoughness, vDecalBlend);
`;

// GLSL injected into the vertex shader to pass world position
const DECAL_VERTEX_INJECT = /* glsl */ `
  vDecalWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
`;

export class DecalProjector {
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

    const aspect =
      ((arcWidth * cylinderRadius) / heightRange) * (textureHeight / textureWidth);

    this._texture = texture;
    this._uniforms = {
      decalTexture: { value: texture },
      decalAngle: { value: 0 },
      decalHeight: { value: 0 },
      decalArcWidth: { value: arcWidth },
      decalHeightRange: { value: heightRange },
      decalOpacity: { value: opacity },
      decalScaleX: { value: scaleX },
      decalScaleY: { value: scaleY },
      decalAspect: { value: aspect },
      decalMetalness: { value: 0.0 },
      decalRoughness: { value: 0.5 },
    };
    this._cylinderRadius = cylinderRadius;
    this._patchedMaterials = [];
  }

  setAngle(rad) {
    this._uniforms.decalAngle.value = rad;
  }

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

  setOpacity(v) {
    this._uniforms.decalOpacity.value = v;
  }

  setScaleX(v) {
    this._uniforms.decalScaleX.value = v;
  }

  setScaleY(v) {
    this._uniforms.decalScaleY.value = v;
  }

  /** Metalness of the decal surface (0–1). */
  setMetalness(v) {
    this._uniforms.decalMetalness.value = v;
  }

  /** Roughness of the decal surface (0–1). */
  setRoughness(v) {
    this._uniforms.decalRoughness.value = v;
  }

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

  _patchMaterial(mat) {
    const uniforms = this._uniforms;
    const prevCompile = mat.onBeforeCompile;
    mat._originalOnBeforeCompile = prevCompile;

    mat.onBeforeCompile = (shader) => {
      if (prevCompile) prevCompile(shader);

      Object.assign(shader.uniforms, uniforms);

      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying vec3 vDecalWorldPos;\nvoid main() {')
        .replace('#include <project_vertex>', '#include <project_vertex>\n' + DECAL_VERTEX_INJECT);

      // Fragment: declare uniforms + varyings + inject blends
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
            'uniform float decalMetalness;',
            'uniform float decalRoughness;',
            'varying vec3 vDecalWorldPos;',
            'float vDecalBlend = 0.0;',
            'void main() {',
          ].join('\n')
        )
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + DECAL_FRAGMENT_COLOR)
        .replace(
          '#include <metalnessmap_fragment>',
          '#include <metalnessmap_fragment>\n' + DECAL_FRAGMENT_METALNESS
        )
        .replace(
          '#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\n' + DECAL_FRAGMENT_ROUGHNESS
        );
    };

    mat.customProgramCacheKey = () => 'decal_' + Date.now();

    mat._decalPatched = true;
    mat.needsUpdate = true;
    this._patchedMaterials.push(mat);
  }
}
