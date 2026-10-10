import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orbParticles, projectOrb, orbPaths } from './orb-particles';
test('orb points form a reproducible unit sphere and remain bounded during playback', () => {
  const points = orbParticles();
  assert.deepEqual(points, orbParticles());
  assert.equal(points.length, 128);
  for (const p of points) {
    assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-12);
    for (const angle of [0, 1, 3, 6]) for (const activity of [0, .65, 1]) {
      const q = projectOrb(p, angle, 4, activity);
      assert.ok(Object.values(q).every(Number.isFinite));
      assert.ok(q.cx > 0 && q.cx < 56 && q.cy > 0 && q.cy < 56);
      assert.ok(q.opacity >= .2 && q.opacity <= 1 && q.r > 0);
    }
  }
});

test('three drawing layers preserve every thin particle across drag tilts', () => {
  const points = orbParticles();
  for (const angle of [0, 3, 200]) for (const tilt of [-1.1, .32, 1.1]) {
    const paths = orbPaths(points, angle, 4, 1, tilt);
    assert.equal(paths.length, 3);
    assert.equal(paths.join('').split('M').length - 1, points.length);
    assert.ok(!/NaN|Infinity/.test(paths.join('')));
    for (const point of points) {
      const q = projectOrb(point, angle, 4, 1, tilt);
      assert.ok(q.r < 1.1 && q.r > .2);
      assert.ok(q.cx - q.r > 0 && q.cy - q.r > 0 && q.cx + q.r < 56 && q.cy + q.r < 56);
    }
  }
});
