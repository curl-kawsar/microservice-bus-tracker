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
const Circle = dynamic(
  () => import('react-leaflet').then((mod) => mod.Circle),
  { ssr: false }
);

// Tile layer configurations
const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
  },
};

// Bus marker colors
const BUS_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', 
  '#3b82f6', '#8b5cf6', '#ec4899', '#6366f1', '#0ea5e9'
];

// Bus SVG icon generator
function createBusIcon(color, busNumber) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="40" height="40">
      <!-- Bus body -->
      <rect x="4" y="10" width="40" height="24" rx="4" fill="${color}" stroke="#333" stroke-width="1.5"/>
      <!-- Windows -->
      <rect x="8" y="14" width="8" height="8" rx="1" fill="#b3e5fc"/>
      <rect x="18" y="14" width="8" height="8" rx="1" fill="#b3e5fc"/>
      <rect x="28" y="14" width="8" height="8" rx="1" fill="#b3e5fc"/>
      <!-- Front window -->
      <rect x="38" y="14" width="4" height="8" rx="1" fill="#81d4fa"/>
      <!-- Wheels -->
      <circle cx="12" cy="34" r="4" fill="#333"/>
      <circle cx="12" cy="34" r="2" fill="#666"/>
      <circle cx="36" cy="34" r="4" fill="#333"/>
      <circle cx="36" cy="34" r="2" fill="#666"/>
      <!-- Bus number label -->
      <rect x="14" y="26" width="20" height="6" rx="1" fill="white" opacity="0.9"/>
      <text x="24" y="31" font-size="5" font-weight="bold" fill="#333" text-anchor="middle" font-family="Arial">${busNumber}</text>
      <!-- Headlights -->
      <circle cx="42" cy="28" r="2" fill="#ffeb3b"/>
    </svg>
  `;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export default function MultiBusMap({ 
  buses = [],
  userLocation,
  height = '500px',
  className = ''
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [busIcons, setBusIcons] = useState({});
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

      // Create user/student location icon with human SVG
      const studentSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 56" width="40" height="48">
          <!-- Shadow/base -->
          <ellipse cx="24" cy="52" rx="10" ry="3" fill="rgba(0,0,0,0.2)"/>
          <!-- Location pin shape -->
          <path d="M24 0C14 0 6 8 6 18c0 12 18 34 18 34s18-22 18-34C42 8 34 0 24 0z" fill="#4285F4" stroke="#fff" stroke-width="2"/>
          <!-- Human icon inside -->
          <circle cx="24" cy="14" r="5" fill="white"/>
          <path d="M24 20c-5 0-9 3-9 7v3h18v-3c0-4-4-7-9-7z" fill="white"/>
        </svg>
      `;
      const userMarker = new L.DivIcon({
        className: 'user-location-marker',
        html: `<div style="
          width: 40px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">${studentSvg}</div>`,
        iconSize: [40, 48],
        iconAnchor: [20, 48],
        popupAnchor: [0, -48],
      });
      setUserIcon(userMarker);
    });
  }, []);

  // Create bus icons dynamically
  useEffect(() => {
    if (!isMounted) return;

    import('leaflet').then((L) => {
      const icons = {};
      buses.forEach((bus, index) => {
        const color = BUS_COLORS[index % BUS_COLORS.length];
        const busNum = bus.busNo.replace(/[^0-9]/g, '').slice(-2) || bus.busNo.slice(0, 2);
        const iconUrl = createBusIcon(color, busNum);
        
        icons[bus.busId] = new L.Icon({
          iconUrl: iconUrl,
          iconSize: [48, 48],
          iconAnchor: [24, 40],
          popupAnchor: [0, -40],
        });
      });
      setBusIcons(icons);
    });
  }, [isMounted, buses]);

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

  // Calculate center based on buses with positions
  const busesWithPosition = buses.filter(b => b.position);
  let center = [23.4683, 91.1026]; // Default: BAIUST area
  let zoom = 14;

  if (userLocation) {
    center = [userLocation.lat, userLocation.lng];
  } else if (busesWithPosition.length > 0) {
    const avgLat = busesWithPosition.reduce((sum, b) => sum + b.position.lat, 0) / busesWithPosition.length;
    const avgLng = busesWithPosition.reduce((sum, b) => sum + b.position.lng, 0) / busesWithPosition.length;
    center = [avgLat, avgLng];
  }

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
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          key={mapLayer}
          attribution={currentTileLayer.attribution}
          url={currentTileLayer.url}
        />
        
        {/* User location marker */}
        {userLocation && userIcon && (
          <>
            <Marker 
              position={[userLocation.lat, userLocation.lng]}
              icon={userIcon}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">🧑‍🎓 You are here</p>
                  <p className="text-xs text-gray-500">
                    Accuracy: ~{Math.round(userLocation.accuracy || 0)}m
                  </p>
                </div>
              </Popup>
            </Marker>
            {/* Accuracy circle */}
            {userLocation.accuracy && userLocation.accuracy < 500 && (
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

        {/* Bus markers */}
        {buses.map((bus, index) => {
          if (!bus.position) return null;
          const icon = busIcons[bus.busId];
          if (!icon) return null;

          return (
            <Marker 
              key={bus.busId}
              position={[bus.position.lat, bus.position.lng]}
              icon={icon}
            >
              <Popup>
                <div className="text-sm min-w-[150px]">
                  <p className="font-bold text-lg">🚌 Bus {bus.busNo}</p>
                  <hr className="my-1" />
                  {bus.distance !== null && (
                    <p className="text-blue-600 font-medium">
                      📏 {bus.distance < 1 
                        ? `${Math.round(bus.distance * 1000)} m away`
                        : `${bus.distance.toFixed(1)} km away`}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    🕐 {new Date(bus.position.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
