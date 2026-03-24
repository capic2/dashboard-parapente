import React, { useState } from 'react';

export interface VideoExportConfig {
  quality: '720p' | '1080p' | '4K';
  fps: 30 | 60;
  speed: 1 | 2 | 4 | 8;
}

interface ExportVideoModalProps {
  isOpen: boolean;
  flightDuration: number;
  onExport: (config: VideoExportConfig) => void;
  onCancel: () => void;
}

export const ExportVideoModal: React.FC<ExportVideoModalProps> = ({
  isOpen,
  flightDuration,
  onExport,
  onCancel,
}) => {
  const [quality, setQuality] = useState<'720p' | '1080p' | '4K'>('1080p');
  const [fps, setFps] = useState<30 | 60>(30);
  const [speed, setSpeed] = useState<1 | 2 | 4 | 8>(1);

  if (!isOpen) return null;

  const estimatedDuration = flightDuration / speed;
  const estimatedSize = calculateEstimatedSize(quality, fps, estimatedDuration);

  const handleExport = () => {
    onExport({ quality, fps, speed });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <h2 className="text-2xl font-bold mb-4">🎥 Export Vidéo</h2>
        
        {/* Quality Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Qualité</label>
          <div className="grid grid-cols-3 gap-2">
            {(['720p', '1080p', '4K'] as const).map((q) => (
              <button
                key={q}
                onClick={() => setQuality(q)}
                className={`px-3 py-2 rounded border ${
                  quality === q
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* FPS Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Images/seconde</label>
          <div className="grid grid-cols-2 gap-2">
            {([30, 60] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFps(f)}
                className={`px-3 py-2 rounded border ${
                  fps === f
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f} FPS
              </button>
            ))}
          </div>
        </div>

        {/* Speed Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Vitesse de replay
            <span className="text-xs text-gray-500 ml-2">(1x = temps réel pour sync caméra)</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 4, 8] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-3 py-2 rounded border ${
                  speed === s
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>

        {/* Estimates */}
        <div className="bg-gray-100 rounded p-3 mb-4">
          <div className="text-sm text-gray-700">
            <div className="flex justify-between mb-1">
              <span>Durée vidéo:</span>
              <span className="font-medium">{formatTime(estimatedDuration)}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span>Taille estimée:</span>
              <span className="font-medium">{estimatedSize}</span>
            </div>
            <div className="flex justify-between">
              <span>Format:</span>
              <span className="font-medium">WebM (VP9)</span>
            </div>
          </div>
        </div>

        {/* Warning for long videos */}
        {estimatedDuration > 600 && (
          <div className="bg-yellow-100 border border-yellow-400 rounded p-3 mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ Vidéo longue détectée ({formatTime(estimatedDuration)}). 
              L&apos;export peut prendre plusieurs minutes et générer un fichier volumineux.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Annuler
          </button>
          <button
            onClick={handleExport}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            🎥 Exporter
          </button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-3 text-center">
          La vidéo sera téléchargée au format WebM. 
          <a 
            href="https://cloudconvert.com/webm-to-mp4" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline ml-1"
          >
            Convertir en MP4
          </a>
        </p>
      </div>
    </div>
  );
};

// Helper functions
const formatTime = (seconds: number): string => {
  if (!seconds || isNaN(seconds)) return '0min 00s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}min ${secs.toString().padStart(2, '0')}s`;
};

const calculateEstimatedSize = (
  quality: '720p' | '1080p' | '4K',
  fps: 30 | 60,
  durationSeconds: number
): string => {
  // Bitrate en bits/sec
  const bitrates = {
    '720p': 2500000,
    '1080p': 5000000,
    '4K': 15000000,
  };
  
  const bitrate = bitrates[quality];
  const fpsMultiplier = fps === 60 ? 1.5 : 1;
  const sizeBytes = (bitrate * fpsMultiplier * durationSeconds) / 8;
  
  // Convert to MB
  const sizeMB = sizeBytes / (1024 * 1024);
  
  if (sizeMB > 1000) {
    return `~${(sizeMB / 1024).toFixed(1)} GB`;
  }
  return `~${sizeMB.toFixed(0)} MB`;
};
