import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// DraggableLine Component
function DraggableLine({ points, setPoints }) {
  const [dragging, setDragging] = useState(null);
  const lastTouch = useRef(null); // To store the last touch position for movement calculation

  const handleStart = (e, index) => {
    e.stopPropagation();
    if (e.type === 'touchstart') {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    setDragging(index);
  };

  const handleStartLine = (e) => {
    if (e.type === 'touchstart') {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    setDragging("line");
  };

  const handleMove = (e) => {
    if (dragging === null) return;
    e.preventDefault(); // Prevent scrolling on touch devices
    const svg = e.currentTarget.getBoundingClientRect();
    const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

    const x = clientX - svg.left;
    const y = clientY - svg.top;

    if (dragging === "line") {
      let dx, dy;
      if (e.type === 'touchmove' && lastTouch.current) {
        dx = clientX - lastTouch.current.x;
        dy = clientY - lastTouch.current.y;
        lastTouch.current = { x: clientX, y: clientY };
      } else if (e.type === 'mousemove') {
        dx = e.movementX;
        dy = e.movementY;
      } else {
        return; // Should not happen
      }
      setPoints((prev) => prev.map(p => ({ x: p.x + dx, y: p.y + dy })));
    } else {
      setPoints((prev) =>
        prev.map((p, i) => (i === dragging ? { x, y } : p))
      );
    }
  };

  const handleEnd = () => {
    setDragging(null);
    lastTouch.current = null;
  };

  return (
    <svg
      width="100%"
      height="100%" // Changed to 100% to fill parent
      style={{ background: "transparent", cursor: "grab", position: "absolute", top: 0, left: 0, zIndex: 10 }} // Added positioning and z-index
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => handleStart(e, null)} // General touch start for SVG
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      <line
        x1={points[0].x}
        y1={points[0].y}
        x2={points[1].x}
        y2={points[1].y}
        stroke="red"
        strokeWidth="3"
        onMouseDown={handleStartLine}
        onTouchStart={handleStartLine}
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={10}
          fill="red"
          onMouseDown={(e) => handleStart(e, i)}
          onTouchStart={(e) => handleStart(e, i)}
        />
      ))}
    </svg>
  );
}


function MaskViewer() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null); // Add this ref
  const location = useLocation();
  const { mask, width, height } = location.state || {};

  // Lifted points state to MaskViewer
  const [points, setPoints] = useState([
    { x: 100, y: 100 }, // point A
    { x: 300, y: 200 }  // point B
  ]);
  const [threadCount, setThreadCount] = useState(0); // Add state for threadCount

  useEffect(() => {
    if (canvasRef.current && mask) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      const scale = Math.min(window.innerWidth / width, window.innerHeight / height) * 0.8;
      canvas.width = width * scale;
      canvas.height = height * scale;

      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const offscreenContext = offscreenCanvas.getContext('2d');

      const imageData = offscreenContext.createImageData(width, height);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const index = (y * width + x) * 4;
          const value = mask[y][x] ? 255 : 0;
          imageData.data[index] = value;
          imageData.data[index + 1] = value;
          imageData.data[index + 2] = value;
          imageData.data[index + 3] = 255;
        }
      }

      offscreenContext.putImageData(imageData, 0, 0);

      context.drawImage(offscreenCanvas, 0, 0, canvas.width, canvas.height);
    }
  }, [mask, width, height]);

  const handleGeneratePixelArray = () => {
    if (!mask || !points || !containerRef.current) {
      console.warn("Mask data, line points, or container ref not available.");
      return;
    }

    const maskWidth = width;
    const maskHeight = height;
    const containerHeight = 400; // Fixed height of the container div
    const containerWidth = containerRef.current.offsetWidth; // Actual rendered width of the container

    const pixelArray = [];

    // Bresenham's line algorithm to get points on the line
    const p1 = points[0];
    const p2 = points[1];

    let x0 = p1.x;
    let y0 = p1.y;
    let x1 = p2.x;
    let y1 = p2.y;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = (x0 < x1) ? 1 : -1;
    const sy = (y0 < y1) ? 1 : -1;
    let err = dx - dy;

    while (true) {
      // Scale SVG coordinates (x0, y0) to mask coordinates (maskX, maskY)
      const maskX = Math.round(x0 * maskWidth / containerWidth);
      const maskY = Math.round(y0 * maskHeight / containerHeight);

      // Ensure coordinates are within mask bounds
      if (maskX >= 0 && maskX < maskWidth && maskY >= 0 && maskY < maskHeight) {
        pixelArray.push(mask[maskY][maskX] ? 1 : 0);
      }

      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }

    console.log("Generated Pixel Array:", pixelArray);

    // Calculate thread count
    let count = 0;
    let prev = 0; // pixelArray contains 0s and 1s, so 0 for white, 1 for black
    for (const elem of pixelArray) {
      if (elem === 1 && prev !== 1) { // If current is black and previous was white
        count += 1;
      }
      prev = elem;
    }
    setThreadCount(count); // Update the state with the new count
    console.log("Thread count:", count);
  };

  return (
    <div style={{ backgroundColor: '#282c34', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {mask ? (
        <> {/* Use a fragment to group elements */}
          <div ref={containerRef} style={{ position: 'relative', width: '80%', maxWidth: '600px', height: '400px' }}> {/* Container for overlay */}
            <canvas ref={canvasRef} style={{ border: '1px solid white', position: 'absolute', top: 0, left: 0, zIndex: 5, width: '100%', height: '100%' }} />
            <DraggableLine points={points} setPoints={setPoints} /> {/* Pass points and setPoints as props */}
          </div>
          <button
            onClick={handleGeneratePixelArray}
            style={{ marginTop: '20px', padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
          >
            Generate Pixel Array
          </button>
          {threadCount > 0 && ( // Display thread count only if calculated
            <p style={{ color: 'white', marginTop: '10px' }}>Thread count: {threadCount}</p>
          )}
        </>
      ) : (
        <p style={{ color: 'white' }}>No mask data available.</p>
      )}
    </div>
  );
}

export default MaskViewer;