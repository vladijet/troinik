export const PIPE_TYPES = {
  ppr_pn20: {
    name: 'ППР PN20',
    roughness: 0.007,
    maxVelocity: 0.8,
    sizes: [
      { outer: 20, wall: 2.8, inner: 14.4 },
      { outer: 25, wall: 3.5, inner: 18.0 },
      { outer: 32, wall: 4.4, inner: 23.2 },
      { outer: 40, wall: 5.5, inner: 29.0 },
      { outer: 50, wall: 6.9, inner: 36.2 },
      { outer: 63, wall: 8.6, inner: 45.8 },
    ]
  },
  ppr_pn25: {
    name: 'ППР PN25',
    roughness: 0.007,
    maxVelocity: 0.8,
    sizes: [
      { outer: 20, wall: 3.4, inner: 13.2 },
      { outer: 25, wall: 4.2, inner: 16.6 },
      { outer: 32, wall: 5.4, inner: 21.2 },
      { outer: 40, wall: 6.7, inner: 26.6 },
      { outer: 50, wall: 8.3, inner: 33.4 },
      { outer: 63, wall: 10.5, inner: 42.0 },
    ]
  },
  metal_plastic: {
    name: 'Металлопластик (PEX-Al-PEX)',
    roughness: 0.002,
    maxVelocity: 1.0,
    sizes: [
      { outer: 16, wall: 2.0, inner: 12.0 },
      { outer: 20, wall: 2.0, inner: 16.0 },
      { outer: 26, wall: 3.0, inner: 20.0 },
      { outer: 32, wall: 3.0, inner: 26.0 },
      { outer: 40, wall: 3.5, inner: 33.0 },
      { outer: 50, wall: 4.0, inner: 42.0 },
      { outer: 63, wall: 4.5, inner: 54.0 },
    ]
  },
  pex: {
    name: 'Сшитый полиэтилен (PEX)',
    roughness: 0.002,
    maxVelocity: 1.0,
    sizes: [
      { outer: 16, wall: 2.0, inner: 12.0 },
      { outer: 20, wall: 2.0, inner: 16.0 },
      { outer: 25, wall: 2.3, inner: 20.4 },
      { outer: 32, wall: 2.9, inner: 26.2 },
      { outer: 40, wall: 3.7, inner: 32.6 },
    ]
  },
  stainless: {
    name: 'Нержавеющая сталь',
    roughness: 0.01,
    maxVelocity: 1.5,
    sizes: [
      { outer: 15, wall: 1.0, inner: 13.0 },
      { outer: 18, wall: 1.0, inner: 16.0 },
      { outer: 22, wall: 1.2, inner: 19.6 },
      { outer: 28, wall: 1.2, inner: 25.6 },
      { outer: 35, wall: 1.5, inner: 32.0 },
      { outer: 42, wall: 1.5, inner: 39.0 },
      { outer: 54, wall: 1.5, inner: 51.0 },
    ]
  }
};