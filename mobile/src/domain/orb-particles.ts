export type OrbParticle = { x: number; y: number; z: number; phase: number };
/** Vernato's Fibonacci lattice, deterministically phased for a compact playback control. */
export function orbParticles(count = 128): OrbParticle[] {
  const golden = (1 + Math.sqrt(5)) / 2;
  return Array.from({ length: count }, (_, i) => {
    const theta = Math.acos(1 - 2 * (i + .5) / count), phi = 2 * Math.PI * i / golden;
    return { x: Math.sin(theta) * Math.cos(phi), y: Math.sin(theta) * Math.sin(phi), z: Math.cos(theta), phase: phi % (2 * Math.PI) };
  });
}
export function projectOrb(p: OrbParticle, angle: number, time: number, activity: number, tilt = .32) {
  'worklet';
  const radius = 19 * (1 + Math.sin(time * 1.2 + p.phase * .5) * .01 + activity * Math.sin(time * 3.3 + p.phase) * .045);
  const x = p.x * Math.cos(angle) + p.z * Math.sin(angle), z = -p.x * Math.sin(angle) + p.z * Math.cos(angle);
  const y = p.y * Math.cos(tilt) - z * Math.sin(tilt), depth = p.y * Math.sin(tilt) + z * Math.cos(tilt);
  const perspective = 3.5 / (3.5 + depth), front = (depth + 1) / 2;
  return { cx: 28 + x * radius * perspective, cy: 28 + y * radius * perspective, r: (.36 + front * .38) * perspective, opacity: .22 + front * .78 };
}

/** One projection pass, three native path updates instead of one update per dot. */
export function orbPaths(points: OrbParticle[], angle: number, time: number, activity: number, tilt: number): [string, string, string] {
  'worklet';
  const paths: [string, string, string] = ['', '', ''];
  const ca = Math.cos(angle), sa = Math.sin(angle), ct = Math.cos(tilt), st = Math.sin(tilt);
  for (const p of points) {
    const x = p.x * ca + p.z * sa, z = -p.x * sa + p.z * ca;
    const y = p.y * ct - z * st, depth = p.y * st + z * ct;
    const perspective = 3.5 / (3.5 + depth), front = (depth + 1) / 2;
    const radius = 19 * (1 + Math.sin(time * 1.2 + p.phase * .5) * .01 + activity * Math.sin(time * 3.3 + p.phase) * .045);
    const cx = 28 + x * radius * perspective, cy = 28 + y * radius * perspective;
    const r = (.36 + front * .38) * perspective, diameter = (r * 2).toFixed(2), rs = r.toFixed(2);
    const bucket = front < .33 ? 0 : front < .67 ? 1 : 2;
    paths[bucket] += `M${(cx - r).toFixed(2)},${cy.toFixed(2)}a${rs},${rs} 0 1,0 ${diameter},0a${rs},${rs} 0 1,0 -${diameter},0Z`;
  }
  return paths;
}
