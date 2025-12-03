'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Play, Pause, SkipBack, SkipForward, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

// Dynamically import Leaflet components with SSR disabled
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then((mod) => mod.CircleMarker),
  { ssr: false }
);

// Tile layer configurations
const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
};

// Bus SVG icon generator
function createBusIcon(color, busNumber) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="40" height="40">
      <rect x="4" y="10" width="40" height="24" rx="4" fill="${color}" stroke="#333" stroke-width="1.5"/>
      <rect x="8" y="14" width="8" height="8" rx="1" fill="#b3e5fc"/>
      <rect x="18" y="14" width="8" height="8" rx="1" fill="#b3e5fc"/>
      <rect x="28" y="14" width="8" height="8" rx="1" fill="#b3e5fc"/>
      <rect x="38" y="14" width="4" height="8" rx="1" fill="#81d4fa"/>
      <circle cx="12" cy="34" r="4" fill="#333"/>
      <circle cx="12" cy="34" r="2" fill="#666"/>
      <circle cx="36" cy="34" r="4" fill="#333"/>
      <circle cx="36" cy="34" r="2" fill="#666"/>
      <rect x="14" y="26" width="20" height="6" rx="1" fill="white" opacity="0.9"/>
      <text x="24" y="31" font-size="5" font-weight="bold" fill="#333" text-anchor="middle" font-family="Arial">${busNumber}</text>
      <circle cx="42" cy="28" r="2" fill="#ffeb3b"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// Playback speeds
const PLAYBACK_SPEEDS = [0.5, 1, 2, 5, 10];

export default function RoutePlaybackMap({ 
  positions = [],
  busNo = 'Bus',
  height = '500px',
  className = ''
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [busIcon, setBusIcon] = useState(null);
  const [mapLayer, setMapLayer] = useState('street');
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackRef = useRef(null);

  // Initialize Leaflet
  useEffect(() => {
    setIsMounted(true);
    
    import('leaflet').then((L) => {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const busNum = busNo.replace(/[^0-9]/g, '').slice(-2) || busNo.slice(0, 2);
      const iconUrl = createBusIcon('#3b82f6', busNum);
      const marker = new L.Icon({
        iconUrl: iconUrl,
        iconSize: [48, 48],
        iconAnchor: [24, 40],
        popupAnchor: [0, -40],
      });
      setBusIcon(marker);
    });
  }, [busNo]);

  // Reset playback when positions change
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [positions]);

  // Playback logic
  useEffect(() => {
    if (isPlaying && positions.length > 0) {
      const interval = 1000 / playbackSpeed;
      
      playbackRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= positions.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    }

    return () => {
      if (playbackRef.current) {
        clearInterval(playbackRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, positions.length]);

  const handlePlayPause = () => {
    if (currentIndex >= positions.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSkipBack = () => {
    setIsPlaying(false);
    setCurrentIndex(0);
  };

  const handleSkipForward = () => {
    setIsPlaying(false);
    setCurrentIndex(positions.length - 1);
  };

  const handleSliderChange = (value) => {
    setIsPlaying(false);
    setCurrentIndex(value[0]);
  };

  const cycleSpeed = () => {
    const currentIdx = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIdx = (currentIdx + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIdx]);
  };

  const toggleLayer = () => {
    setMapLayer(mapLayer === 'street' ? 'satellite' : 'street');
  };

  if (!isMounted) {
    return (
      <div style={{ height }} className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div style={{ height }} className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <p className="text-gray-500">No route data available</p>
      </div>
    );
  }

  // Current position
  const currentPosition = positions[currentIndex];
  
  // Path up to current position (traveled path)
  const traveledPath = positions.slice(0, currentIndex + 1).map(p => [p.lat, p.lng]);
  
  // Remaining path
  const remainingPath = positions.slice(currentIndex).map(p => [p.lat, p.lng]);

  // Calculate center
  const center = currentPosition ? [currentPosition.lat, currentPosition.lng] : [23.8103, 90.4125];

  const currentTileLayer = TILE_LAYERS[mapLayer];

  // Format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Map */}
      <div style={{ height }} className="relative">
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
        />
        
        {/* Layer toggle */}
        <button
          onClick={toggleLayer}
          className="absolute top-2 right-2 z-[1000] bg-white px-3 py-1.5 rounded-md shadow-md text-sm font-medium hover:bg-gray-100 transition-colors border"
          style={{ zIndex: 1000 }}
        >
          {mapLayer === 'street' ? '🛰️ Satellite' : '🗺️ Street'}
        </button>

        {/* Current info overlay */}
        <div 
          className="absolute top-2 left-2 z-[1000] bg-white/95 backdrop-blur px-3 py-2 rounded-md shadow-md text-sm"
          style={{ zIndex: 1000 }}
        >
          <p className="font-bold text-blue-600">🚌 Bus {busNo}</p>
          <p className="text-xs text-gray-600">📅 {formatDate(currentPosition.timestamp)}</p>
          <p className="text-xs text-gray-600">🕐 {formatTime(currentPosition.timestamp)}</p>
          {currentPosition.speedKmh !== undefined && (
            <p className="text-xs text-gray-600">🚀 {currentPosition.speedKmh} km/h</p>
          )}
        </div>

        <MapContainer
          center={center}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            key={mapLayer}
            attribution={currentTileLayer.attribution}
            url={currentTileLayer.url}
          />
          
          {/* Traveled path (blue) */}
          {traveledPath.length > 1 && (
            <Polyline 
              positions={traveledPath} 
              color="#3b82f6"
              weight={4}
              opacity={0.8}
            />
          )}

          {/* Remaining path (gray dashed) */}
          {remainingPath.length > 1 && (
            <Polyline 
              positions={remainingPath} 
              color="#9ca3af"
              weight={3}
              opacity={0.5}
              dashArray="10, 10"
            />
          )}

          {/* Start marker */}
          {positions.length > 0 && (
            <CircleMarker
              center={[positions[0].lat, positions[0].lng]}
              radius={8}
              pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-green-600">🚩 Start</p>
                  <p>{formatTime(positions[0].timestamp)}</p>
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* End marker */}
          {positions.length > 1 && (
            <CircleMarker
              center={[positions[positions.length - 1].lat, positions[positions.length - 1].lng]}
              radius={8}
              pathOptions={{ color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 }}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold text-red-600">🏁 End</p>
                  <p>{formatTime(positions[positions.length - 1].timestamp)}</p>
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* Current bus position */}
          {currentPosition && busIcon && (
            <Marker 
              position={[currentPosition.lat, currentPosition.lng]}
              icon={busIcon}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">🚌 Bus {busNo}</p>
                  <p>Time: {formatTime(currentPosition.timestamp)}</p>
                  {currentPosition.speedKmh !== undefined && (
                    <p>Speed: {currentPosition.speedKmh} km/h</p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Playback Controls */}
      <div className="bg-white border-t p-4 space-y-3">
        {/* Timeline slider */}
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 w-16">
            {formatTime(positions[0]?.timestamp)}
          </span>
          <Slider
            value={[currentIndex]}
            max={positions.length - 1}
            step={1}
            onValueChange={handleSliderChange}
            className="flex-1"
          />
          <span className="text-xs text-gray-500 w-16 text-right">
            {formatTime(positions[positions.length - 1]?.timestamp)}
          </span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" onClick={handleSkipBack}>
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="default" 
            size="icon" 
            onClick={handlePlayPause}
            className="h-12 w-12"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>
          
          <Button variant="outline" size="icon" onClick={handleSkipForward}>
            <SkipForward className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" onClick={cycleSpeed} className="ml-4">
            <FastForward className="h-4 w-4 mr-1" />
            {playbackSpeed}x
          </Button>
        </div>

        {/* Progress info */}
        <div className="text-center text-sm text-gray-600">
          Point {currentIndex + 1} of {positions.length} • {formatTime(currentPosition?.timestamp)}
        </div>
      </div>
    </div>
  );
}
