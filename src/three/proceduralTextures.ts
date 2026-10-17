import * as THREE from 'three';

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return { width, height, getContext: () => null } as unknown as HTMLCanvasElement;
}

/**
 * Generates a fine satin-white metallic micro-flake & panel-seam texture for the Roadster body.
 */
export function createRoadsterSatinPanelTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0.0, '#ffffff');
    grad.addColorStop(0.5, '#f5f5f5');
    grad.addColorStop(1.0, '#e5e5e5');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Subtle micro-grain brushed metallic lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < 512; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Precision cyber-panel seam lines
    ctx.strokeStyle = 'rgba(20, 20, 20, 0.35)';
    ctx.lineWidth = 2;
    for (const seamY of [110, 256, 402]) {
      ctx.beginPath();
      ctx.moveTo(0, seamY);
      ctx.lineTo(512, seamY);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Generates a woven 2x2 diagonal twill carbon-fiber texture for splitters, skirts, wing pylons & aero discs.
 */
export function createCarbonWeaveTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 8) {
      for (let x = 0; x < 128; x += 8) {
        const shift = (y / 8) % 2 === 0 ? 0 : 4;
        ctx.fillStyle = '#262626';
        ctx.fillRect((x + shift) % 128, y, 4, 4);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect((x + shift + 4) % 128, y, 4, 4);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

/**
 * Generates a grooved tire tread & sidewall texture.
 */
export function createTireTreadTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#222222';
    for (let y = 0; y < 256; y += 16) {
      ctx.fillRect(20, y, 80, 8);
      ctx.fillRect(156, y + 6, 80, 8);
    }
    ctx.fillStyle = '#050505';
    ctx.fillRect(108, 0, 14, 256);
    ctx.fillRect(134, 0, 14, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Generates the Tesla Demo Stunt Road monochrome asphalt texture with white lane markings,
 * launch chevrons, and tire rubber skid marks.
 */
export function createStuntRoadTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(1024, 256);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, 1024, 256);

    // Asphalt grain speckle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 900; i++) {
      ctx.fillRect((i * 97) % 1024, (i * 53) % 256, 3, 2);
    }

    // Outer white boundary stripes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 12, 1024, 6);
    ctx.fillRect(0, 238, 1024, 6);

    // Dashed centerline & launch chevrons
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 4;
    for (let x = 30; x < 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 96);
      ctx.lineTo(x + 22, 128);
      ctx.lineTo(x, 160);
      ctx.stroke();
    }

    // Tire skid marks on launch & landing deck
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(80, 68, 360, 14);
    ctx.fillRect(80, 174, 360, 14);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * Generates the Starship 304L brushed stainless-steel ring weld & hexagonal TPS tile grid texture.
 */
export function createStarshipHullAndTpsTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(512, 1024);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const metalGrad = ctx.createLinearGradient(0, 0, 512, 0);
    metalGrad.addColorStop(0.0, '#d4d4d4');
    metalGrad.addColorStop(0.25, '#f5f5f5');
    metalGrad.addColorStop(0.5, '#a3a3a3');
    metalGrad.addColorStop(1.0, '#d4d4d4');
    ctx.fillStyle = metalGrad;
    ctx.fillRect(0, 0, 512, 1024);

    // Stainless barrel ring welds & vertical stringers
    ctx.strokeStyle = 'rgba(38, 38, 38, 0.6)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 1024; y += 36) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Windward Black Hexagonal TPS Heat Shield Tile Grid with jagged boundary
    for (let y = 0; y < 1024; y += 14) {
      const jaggedOffset = ((y * 17) % 44) - 18;
      const startX = 272 + jaggedOffset;
      for (let x = startX; x < 512; x += 14) {
        const shade = (x + y) % 28 === 0 ? '#1f1f1f' : '#0f0f0f';
        ctx.fillStyle = shade;
        ctx.fillRect(x, y, 12, 12);
      }
    }

    // Center raceway conduit & inspection portholes
    ctx.fillStyle = '#404040';
    ctx.fillRect(138, 160, 9, 780);
    ctx.fillStyle = '#0a0a0a';
    for (const py of [310, 540, 820]) {
      ctx.beginPath();
      ctx.arc(178, py, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/**
 * Generates weathered concrete & steel grid texture for the Orbital Launch Paddock.
 */
export function createPaddockDeckTexture(): THREE.CanvasTexture {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // Paddock blast pad concentric rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 3;
    for (const r of [60, 120, 190]) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  return new THREE.CanvasTexture(canvas);
}
