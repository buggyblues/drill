import test from 'node:test';
import assert from 'node:assert/strict';
import { edgeGeometry } from '../packages/ui/src/canvasGeometry.ts';
const a = { x: 100, y: 100, w: 200, h: 100 };
test('canvas edges enter facing sides in all four directions', () => {
    for (const [b, expected] of [
        [{ x: 500, y: 100, w: 200, h: 100 }, [300,150,500,150]],
        [{ x: -300, y: 100, w: 200, h: 100 }, [100,150,-100,150]],
        [{ x: 100, y: 400, w: 200, h: 100 }, [200,200,200,400]],
        [{ x: 100, y: -200, w: 200, h: 100 }, [200,100,200,-100]],
    ] as const) {
        const edge = edgeGeometry(a, b);
        assert.deepEqual([edge.x1, edge.y1, edge.x2, edge.y2], expected);
        assert.ok(!edge.path.includes('NaN'));
    }
});
test('canvas coordinates support unequal sizes, diagonals and SVG offset', () => {
    const b = { x: 500, y: 250, w: 100, h: 80 }, edge = edgeGeometry(a, b, 4000);
    assert.deepEqual([edge.x1, edge.y1, edge.x2, edge.y2], [4300,4150,4500,4290]);
    const vertical = edgeGeometry(a, { x: 350, y: 500, w: 60, h: 120 });
    assert.deepEqual([vertical.x1, vertical.y1, vertical.x2, vertical.y2], [200,200,380,500]);
});
