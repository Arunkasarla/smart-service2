import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import TrackingMap from '../../components/TrackingMap';
import { ArrowLeft } from 'lucide-react';

const TrackingPage = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  const [booking, setBooking] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!location.state?.booking);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (booking) {
      setLoading(false);
      return;
    }

    if (!bookingId) return;

    fetch('/api/bookings/my-bookings', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Unable to load bookings');
        }
        return res.json();
      })
      .then((data) => {
        const found = Array.isArray(data) ? data.find((item) => item.id.toString() === bookingId.toString()) : null;
        if (!found) {
          throw new Error('Booking not found or not authorized');
        }
        setBooking(found);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [booking, bookingId, token]);

  if (loading) {
    return <div className="container py-20 text-center text-muted">Loading tracking details...</div>;
  }

  if (error) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg font-semibold text-danger">{error}</p>
        <button onClick={() => navigate('/my-bookings')} className="btn btn-primary mt-6">
          Back to bookings
        </button>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container py-20 text-center">
        <p className="text-lg font-semibold text-muted">Tracking information not available.</p>
        <button onClick={() => navigate('/my-bookings')} className="btn btn-primary mt-6">
          Back to bookings
        </button>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <button onClick={() => navigate(-1)} className="btn btn-outline mb-6 inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
        <h1 className="text-3xl font-bold text-main mb-2">Track Your Service Provider</h1>
        <p className="text-sm text-muted max-w-2xl">
          Your provider is on the move. Live updates are shown on the map below as soon as they are sent from the provider app.
        </p>
      </div>

      <TrackingMap booking={booking} />
    </div>
  );
};

export default TrackingPage;
