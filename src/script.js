document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const startSelect = document.getElementById('start-location');
    const endSelect = document.getElementById('end-location');
    const calculateButton = document.getElementById('calculate-button');
    const distanceResult = document.getElementById('distance-result');
    const haloResult = document.getElementById('halo-result');
    const canvas = document.getElementById('system-map');
    const rotationSlider = document.getElementById('rotation-slider');
    const rotationValueSpan = document.getElementById('rotation-value');

    // --- Canvas Setup ---
    if (!canvas || !canvas.getContext) {
        console.error("Canvas element not found or context unavailable.");
        return;
    }
    const ctx = canvas.getContext('2d');
    const canvasWidth = canvas.width; // Should be 900
    const canvasHeight = canvas.height; // Should be 900

    // --- State Variables ---
    let currentRotationAngle = 210 * Math.PI / 180; // In radians

    // --- Constants ---
    // Removed AU_TO_GM, GM_TO_AU
    // Drastically changed GM_PER_PIXEL to fit new small Gm scale onto large canvas
    const GM_PER_PIXEL = 0.1; // Scale: 0.1 Gm = 1 Pixel (Adjust as needed)
    const CENTER_X = canvasWidth / 2;
    const CENTER_Y = canvasHeight / 2;
    // Removed IN_GAME_SCALE_FACTOR

    // --- Data: Locations (Gm) - BASED ON USER-PROVIDED IN-GAME ORBITAL DISTANCES ---
    // Planet Order: Hurston (12.72), Crusader (19.02), ArcCorp (28.79), MicroTech (43.32)
    // L-Points estimated: L1/L2 at +/- 10% orbital radius; L4/L5 at +/- 60 deg.
    const locations = {
        "Stanton (Star)": { x: 0, y: 0 },

        // --- Hurston (12.72 Gm on +X) ---
        "Hurston": { x: 12.72, y: 0 },
        "HUR-L1": { x: 12.72 * 0.9, y: 0 },            // 10% closer
        "HUR-L2": { x: 12.72 * 1.1, y: 0 },            // 10% further
        "HUR-L3": { x: -12.72, y: 0 },                 // Opposite
        "HUR-L4 (Everus Harbor)": { x: 12.72 * Math.cos(Math.PI / 3), y: 12.72 * Math.sin(Math.PI / 3) }, // +60 deg
        "HUR-L5": { x: 12.72 * Math.cos(-Math.PI / 3), y: 12.72 * Math.sin(-Math.PI / 3) },// -60 deg

        // --- Crusader (19.02 Gm on +Y) ---
        "Crusader": { x: 0, y: 19.02 },
        "Port Olisar (Crusader Orbit)": { x: 0.5, y: 19.02 }, // Small offset from planet
        "CRU-L1": { x: 0, y: 19.02 * 0.9 },            // 10% closer
        "CRU-L2": { x: 0, y: 19.02 * 1.1 },            // 10% further
        "CRU-L3": { x: 0, y: -19.02 },                 // Opposite
        "CRU-L4": { x: 19.02 * Math.cos(Math.PI / 2 + Math.PI / 3), y: 19.02 * Math.sin(Math.PI / 2 + Math.PI / 3) }, // +60 deg
        "CRU-L5": { x: 19.02 * Math.cos(Math.PI / 2 - Math.PI / 3), y: 19.02 * Math.sin(Math.PI / 2 - Math.PI / 3) }, // -60 deg

        // --- ArcCorp (28.79 Gm on -X) ---
        "ArcCorp": { x: -28.79, y: 0 },
        "ARC-L1 (Baijini Point)": { x: -28.79 * 0.9, y: 0 },// 10% closer
        "ARC-L2": { x: -28.79 * 1.1, y: 0 },            // 10% further
        "ARC-L3": { x: 28.79, y: 0 },                  // Opposite
        "ARC-L4": { x: 28.79 * Math.cos(Math.PI + Math.PI / 3), y: 28.79 * Math.sin(Math.PI + Math.PI / 3) },    // +60 deg
        "ARC-L5": { x: 28.79 * Math.cos(Math.PI - Math.PI / 3), y: 28.79 * Math.sin(Math.PI - Math.PI / 3) },    // -60 deg

        // --- MicroTech (43.32 Gm on -Y) ---
        "MicroTech": { x: 0, y: -43.32 },
        "Port Tressler (MicroTech Orbit)": { x: -0.5, y: -43.32 }, // Small offset from planet
        "MIC-L1": { x: 0, y: -43.32 * 0.9 },           // 10% closer
        "MIC-L2": { x: 0, y: -43.32 * 1.1 },           // 10% further
        "MIC-L3": { x: 0, y: 43.32 },                  // Opposite
        "MIC-L4": { x: 43.32 * Math.cos(-Math.PI / 2 + Math.PI / 3), y: 43.32 * Math.sin(-Math.PI / 2 + Math.PI / 3) },// +60 deg
        "MIC-L5": { x: 43.32 * Math.cos(-Math.PI / 2 - Math.PI / 3), y: 43.32 * Math.sin(-Math.PI / 2 - Math.PI / 3) } // -60 deg
    };

    // Aaron Halo definition (Gm) - Repositioned proportionally between new ARC/MIC orbits
    // Old: 1.1-1.6 AU relative to ARC 1.0 / MIC 1.4
    // New: Set between ARC 28.79 Gm / MIC 43.32 Gm -> Let's try 30 Gm to 40 Gm
    const haloInnerRadius = 19.67; // Gm
    const haloOuterRadius = 21.29; // Gm

    // --- Coordinate Mapping (World Gm to Canvas Coords RELATIVE TO CENTER) ---
    function worldToMapX(x_gm) {
        return (x_gm / GM_PER_PIXEL);
    }
    function worldToMapY(y_gm) {
        return (-y_gm / GM_PER_PIXEL); // Y is inverted
    }

    // --- Drawing Helper Functions (Use mapX/mapY relative coordinates) ---
    function drawCircle(worldX, worldY, radiusPx, color, fill = false, lineWidth = 1) {
        const mapX = worldToMapX(worldX); const mapY = worldToMapY(worldY);
        ctx.beginPath(); ctx.arc(mapX, mapY, radiusPx, 0, 2 * Math.PI);
        ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
        if (fill) { ctx.fillStyle = color; ctx.fill(); } else { ctx.stroke(); }
    }
    function drawDashedCircle(worldX, worldY, radiusGm, color, dashPattern = [5, 5]) {
        const mapX = worldToMapX(worldX); const mapY = worldToMapY(worldY);
        const radiusPx = radiusGm / GM_PER_PIXEL;
        if (radiusPx < 1) return;
        ctx.beginPath(); ctx.setLineDash(dashPattern); ctx.arc(mapX, mapY, radiusPx, 0, 2 * Math.PI);
        ctx.strokeStyle = color; ctx.lineWidth = 0.5; ctx.stroke(); ctx.setLineDash([]);
    }
    function drawAnnulus(worldX, worldY, innerRadiusGm, outerRadiusGm, fillColor) {
        const mapX = worldToMapX(worldX); const mapY = worldToMapY(worldY);
        const innerRadiusPx = innerRadiusGm / GM_PER_PIXEL; const outerRadiusPx = outerRadiusGm / GM_PER_PIXEL;
        if (outerRadiusPx < 1) return;
        ctx.beginPath(); ctx.arc(mapX, mapY, outerRadiusPx, 0, 2 * Math.PI);
        ctx.arc(mapX, mapY, innerRadiusPx, 0, 2 * Math.PI, true);
        ctx.fillStyle = fillColor; ctx.fill();
    }
    function drawText(text, worldX, worldY, color = 'black', font = '10px sans-serif', offsetX = 5, offsetY = -5) {
        const mapX = worldToMapX(worldX); const mapY = worldToMapY(worldY);
        ctx.save(); ctx.translate(mapX + offsetX, mapY + offsetY); ctx.rotate(-currentRotationAngle);
        ctx.fillStyle = color; ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }
    function drawLine(worldX1, worldY1, worldX2, worldY2, color = 'red', lineWidth = 2) {
        const mapX1 = worldToMapX(worldX1); const mapY1 = worldToMapY(worldY1);
        const mapX2 = worldToMapX(worldX2); const mapY2 = worldToMapY(worldY2);
        ctx.beginPath(); ctx.moveTo(mapX1, mapY1); ctx.lineTo(mapX2, mapY2);
        ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.stroke();
    }

    // --- Main Map Drawing Function (Uses new Gm values) ---
    function drawSystemMap(highlightStartName = null, highlightEndName = null) {
        // Assumes context is already translated/rotated
        drawAnnulus(0, 0, haloInnerRadius, haloOuterRadius, 'rgba(150, 150, 150, 0.15)'); // Halo at 30-40 Gm

        // Draw orbits based on direct Gm distances
        const orbitRadiiGm = [12.72, 19.02, 28.79, 43.32]; // Direct Gm values
        orbitRadiiGm.forEach(gm => {
            drawDashedCircle(0, 0, gm, 'rgba(0, 0, 0, 0.2)');
        });

        drawCircle(0, 0, 5, 'orange', true); // Star at relative 0,0

        for (const name in locations) {
             if (name === "Stanton (Star)") continue;
             const loc = locations[name];
             let color = 'blue'; let radius = 2; let label = name; let fontWeight = 'normal';
             if (name === highlightStartName) { color = 'green'; radius = 4; label = `START: ${name}`; fontWeight = 'bold'; }
             else if (name === highlightEndName) { color = 'red'; radius = 4; label = `END: ${name}`; fontWeight = 'bold'; }
             drawCircle(loc.x, loc.y, radius, color, true);
             drawText(label, loc.x, loc.y, color, `${fontWeight} 10px sans-serif`);
        }
    }

    // --- Function to Draw the Travel Path (Assumes context is transformed) ---
    function drawTravelPath(startLoc, endLoc) {
         if (!startLoc || !endLoc) return;
         // Draw line using world Gm coords, helper converts to mapX/Y
         drawLine(startLoc.x, startLoc.y, endLoc.x, endLoc.y, 'purple', 1.5);
    }

    // --- Populate Dropdowns ---
    function populateDropdowns() {
        const locationNames = Object.keys(locations);
        locationNames.sort(); // Sort alphabetically

        locationNames.forEach(name => {
            const option1 = document.createElement('option');
            option1.value = name;
            option1.textContent = name;
            startSelect.appendChild(option1);

            const option2 = document.createElement('option');
            option2.value = name;
            option2.textContent = name;
            endSelect.appendChild(option2);
        });
        // Set default different values if possible
        if (locationNames.length > 1) {
           endSelect.selectedIndex = 1;
        }
    }

    // --- REDRAW ALL FUNCTION (Handles Rotation and Updates) ---
    function redrawAll() {
        const startName = startSelect.value;
        const endName = endSelect.value;
        const startPos = locations[startName];
        const endPos = locations[endName];

        // --- Drawing Operations ---
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        ctx.save();
        ctx.translate(CENTER_X, CENTER_Y);
        ctx.rotate(currentRotationAngle);
        drawSystemMap(startName, endName); // Draw map elements
        if (startName !== endName && startPos && endPos) {
            drawTravelPath(startPos, endPos); // Draw path
        }
        ctx.restore();
        // --- End Drawing Operations ---

        // --- Calculation and Text Update ---
        if (!startPos || !endPos) { /* Error handling */ return; }

        if (startName === endName) {
             distanceResult.textContent = "Distance: 0 Gm"; // Output is now directly Gm
             haloResult.textContent = "Aaron Halo Crossing: N/A";
             return;
         }

        // Calculate distance directly from the new Gm coordinates
        const dx = endPos.x - startPos.x;
        const dy = endPos.y - startPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy); // This is now the direct Gm distance

        // *** Display direct Gm distance *** (Use more decimals now?)
        distanceResult.textContent = `Distance: ${distance.toFixed(3)} Gm`;

        // --- Check Halo Crossing (Uses new Gm halo boundaries) ---
        const haloCrossings = findLineAnnulusIntersections(
            startPos.x, startPos.y, endPos.x, endPos.y,
            haloInnerRadius, haloOuterRadius // Check against 30-40 Gm halo
        );

        // --- Format Halo Results (Display direct Gm distances) ---
        if (haloCrossings.length === 0) {
            haloResult.textContent = "Aaron Halo Crossing: Does not cross"; // Simplified message
        } else {
            haloCrossings.sort((a, b) => a.t - b.t);
            const totalDist = distance; // Use direct Gm distance

            if (haloCrossings.length === 1) {
                const crossDist = totalDist * haloCrossings[0].t; // Gm
                if (haloCrossings[0].t < 1e-6 || haloCrossings[0].t > 1 - 1e-6) {
                     haloResult.textContent = `Aaron Halo Crossing: Touches edge near start/end`;
                } else {
                    haloResult.textContent = `Aaron Halo Crossing: Enters/Exits at ${crossDist.toFixed(3)} Gm along path`; // Show Gm
                }
            } else {
                 if (Math.abs(haloCrossings[0].t - haloCrossings[1].t) < 1e-6) { // Tangent case
                     const crossDist = totalDist * haloCrossings[0].t; // Gm
                     haloResult.textContent = `Aaron Halo Crossing: Touches edge at ${crossDist.toFixed(3)} Gm along path`; // Show Gm
                 } else { // Two distinct crossings
                    const entryDist = totalDist * haloCrossings[0].t; // Gm
                    const exitDist = totalDist * haloCrossings[1].t; // Gm
                    haloResult.textContent = `Aaron Halo Crossing: Enters at ${entryDist.toFixed(3)} Gm, Exits at ${exitDist.toFixed(3)} Gm along path`; // Show Gm
                 }
            }
        }
    }

    // --- Intersection Functions (Refined Versions) ---
    function findLineAnnulusIntersections(x1, y1, x2, y2, rInner, rOuter) {
        const rInnerSq = rInner * rInner;
        const rOuterSq = rOuter * rOuter;
        const innerTs = solveLineCircleIntersection(x1, y1, x2 - x1, y2 - y1, rInner);
        const outerTs = solveLineCircleIntersection(x1, y1, x2 - x1, y2 - y1, rOuter);
        let intersections = [];
        const tolerance = 1e-9;
        innerTs.forEach(t => { if (t >= -tolerance && t <= 1 + tolerance) { intersections.push({ t: Math.max(0, Math.min(1, t)), boundary: 'inner' }); } });
        outerTs.forEach(t => { if (t >= -tolerance && t <= 1 + tolerance) { intersections.push({ t: Math.max(0, Math.min(1, t)), boundary: 'outer' }); } });
        intersections = intersections.filter((item, index, self) => index === self.findIndex((other) => Math.abs(other.t - item.t) < tolerance));
        intersections.sort((a, b) => a.t - b.t);
        const startDistSq = x1 * x1 + y1 * y1;
        const startInHalo = startDistSq >= rInnerSq - tolerance && startDistSq <= rOuterSq + tolerance;
        let crossings = [];
        let currentlyInHalo = startInHalo;
        for (const intersection of intersections) {
            if (crossings.length > 0 && Math.abs(intersection.t - crossings[crossings.length - 1].t) < tolerance) { continue; }
            if (currentlyInHalo) { crossings.push(intersection); currentlyInHalo = false; }
            else { crossings.push(intersection); currentlyInHalo = true; }
            if (crossings.length >= 2) { break; }
        }
        return crossings;
    }

    function solveLineCircleIntersection(x1, y1, dx, dy, R) {
        const a = dx * dx + dy * dy;
        const b = 2 * (x1 * dx + y1 * dy);
        const c = x1 * x1 + y1 * y1 - R * R;
        const tolerance = 1e-9;
        if (Math.abs(a) < tolerance) { return []; }
        const discriminant = b * b - 4 * a * c;
        if (discriminant < -tolerance) { return []; }
        const sqrtDiscriminant = Math.sqrt(Math.max(0, discriminant));
        const t1 = (-b + sqrtDiscriminant) / (2 * a);
        const t2 = (-b - sqrtDiscriminant) / (2 * a);
         if (Math.abs(sqrtDiscriminant) < tolerance) { return [t1]; }
         else { return [t1, t2]; }
    }

    // -- Event Listeners ---
    calculateButton.addEventListener('click', redrawAll);
    startSelect.addEventListener('change', redrawAll);
    endSelect.addEventListener('change', redrawAll);

    // Rotation Slider Listener
    rotationSlider.addEventListener('input', (event) => {
        const degrees = event.target.value;
        rotationValueSpan.textContent = degrees;
        currentRotationAngle = degrees * Math.PI / 180; // Convert degrees to radians
        redrawAll(); // Redraw everything with the new rotation
    });

    // --- Initial Setup ---
    populateDropdowns();
    rotationSlider.value = 210;
    rotationValueSpan.textContent = rotationSlider.value; // Set initial degree display
    redrawAll(); // Perform initial draw, calculation, and text update

}); // End DOMContentLoaded
