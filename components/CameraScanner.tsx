import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, Check, Loader2, RefreshCw, QrCode } from 'lucide-react';
import { extractBillDetails } from '../services/geminiService';
import { parseQRPayload } from '../services/qrService';
import { Language } from '../types';
import jsQR from 'jsqr';

interface CameraScannerProps {
  onScanComplete: (data: any, imageBase64: string) => void;
  onClose: () => void;
  lang: Language;
}

const CameraScanner: React.FC<CameraScannerProps> = ({ onScanComplete, onClose, lang }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrFound, setQrFound] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Required to play on iOS
        videoRef.current.setAttribute("playsinline", "true"); 
        videoRef.current.play();
        requestAnimationFrame(tick);
      }
      setError(null);
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError(lang === Language.BANGLA ? "ক্যামেরা চালু করা যাচ্ছে না।" : "Could not access camera.");
    }
  }, [lang]);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // QR Scanning Loop
  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        // Attempt to parse our specific QR format
        const billData = parseQRPayload(code.data);
        if (billData) {
          setQrFound(true);
          // Capture the frame as proof
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          stopCamera(); // Stop scanning
          onScanComplete(billData, dataUrl);
          return; // Stop loop
        }
      }
    }
    if (!capturedImage && !qrFound) {
      requestAnimationFrame(tick);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(dataUrl);
      }
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setQrFound(false);
    startCamera();
  };

  const processImage = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);
    
    try {
      // Remove header for base64
      const base64Data = capturedImage.split(',')[1];
      const extractedData = await extractBillDetails(base64Data);
      onScanComplete(extractedData, capturedImage);
    } catch (err) {
      setError(lang === Language.BANGLA ? "তথ্য বিশ্লেষণ ব্যর্থ হয়েছে।" : "Failed to analyze bill.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10">
        <button onClick={onClose} className="text-white bg-black/50 p-2 rounded-full">
          <X size={24} />
        </button>
        <span className="text-white font-medium flex items-center gap-2">
           <QrCode size={18} className="text-blue-400" />
          {lang === Language.BANGLA ? "বিল স্ক্যানার" : "Bill Scanner"}
        </span>
        <div className="w-10"></div>
      </div>

      {/* Main View */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {error ? (
          <div className="text-white text-center p-6">
            <p className="mb-4">{error}</p>
            <button onClick={startCamera} className="bg-blue-600 px-4 py-2 rounded-full">
               {lang === Language.BANGLA ? "আবার চেষ্টা করুন" : "Retry"}
            </button>
          </div>
        ) : !capturedImage ? (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {/* Scan Frame Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-64 h-64 border-2 border-blue-400/50 rounded-2xl relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                    <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
                </div>
                <p className="absolute bottom-20 text-white/80 text-sm bg-black/40 px-3 py-1 rounded-full">
                    {lang === Language.BANGLA ? "QR কোড বা বিল ফ্রেমে রাখুন" : "Point at QR Code or Bill"}
                </p>
            </div>
          </>
        ) : (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
        )}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Loading Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20">
            <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4" />
            <p className="text-white font-medium">
              {lang === Language.BANGLA ? "বুদ্ধিমত্তা দিয়ে বিল পড়া হচ্ছে..." : "AI is reading the bill..."}
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="h-32 bg-black flex items-center justify-around p-4 pb-8">
        {!capturedImage ? (
          <button
            onClick={capturePhoto}
            className="w-16 h-16 rounded-full border-4 border-white bg-white/20 flex items-center justify-center active:bg-white/50 transition-all"
            title="Take Photo for AI"
          >
            <div className="w-12 h-12 bg-white rounded-full"></div>
          </button>
        ) : (
          <>
            <button onClick={retakePhoto} className="text-white flex flex-col items-center gap-1" disabled={isProcessing}>
              <RefreshCw size={24} />
              <span className="text-xs">{lang === Language.BANGLA ? "আবার তুলুন" : "Retake"}</span>
            </button>
            
            <button 
              onClick={processImage}
              disabled={isProcessing}
              className="bg-blue-600 text-white w-16 h-16 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Check size={32} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraScanner;