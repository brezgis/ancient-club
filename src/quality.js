// Quality presets. Desktop GPUs (NVIDIA, AMD) get the full show; laptop GPUs (Apple, Intel) get
// fewer lights and no shadows. Both render at up to 1.5× device pixels so text and edges stay
// sharp on retina screens; the adaptive ladder in post.js steps down if frames get slow.
// Override with ?quality=high or ?quality=low.

export const Q = {};

export function initQuality(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  const forced = new URLSearchParams(location.search).get('quality');
  const tier = forced ?? (/NVIDIA|Radeon|AMD/i.test(gpu) && !/Apple/i.test(gpu) ? 'high' : 'low');
  const dpr = Math.min(devicePixelRatio, 1.5);
  Object.assign(Q, tier === 'high'
    ? { tier, gpu, pixelRatio: dpr, msaa: 4, lampPool: 6, disco: 6, rims: 3, shadows: true, bloomScale: 0.5, mirrorRes: 2048 }
    : { tier, gpu, pixelRatio: dpr, msaa: 0, lampPool: 3, disco: 3, rims: 2, shadows: false, bloomScale: 0.35, mirrorRes: 1280 });
  return Q;
}
