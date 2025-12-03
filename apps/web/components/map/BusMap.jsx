'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

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
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

// Tile layer configurations
const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    name: 'Street',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    name: 'Satellite',
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

export default function BusMap({ 
  currentPosition, 
  userLocation,
  path = [], 
  busNo = 'Bus',
  showPath = true,
  height = '400px',
  className = ''
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [busIcon, setBusIcon] = useState(null);
  const [userIcon, setUserIcon] = useState(null);
  const [mapLayer, setMapLayer] = useState('street');

  useEffect(() => {
    setIsMounted(true);
    
    // Import Leaflet and create icons on client side
    import('leaflet').then((L) => {
      // Fix default marker icon issue
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Create custom bus icon with realistic bus SVG
      const busNum = busNo.replace(/[^0-9]/g, '').slice(-2) || busNo.slice(0, 2);
      const iconUrl = createBusIcon('#3b82f6', busNum);
      const busMarker = new L.Icon({
        iconUrl: iconUrl,
        iconSize: [48, 48],
        iconAnchor: [24, 40],
        popupAnchor: [0, -40],
      });
      setBusIcon(busMarker);

      // Create user location icon (using divIcon for custom styling)
      const userMarker = new L.DivIcon({
        className: 'user-location-marker',
        html: `<div style="
          width: 20px;
          height: 20px;
          background-color: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      setUserIcon(userMarker);
    });
  }, []);

  if (!isMounted) {
    return (
      <div 
        style={{ height }} 
        className={`bg-gray-100 flex items-center justify-center ${className}`}
      >
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  // Default center (Bangladesh)
  const defaultCenter = [23.8103, 90.4125];
  const center = currentPosition 
    ? [currentPosition.lat, currentPosition.lng] 
    : defaultCenter;

  const pathCoordinates = path.map(p => [p.lat, p.lng]);

  const toggleLayer = () => {
    setMapLayer(mapLayer === 'street' ? 'satellite' : 'street');
  };

  const currentTileLayer = TILE_LAYERS[mapLayer];

  return (
    <div style={{ height }} className={`relative ${className}`}>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      
      {/* Layer toggle button */}
      <button
        onClick={toggleLayer}
        className="absolute top-2 right-2 z-[1000] bg-white px-3 py-1.5 rounded-md shadow-md text-sm font-medium hover:bg-gray-100 transition-colors border"
        style={{ zIndex: 1000 }}
      >
        {mapLayer === 'street' ? '🛰️ Satellite' : '🗺️ Street'}
      </button>

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
        
        {/* Show path polyline */}
        {showPath && pathCoordinates.length > 1 && (
          <Polyline 
            positions={pathCoordinates} 
            color="blue" 
            weight={3}
            opacity={0.7}
          />
        )}
        
        {/* User location marker */}
        {userLocation && userIcon && (
          <>
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={userIcon}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">Your Location</p>
                  <p className="text-xs text-gray-500">
                    Accuracy: ~{Math.round(userLocation.accuracy || 0)}m
                  </p>
                </div>
              </Popup>
            </Marker>
            {/* Accuracy circle */}
            {userLocation.accuracy && (
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={userLocation.accuracy}
                pathOptions={{
                  color: '#4285F4',
                  fillColor: '#4285F4',
                  fillOpacity: 0.1,
                  weight: 1,
                }}
              />
            )}
          </>
        )}

        {/* Bus position marker */}
        {currentPosition && busIcon && (
          <Marker 
            position={[currentPosition.lat, currentPosition.lng]}
            icon={busIcon}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-bold">{busNo}</p>
                <p>Speed: {currentPosition.speedKmh || 0} km/h</p>
                {currentPosition.fuelLevelPercent && (
                  <p>Fuel: {currentPosition.fuelLevelPercent}%</p>
                )}
                <p className="text-xs text-gray-500">
                  {new Date(currentPosition.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
