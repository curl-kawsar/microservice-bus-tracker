/**
 * Test script to simulate GPS tracker sending position data
 * 
 * Usage:
 *   bun run scripts/test-gps-ingest.js
 * 
 * Prerequisites:
 *   1. Start all services with: docker-compose up -d
 *   2. Create a bus via admin panel or API with a tracker IP
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:4000';
const TRACKER_IP = process.env.TRACKER_IP || '192.168.1.100';

// Starting position (BAIUST campus area example)
let currentLat = 22.3476;
let currentLng = 91.8123;

async function sendPosition() {
  // Simulate movement
  currentLat += (Math.random() - 0.5) * 0.001;
  currentLng += (Math.random() - 0.5) * 0.001;
  
  const speed = Math.floor(Math.random() * 60) + 10; // 10-70 km/h
  const fuel = Math.floor(Math.random() * 30) + 50; // 50-80%

  const payload = {
    trackerIp: TRACKER_IP,
    lat: currentLat,
    lng: currentLng,
    speedKmh: speed,
    fuelLevelPercent: fuel,
  };

  try {
    const response = await fetch(`${GATEWAY_URL}/api/tracking/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`[${new Date().toISOString()}] Position sent:`, {
        lat: currentLat.toFixed(6),
        lng: currentLng.toFixed(6),
        speed,
        fuel,
      });
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Failed to send position:', error.message);
  }
}

console.log('Starting GPS simulation...');
console.log(`Tracker IP: ${TRACKER_IP}`);
console.log(`Gateway URL: ${GATEWAY_URL}`);
console.log('Sending positions every 5 seconds. Press Ctrl+C to stop.\n');

// Send initial position
sendPosition();

// Send position every 5 seconds
setInterval(sendPosition, 5000);
