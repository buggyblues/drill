type Rect = { x: number; y: number; w: number; h: number };
export function edgeGeometry(a: Rect, b: Rect, offset = 0) {
    const ax = a.x + a.w / 2, ay = a.y + a.h / 2, bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const dx = bx - ax, dy = by - ay;
    let x1: number, y1: number, x2: number, y2: number, c1x: number, c1y: number, c2x: number, c2y: number;
    if (Math.abs(dx) > Math.abs(dy)) {
        const sign = dx >= 0 ? 1 : -1, bend = Math.max(24, Math.abs(dx) * .4);
        x1 = ax + sign * a.w / 2; y1 = ay; x2 = bx - sign * b.w / 2; y2 = by;
        c1x = x1 + sign * bend; c1y = y1; c2x = x2 - sign * bend; c2y = y2;
    } else {
        const sign = dy >= 0 ? 1 : -1, bend = Math.max(24, Math.abs(dy) * .4);
        x1 = ax; y1 = ay + sign * a.h / 2; x2 = bx; y2 = by - sign * b.h / 2;
        c1x = x1; c1y = y1 + sign * bend; c2x = x2; c2y = y2 - sign * bend;
    }
    return { x1: x1 + offset, y1: y1 + offset, x2: x2 + offset, y2: y2 + offset,
        path: `M${x1 + offset} ${y1 + offset}C${c1x + offset} ${c1y + offset},${c2x + offset} ${c2y + offset},${x2 + offset} ${y2 + offset}` };
}
