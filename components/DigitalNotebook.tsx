import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Pen, Undo, Save } from 'lucide-react';
import { Language } from '../types';

interface DigitalNotebookProps {
  onSave: (imageData: string) => void;
  lang: Language;
}

const DigitalNotebook: React.FC<DigitalNotebookProps> = ({ onSave, lang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(2);
  const [mode, setMode] = useState<'pen' | 'eraser'>('pen');

  // Initialize canvas with paper lines
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set resolution for high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Draw Background
    ctx.fillStyle = '#fcfcf7';
    ctx.fillRect(0, 0, rect.width, rect.height);
    
    // Draw Lines
    ctx.strokeStyle = '#e5e7eb'; // Light gray lines
    ctx.lineWidth = 1;
    const lineHeight = 32;
    
    // Red margin line
    ctx.beginPath();
    ctx.strokeStyle = '#fca5a5';
    ctx.moveTo(40, 0);
    ctx.lineTo(40, rect.height);
    ctx.stroke();

    // Horizontal lines
    ctx.strokeStyle = '#e5e7eb';
    for (let i = lineHeight; i < rect.height; i += lineHeight) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(rect.width, i);
      ctx.stroke();
    }
  };

  useEffect(() => {
    initCanvas();
    window.addEventListener('resize', initCanvas);
    return () => window.removeEventListener('resize', initCanvas);
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && pos) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = mode === 'eraser' ? '#fcfcf7' : color;
      ctx.lineWidth = mode === 'eraser' ? 20 : lineWidth;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling on touch
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && pos) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const ctx = canvasRef.current?.getContext('2d');
    ctx?.closePath();
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL());
    }
  };

  const clearCanvas = () => {
     initCanvas();
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-lg overflow-hidden shadow-inner border border-gray-300">
      {/* Toolbar */}
      <div className="bg-white p-2 flex items-center justify-between border-b">
        <div className="flex gap-2">
          <button 
            onClick={() => { setMode('pen'); setColor('#000000'); }}
            className={`p-2 rounded ${mode === 'pen' && color === '#000000' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
          >
            <Pen size={18} fill="currentColor" />
          </button>
           <button 
            onClick={() => { setMode('pen'); setColor('#1d4ed8'); }} // Blue pen
            className={`p-2 rounded ${mode === 'pen' && color === '#1d4ed8' ? 'bg-blue-100 text-blue-800' : 'text-blue-600'}`}
          >
            <Pen size={18} fill="currentColor" />
          </button>
          <button 
            onClick={() => setMode('eraser')}
            className={`p-2 rounded ${mode === 'eraser' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
          >
            <Eraser size={18} />
          </button>
        </div>
        <div className="flex gap-2">
           <button onClick={clearCanvas} className="p-2 text-gray-500 hover:text-red-500">
             <Undo size={18} />
           </button>
           <button onClick={handleSave} className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">
             <Save size={16} />
             {lang === Language.BANGLA ? "সংরক্ষণ" : "Save"}
           </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 relative touch-none cursor-crosshair overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
    </div>
  );
};

export default DigitalNotebook;