// Pick a quality tier before anything is built. Laptop GPUs (Apple, Intel) get the light preset.
// Override with ?quality=high or ?quality=low.

function gpuName() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return name;
  } catch { return ''; }
}

const forced = new URLSearchParams(location.search).get('quality');
const gpu = gpuName();
const tier = forced ?? (/NVIDIA|Radeon|AMD/i.test(gpu) && !/Apple/i.test(gpu) ? 'high' : 'low');

export const Q = tier === 'high' ? {
  tier, gpu,
  pixelRatio: Math.min(devicePixelRatio, 1.5),
  lampPool: 6,        // real spotlights shared by all the inscriptions & display pieces
  disco: 6, rims: 3, shadows: true,
  msaa: 0, bloomScale: 0.5, mirrorRes: 1024,
} : {
  tier, gpu,
  pixelRatio: 1,
  lampPool: 3,
  disco: 3, rims: 2, shadows: false,
  msaa: 0, bloomScale: 0.35, mirrorRes: 512,
};
