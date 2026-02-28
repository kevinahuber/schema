// Plant color palettes organized by biome.
// A random selection is generated fresh for each drawing session.

const DARKS = [
  '#1a4d20', // deep jungle
  '#1a3a1a', // deep pine
  '#1e3d3d', // dark spruce
  '#1a4a3a', // dark mangrove
  '#2a1208', // dark seed coat
  '#2e3d1a', // deep olive
  '#2c1a0a', // rich soil
];

const COLORS = [
  // Tropical rainforest
  '#2e8b35', '#52c448', '#a8e06a',
  '#ff5722', '#e91e8c', '#9c27b0', '#ffd600', '#ff9800',

  // Desert & xeric
  '#b83c12', '#d4693a', '#e8a86a', '#f2d4a0',
  '#7a9a4a', '#4d7a3a', '#8aac58',

  // Temperate forest
  '#2e6b34', '#4a8c3f', '#6b8e23',
  '#8b4513', '#b87333', '#d4a04a', '#cd853f',

  // Boreal / taiga
  '#2f5c5c', '#4a8070', '#7aab8f', '#c4b49a',

  // Alpine / tundra
  '#5a7a6a', '#8aaa98', '#b0c8b4', '#d0e8d0',

  // Wetland / bog
  '#2c6b52', '#4a9c6a', '#8fbc8f', '#6b4c3b', '#7b4a8b', '#4a6b8a',

  // Prairie / savanna
  '#8b6914', '#c8a84b', '#daa520', '#cd7f32', '#8b5a2b',

  // Seeds & propagation
  '#6b3820', '#8b5030', '#a87048', '#c89060', '#e8c87a', '#f0d4a8',
];

export function randomPalette(count = 6) {
  const dark = DARKS[Math.floor(Math.random() * DARKS.length)];
  const shuffled = [...COLORS].sort(() => Math.random() - 0.5);
  return [dark, ...shuffled.slice(0, count - 2), '#ffffff'];
}
