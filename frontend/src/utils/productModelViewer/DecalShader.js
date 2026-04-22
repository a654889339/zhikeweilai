/**
 * Cylindrical decal via onBeforeCompile (aligned with wechat-mp DecalShader.js).
 */
import * as THREE from 'three';

const DECAL_FRAGMENT_INJECT = /* glsl */ `
  {
    vec3 wp = vDecalWorldPos;

    float angle = atan(wp.z, wp.x);
    float u = (angle - decalAngle) / decalArcWidth + 0.5;
    float v = (wp.y - decalHeight) / decalHeightRange / decalAspect + 0.5;

    u = (u - 0.5) / decalScaleX + 0.5;
    v = (v - 0.5) / decalScaleY + 0.5;

    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0) {
      vec4 dc = texture2D(decalTexture, vec2(1.0 - u, v));
      diffuseColor.rgb = mix(diffuseColor.rgb, dc.rgb, dc.a * decalOpacity);
    }
  }
`;

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
        .replace('#include <map_fragment>', '#include <map_fragment>\n' + DECAL_FRAGMENT_INJECT);
    };

    mat.customProgramCacheKey = () => 'decal_' + Date.now();

    mat._decalPatched = true;
    mat.needsUpdate = true;
    this._patchedMaterials.push(mat);
  }
}
