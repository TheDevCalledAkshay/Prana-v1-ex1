/*
 * PRANA — intro configuration.
 * Everything you are likely to change when real footage arrives lives here.
 *
 * SWAPPING THE HAND SHOT
 *   1. Drop your photo (.jpg / .webp) or short loop (.mp4 / .webm, muted) into /assets and set `plate.src`.
 *   2. Open the site with  ?calibrate  e.g.  http://localhost:8000/?calibrate
 *      - click the wrist where the bracelet should sit
 *      - mouse wheel      = bracelet size
 *      - ← / →            = direction it slides off (degrees)
 *      - ↑ / ↓            = how far it slides
 *      - Space            = preview the slide
 *      The readout in the corner is exactly what to paste below.
 *
 * Coordinates are fractions of the IMAGE (0–1), not of the screen, so they stay
 * correct on phones and ultrawide monitors alike.
 */
export const CONFIG = {
  plate: {
    src: 'assets/hand-plate.jpg',
    focus: '50% 50%',        // object-position: which part of the image stays visible when cropped
    wrist: { x: 0.62, y: 0.56 },
    wristSize: 0.2,          // bracelet diameter on the wrist, as a fraction of image height
    slideAngle: 160,         // screen direction (deg, 0 = right, 90 = down) it slides off toward the hand
    slideDistance: 0.17,     // how far it slides, as a fraction of image height
    kenBurns: 1.1            // slow push-in over the whole intro
  },

  bracelet: {
    beadRadius: 0.15,        // world units; ring size is derived from this
    // [material, relative size]. 'gold' entries are flat rondelle spacers.
    pattern: [
      ['forest', 1.34], ['gold', 1], ['jade', 1], ['jade', 1], ['moon', 1.04], ['jade', 1], ['gold', 1],
      ['jade', 1], ['moon', 1.04], ['jade', 1], ['jade', 1], ['gold', 1], ['jade', 1], ['moon', 1.04],
      ['jade', 1], ['jade', 1], ['gold', 1], ['moon', 1.04], ['jade', 1], ['jade', 1], ['gold', 1], ['jade', 1]
    ],
    colors: { jade: 0x86a98f, forest: 0x1f4a38, moon: 0xeceef2, gold: 0xd7b46c, thread: 0x2b2118 }
  },

  /* seconds — edit to taste; the whole film is ~7.4s */
  timing: { total: 7.4 },

  /* how long to wait for Three.js + the plate before giving up and showing the site */
  loadTimeoutMs: 9000
};
