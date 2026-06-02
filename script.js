const paletteObj = {
    black: '#1a1a1a',
    white: '#f5f5f5',
    lightGray: '#a0a0a0',
    darkGray: '#505050',
    red: '#d42b2b',
    darkGreen: '#2a7a2a',
    limeGreen: '#8cc800',
    skyBlue: '#6aafd6',
    orange: '#e8621a',
    yellow: '#f0d000',
    cobaltBlue: '#2a3fa0',
};

const bgNeutrals = [paletteObj.black, paletteObj.white];
const allColors = [
    paletteObj.red, paletteObj.darkGreen, paletteObj.limeGreen,
    paletteObj.skyBlue, paletteObj.orange, paletteObj.yellow, paletteObj.cobaltBlue,
];

let activeColors = [];
let rings = [];
let giantBackgrounds = [];
let state = 'INITIAL';
let orientation = 'VERTICAL';
let spacing = 0;
let globalDragAngle = 0;
let globalBgPool = [];
let bgTexture;

// ─── p5 lifecycle ────────────────────────────────────────────────────────────

function preload() {
    bgTexture = loadImage('fondo 1.png');
}

function setup() {
    let w = windowWidth;
    let h = windowHeight;
    if (w / h > 4 / 5) {
        w = h * 4 / 5;
    } else {
        h = w * 5 / 4;
    }
    createCanvas(w, h);
    generateComposition();
    state = 'GENERATED';
}

function draw() {
    background('#f1ebdb');
    if (state !== 'GENERATED') return;

    if (bgTexture) {
        let imgAspect = bgTexture.width / bgTexture.height;
        let canvasAspect = width / height;
        let drawW, drawH;
        if (canvasAspect > imgAspect) {
            drawW = width;
            drawH = width / imgAspect;
        } else {
            drawH = height;
            drawW = height * imgAspect;
        }
        push();
        blendMode(MULTIPLY);
        imageMode(CENTER);
        tint(255, 80);
        image(bgTexture, width / 2, height / 2, drawW, drawH);
        noTint();
        blendMode(BLEND);
        pop();
    }

    push();
    translate(width / 2, height / 2);
    rotate(globalDragAngle);
    translate(-width / 2, -height / 2);

    for (const bg of giantBackgrounds) { bg.update(); bg.display(); }
    for (const r of rings) { r.displayArcs(); }
    for (const r of rings) { r.displayCore(); }

    pop();
}

function mouseDragged() {
    if (state === 'GENERATED') {
        let deltaX = mouseX - pmouseX;
        globalDragAngle += deltaX * 0.01;
        const maxAngle = PI / 3;
        globalDragAngle = constrain(globalDragAngle, -maxAngle, maxAngle);

        let deltaY = mouseY - pmouseY;

        for (let bg of giantBackgrounds) {
            bg.scaleFactor -= deltaY * 0.005 * bg.dragMultiplier;
            bg.scaleFactor = constrain(bg.scaleFactor, 0.6, 1.4);
        }

        for (let iter = 0; iter < 5; iter++) {
            for (let i = 0; i < giantBackgrounds.length - 1; i++) {
                let bg1 = giantBackgrounds[i];
                let bg2 = giantBackgrounds[i + 1];
                let sum = bg1.scaleFactor + bg2.scaleFactor;
                if (sum > 2.0) {
                    let excess = sum - 2.0;
                    bg1.scaleFactor -= excess / 2;
                    bg2.scaleFactor -= excess / 2;
                }
            }
        }
    }
}

function keyPressed() {
    if (key === ' ' && state === 'GENERATED') {
        orientation = orientation === 'VERTICAL' ? 'DIAGONAL' : 'VERTICAL';
        updatePositions();
    } else if (key === 'r' || key === 'R') {
        generateComposition();
        state = 'GENERATED';
    } else if ((key === 'c' || key === 'C') && state === 'GENERATED') {
        for (const bg of giantBackgrounds) {
            bg.changeColors(globalBgPool);
        }
    } else if ((key === 'v' || key === 'V') && state === 'GENERATED') {
        changeEntirePalette();
    } else if ((key === 's' || key === 'S') && state === 'GENERATED') {
        saveCanvas('Delaunay_Rythmes', 'png');
    }
}

function windowResized() {
    let w = windowWidth;
    let h = windowHeight;
    if (w / h > 4 / 5) {
        w = h * 4 / 5;
    } else {
        h = w * 5 / 4;
    }
    resizeCanvas(w, h);
    if (state === 'GENERATED') updatePositions();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickColor(pool, excludeList) {
    if (!pool || pool.length === 0) return '#000000';

    const valid = pool.filter(c => !excludeList.includes(c));
    if (valid.length > 0) return random(valid);

    const fallback = pool.filter(c => c !== excludeList[0]);
    return fallback.length > 0 ? fallback[0] : pool[0];
}

function shuffleArray(arr) {
    const array = [...arr];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ─── Classes ─────────────────────────────────────────────────────────────────

class GiantBackground {
    constructor(x, y, dBg, chainAngle, bgColors, innerElements, gridIndex) {
        this.x = x;
        this.y = y;
        this.dBg = dBg;
        this.chainAngle = chainAngle;
        this.bgColors = bgColors;
        this.innerElements = innerElements;
        this.gridIndex = gridIndex;

        this.isRotating = false;
        this.dynamicAngle = 0;
        this.rotationSpeed = random(0.005, 0.015) * (random() > 0.5 ? 1 : -1);
        this.scaleFactor = 1.0;
        this.dragMultiplier = random(0.5, 1.5) * (random() > 0.5 ? 1 : -1);
    }

    update() {
        if (this.isRotating) this.dynamicAngle += this.rotationSpeed;
    }

    changeColors(pool) {
        this.bgColors[0] = pickColor(pool, []);
        this.bgColors[1] = pickColor(pool, [this.bgColors[0]]);

        for (let inner of this.innerElements) {
            inner.colorL = pickColor(pool, [this.bgColors[0]]);
            inner.colorR = pickColor(pool, [this.bgColors[1], inner.colorL]);
            if (inner.type === 'FULL') {
                const cFull = pickColor(pool, [this.bgColors[0], this.bgColors[1]]);
                inner.colorL = cFull;
                inner.colorR = cFull;
            } else if (inner.type === 'SPLIT') {
                while (inner.colorL === inner.colorR) {
                    inner.colorR = pickColor(pool, [this.bgColors[1], inner.colorL]);
                }
            }
        }
    }

    display(pg = window) {
        pg.push();
        pg.translate(this.x, this.y);
        pg.rotate(this.chainAngle + this.dynamicAngle);
        pg.scale(this.scaleFactor);
        pg.noStroke();

        pg.fill(this.bgColors[0]);
        pg.arc(0, 0, this.dBg, this.dBg, HALF_PI, TWO_PI - HALF_PI);

        pg.fill(this.bgColors[1]);
        pg.arc(0, 0, this.dBg, this.dBg, -HALF_PI, HALF_PI);

        for (const inner of this.innerElements) {
            const dInner = inner.radius * 2;
            if (inner.type === 'FULL' || inner.type === 'SPLIT' || inner.type === 'LEFT') {
                pg.fill(inner.colorL);
                pg.arc(0, 0, dInner, dInner, HALF_PI, TWO_PI - HALF_PI);
            }
            if (inner.type === 'FULL' || inner.type === 'SPLIT' || inner.type === 'RIGHT') {
                pg.fill(inner.colorR);
                pg.arc(0, 0, dInner, dInner, -HALF_PI, HALF_PI);
            }
        }

        pg.pop();
    }
}

class Ring {
    constructor(x, y, rCore, thickness, colors, arcSide, chainAngle, gridIndex) {
        this.x = x;
        this.y = y;
        this.rCore = rCore;
        this.thickness = thickness;
        this.colors = colors;   // [coreL, coreR, arc, otherArc]
        this.arcSide = arcSide;
        this.chainAngle = chainAngle;
        this.gridIndex = gridIndex;
    }

    shiftColors() {
        [this.colors[0], this.colors[1]] = [this.colors[1], this.colors[0]];
        [this.colors[2], this.colors[3]] = [this.colors[3], this.colors[2]];
    }

    displayArcs(pg = window) {
        pg.push();
        pg.translate(this.x, this.y);
        pg.rotate(this.chainAngle);

        const dStrokeArc = (this.rCore + this.thickness / 2) * 2;
        pg.noFill();
        pg.stroke(this.colors[2]);
        pg.strokeWeight(this.thickness);
        pg.strokeCap(SQUARE);

        if (this.arcSide === 'LEFT') {
            pg.arc(0, 0, dStrokeArc, dStrokeArc, HALF_PI, TWO_PI - HALF_PI);
        } else {
            pg.arc(0, 0, dStrokeArc, dStrokeArc, -HALF_PI, HALF_PI);
        }

        pg.pop();
    }

    displayCore(pg = window) {
        pg.push();
        pg.translate(this.x, this.y);
        pg.rotate(this.chainAngle);

        const dCore = this.rCore * 2;
        pg.noStroke();

        pg.fill(this.colors[0]);
        pg.arc(0, 0, dCore, dCore, HALF_PI, TWO_PI - HALF_PI);

        pg.fill(this.colors[1]);
        pg.arc(0, 0, dCore, dCore, -HALF_PI, HALF_PI);

        pg.pop();
    }
}

// ─── Composition ─────────────────────────────────────────────────────────────

function generateComposition() {
    rings = [];
    giantBackgrounds = [];
    globalDragAngle = 0;
    orientation = random() > 0.5 ? 'VERTICAL' : 'DIAGONAL';

    const numRings = floor(random(6, 9));

    const colds = shuffleArray([
        paletteObj.darkGreen, paletteObj.limeGreen,
        paletteObj.skyBlue, paletteObj.cobaltBlue,
    ]);
    const warms = shuffleArray([paletteObj.red, paletteObj.orange, paletteObj.yellow]);

    activeColors = shuffleArray([colds[0], colds[1], colds[2], colds[3], warms[0], warms[1]]);

    const rCore = min(width, height) * 0.05;
    const ringThickness = rCore * 0.8;
    const rStroke = rCore + ringThickness / 2;
    spacing = rStroke * 2;

    const { startX, startY, stepX, stepY } = computeGrid(numRings);
    const chainAngle = atan2(stepY, stepX) - HALF_PI;

    const coreMode = random() > 0.85 ? 'GRAYS' : 'BW';
    let coreCol1, coreCol2, arcCol1, arcCol2, bgPool;

    if (coreMode === 'GRAYS') {
        coreCol1 = paletteObj.lightGray;
        coreCol2 = paletteObj.darkGray;
        arcCol1 = activeColors[0];
        arcCol2 = activeColors[1];
        bgPool = bgNeutrals;
    } else {
        coreCol1 = paletteObj.black;
        coreCol2 = paletteObj.white;

        if (random() > 0.5) {
            arcCol1 = activeColors[0];
            arcCol2 = activeColors[1];
            const remaining = activeColors.filter(c => c !== arcCol1 && c !== arcCol2);
            bgPool = [];
            for (const c of remaining) {
                bgPool.push(c);
                if (colds.includes(c)) bgPool.push(c);
            }
        } else {
            arcCol1 = paletteObj.black;
            arcCol2 = paletteObj.white;
            bgPool = [];
            for (const c of activeColors) {
                bgPool.push(c);
                if (colds.includes(c)) { bgPool.push(c); bgPool.push(c); }
            }
        }
    }

    globalBgPool = bgPool;

    // Giant backgrounds
    const innerTypes = ['FULL', 'SPLIT', 'LEFT', 'RIGHT'];
    const startIndex = random() > 0.5 ? 0 : 1;
    let prevBgL = null, prevBgR = null;

    for (let i = startIndex; i < numRings; i += 2) {
        const bgCenterX = startX + stepX * i;
        const bgCenterY = startY + stepY * i;
        const dBg = spacing * 2.0;

        const bgL = pickColor(bgPool, [prevBgL]);
        const bgR = pickColor(bgPool, [prevBgR, bgL]);
        prevBgL = bgL; prevBgR = bgR;

        const innerBgElements = [];

        if (random() > 0.5) {
            const type = random(innerTypes);
            let cL = pickColor(bgPool, [bgL]);
            let cR = pickColor(bgPool, [bgR]);

            if (type === 'FULL') {
                const cFull = pickColor(bgPool, [bgL, bgR]);
                cL = cFull; cR = cFull;
            } else if (type === 'SPLIT') {
                while (cL === cR) cR = pickColor(bgPool, [bgR, cL]);
            }

            const rBg = dBg / 2;
            const isBorder = random() > 0.7;
            let rRadius = isBorder
                ? rBg - spacing * 0.15
                : random(spacing * 0.55, rBg * 0.7);
            if (rRadius < spacing * 0.55) rRadius = spacing * 0.55;

            innerBgElements.push({ type, colorL: cL, colorR: cR, radius: rRadius });
        }

        giantBackgrounds.push(
            new GiantBackground(bgCenterX, bgCenterY, dBg, chainAngle, [bgL, bgR], innerBgElements, i)
        );
    }

    // Chain rings
    for (let i = 0; i < numRings; i++) {
        const x = startX + stepX * i;
        const y = startY + stepY * i;
        const isEven = i % 2 === 0;
        const arcSide = isEven ? 'LEFT' : 'RIGHT';
        const cArc = isEven ? arcCol1 : arcCol2;

        let cCoreL = isEven ? coreCol1 : coreCol2;
        let cCoreR = isEven ? coreCol2 : coreCol1;

        // Avoid same color on the visible arc side and core half
        const arcConflict = (arcSide === 'LEFT' && cCoreL === cArc)
            || (arcSide === 'RIGHT' && cCoreR === cArc);
        if (arcConflict) {
            [cCoreL, cCoreR] = [coreCol2, coreCol1];
        }

        const otherArc = isEven ? arcCol2 : arcCol1;
        rings.push(new Ring(x, y, rCore, ringThickness, [cCoreL, cCoreR, cArc, otherArc], arcSide, chainAngle, i));
    }
}

function changeEntirePalette() {
    const colds = shuffleArray([
        paletteObj.darkGreen, paletteObj.limeGreen,
        paletteObj.skyBlue, paletteObj.cobaltBlue,
    ]);
    const warms = shuffleArray([paletteObj.red, paletteObj.orange, paletteObj.yellow]);

    activeColors = shuffleArray([colds[0], colds[1], colds[2], colds[3], warms[0], warms[1]]);

    const coreMode = random() > 0.85 ? 'GRAYS' : 'BW';
    let coreCol1, coreCol2, arcCol1, arcCol2, bgPool;

    if (coreMode === 'GRAYS') {
        coreCol1 = paletteObj.lightGray;
        coreCol2 = paletteObj.darkGray;
        arcCol1 = activeColors[0];
        arcCol2 = activeColors[1];
        bgPool = bgNeutrals;
    } else {
        coreCol1 = paletteObj.black;
        coreCol2 = paletteObj.white;

        if (random() > 0.5) {
            arcCol1 = activeColors[0];
            arcCol2 = activeColors[1];
            const remaining = activeColors.filter(c => c !== arcCol1 && c !== arcCol2);
            bgPool = [];
            for (const c of remaining) {
                bgPool.push(c);
                if (colds.includes(c)) bgPool.push(c);
            }
        } else {
            arcCol1 = paletteObj.black;
            arcCol2 = paletteObj.white;
            bgPool = [];
            for (const c of activeColors) {
                bgPool.push(c);
                if (colds.includes(c)) { bgPool.push(c); bgPool.push(c); }
            }
        }
    }

    globalBgPool = bgPool;

    for (const bg of giantBackgrounds) {
        bg.changeColors(globalBgPool);
    }

    for (let i = 0; i < rings.length; i++) {
        const isEven = i % 2 === 0;
        const arcSide = rings[i].arcSide;
        const cArc = isEven ? arcCol1 : arcCol2;

        let cCoreL = isEven ? coreCol1 : coreCol2;
        let cCoreR = isEven ? coreCol2 : coreCol1;

        const arcConflict = (arcSide === 'LEFT' && cCoreL === cArc)
            || (arcSide === 'RIGHT' && cCoreR === cArc);
        if (arcConflict) {
            [cCoreL, cCoreR] = [coreCol2, coreCol1];
        }

        const otherArc = isEven ? arcCol2 : arcCol1;
        rings[i].colors = [cCoreL, cCoreR, cArc, otherArc];
    }
}

function computeGrid(numRings) {
    let startX, startY, stepX, stepY;

    if (orientation === 'VERTICAL') {
        stepX = 0;
        stepY = spacing;
        startX = width / 2;
        startY = (height - spacing * (numRings - 1)) / 2;
    } else {
        const dx = width * 0.5;
        const dy = height * 0.5;
        const totalDist = dist(0, 0, dx, dy);
        stepX = (dx / totalDist) * spacing;
        stepY = (dy / totalDist) * spacing;
        startX = (width - stepX * (numRings - 1)) / 2;
        startY = (height - stepY * (numRings - 1)) / 2;
    }

    return { startX, startY, stepX, stepY };
}

function updatePositions() {
    if (rings.length === 0) return;

    const { startX, startY, stepX, stepY } = computeGrid(rings.length);
    const chainAngle = atan2(stepY, stepX) - HALF_PI;

    for (const bg of giantBackgrounds) {
        bg.x = startX + stepX * bg.gridIndex;
        bg.y = startY + stepY * bg.gridIndex;
        bg.chainAngle = chainAngle;
    }

    for (const r of rings) {
        r.x = startX + stepX * r.gridIndex;
        r.y = startY + stepY * r.gridIndex;
        r.chainAngle = chainAngle;
    }
}
