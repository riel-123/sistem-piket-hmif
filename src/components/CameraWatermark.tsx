"use client";

import React, { useRef, useState } from "react";
import { Camera, RefreshCw, CheckCircle } from "lucide-react";

interface Props {
  userName: string;
  onCapture: (file: File, previewUrl: string) => void;
}

export default function CameraWatermark({ userName, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const startCamera = async () => {
    setPreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setStreaming(true);
      }
    } catch {
      alert("Gagal membuka kamera. Pastikan izin kamera aktif & akses via HTTPS/localhost.");
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const barHeight = Math.max(60, canvas.height * 0.1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

    const now = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "medium",
    });
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${Math.max(16, Math.floor(barHeight * 0.32))}px sans-serif`;
    ctx.fillText(`PIKET SEKRE HMIF • ${userName}`, 20, canvas.height - barHeight + barHeight * 0.42);
    ctx.font = `${Math.max(14, Math.floor(barHeight * 0.26))}px monospace`;
    ctx.fillText(`Waktu: ${now} WIB`, 20, canvas.height - barHeight + barHeight * 0.8);

    const stream = video.srcObject as MediaStream;
    stream?.getTracks().forEach((track) => track.stop());
    setStreaming(false);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `piket-${Date.now()}.jpg`, { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);
      setPreview(url);
      onCapture(file, url);
    }, "image/jpeg", 0.85);
  };

  return (
    <div className="space-y-3">
      {!streaming && !preview && (
        <button
          type="button"
          onClick={startCamera}
          className="w-full py-10 border-2 border-dashed border-indigo-300 rounded-2xl flex flex-col items-center justify-center text-indigo-600 hover:bg-indigo-50 transition"
        >
          <Camera className="w-10 h-10 mb-2" />
          <span className="font-semibold">Buka Kamera Bukti Sekre</span>
          <span className="text-xs text-slate-500 mt-1">Otomatis tertera watermark jam & nama</span>
        </button>
      )}

      {streaming && (
        <div className="relative rounded-2xl overflow-hidden bg-black">
          <video ref={videoRef} autoPlay playsInline className="w-full max-h-80 object-cover" />
          <button
            type="button"
            onClick={takePhoto}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white text-slate-900 font-bold px-6 py-2.5 rounded-full shadow-lg flex items-center gap-2"
          >
            <Camera className="w-5 h-5 text-indigo-600" /> Ambil Foto
          </button>
        </div>
      )}

      {preview && (
        <div className="space-y-2">
          <img src={preview} alt="Preview Bukti" className="w-full rounded-2xl border" />
          <div className="flex justify-between items-center text-sm">
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle className="w-4 h-4" /> Foto siap dikirim
            </span>
            <button
              type="button"
              onClick={startCamera}
              className="text-indigo-600 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Foto Ulang
            </button>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}