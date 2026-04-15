import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { useAuth } from '../contexts/AuthContext';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
});

function Recenter({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map]);

  return null;
}

const TrackingMap = ({ booking }) => {
  const { socket } = useAuth();
  const [location, setLocation] = useState({ lat: 28.7041, lng: 77.1025 });
  const [status, setStatus] = useState('Waiting for provider updates...');
  const [updatedAt, setUpdatedAt] = useState(null);

  const providerFilter = useMemo(() => ({ provider_id: booking.provider_id, booking_id: booking.id }), [booking]);

  useEffect(() => {
    if (!socket) return;

    const handleLocation = (payload) => {
      if (payload.provider_id !== providerFilter.provider_id) return;
      if (providerFilter.booking_id && payload.booking_id && payload.booking_id !== providerFilter.booking_id) return;

      setLocation({ lat: payload.lat, lng: payload.lng });
      setStatus(payload.status || 'On the way');
      setUpdatedAt(payload.updatedAt || new Date().toISOString());
    };

    socket.on('provider_location', handleLocation);
    return () => {
      socket.off('provider_location', handleLocation);
    };
  }, [socket, providerFilter]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
      <div className="px-5 py-4 bg-slate-900 text-white flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">Live service tracker</p>
            <h2 className="text-xl font-bold">{booking.service_title}</h2>
          </div>
          <span className="rounded-full bg-slate-800/90 px-3 py-1 text-xs uppercase tracking-wider text-slate-200">{status}</span>
        </div>
        <p className="text-sm text-slate-300">Provider: {booking.provider_name}</p>
        <p className="text-xs text-slate-400">Last update: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : 'waiting...'}</p>
      </div>

      <div className="h-[420px]">
        <MapContainer center={location} zoom={13} scrollWheelZoom={false} className="h-full w-full">
          <Recenter position={location} />
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={location}>
            <Popup>
              {booking.provider_name} is currently here.<br />Status: {status}
            </Popup>
          </Marker>
        </MapContainer>
      </div>
    </div>
  );
};

export default TrackingMap;
