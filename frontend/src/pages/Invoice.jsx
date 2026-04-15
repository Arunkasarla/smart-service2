import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Download } from 'lucide-react';

const Invoice = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [invoice, setInvoice] = useState(null);
  const [warranty, setWarranty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!bookingId) return;

    const fetchData = async () => {
      try {
        const invoiceRes = await fetch(`/api/invoice/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!invoiceRes.ok) {
          throw new Error('Unable to load invoice');
        }
        const invoiceData = await invoiceRes.json();

        const warrantyRes = await fetch(`/api/warranty/${bookingId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const warrantyData = warrantyRes.ok ? await warrantyRes.json() : null;

        setInvoice(invoiceData);
        setWarranty(warrantyData);
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.message || 'Unable to fetch invoice details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [bookingId, token]);

  if (loading) {
    return <div className="container py-20 text-center text-muted">Loading invoice...</div>;
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

  return (
    <div className="container py-10">
      <button onClick={() => navigate(-1)} className="btn btn-outline mb-6 inline-flex items-center gap-2">
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Invoice</p>
              <h1 className="text-3xl font-bold text-main">{invoice.invoice_number}</h1>
            </div>
            <a
              href={`/api/invoice/${bookingId}/download`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-white transition hover:bg-slate-700"
            >
              <Download size={16} /> Download PDF
            </a>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm uppercase text-slate-500 tracking-[0.2em] mb-3">Billed To</h2>
              <p className="font-bold text-main">{invoice.user_name}</p>
              <p className="text-sm text-muted">{invoice.user_email}</p>
              <p className="text-sm text-muted">{invoice.user_phone}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="text-sm uppercase text-slate-500 tracking-[0.2em] mb-3">Provider</h2>
              <p className="font-bold text-main">{invoice.provider_name}</p>
              <p className="text-sm text-muted">{invoice.booking_address}</p>
            </div>
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-500">Service</p>
                <p className="font-semibold text-main">{invoice.service_title || 'Service'}</p>
              </div>
              <p className="text-xl font-bold text-main">₹{invoice.amount?.toFixed(2)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Date</p>
                <p className="font-medium text-main">{new Date(invoice.booking_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Payment Type</p>
                <p className="font-medium text-main">{invoice.payment_method}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-main mb-4">Warranty</h2>
            {warranty ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Expiry</p>
                  <p className="font-semibold text-main">{new Date(warranty.expiry_date).toLocaleDateString()}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Days</p>
                  <p className="font-semibold text-main">{warranty.warranty_days} days</p>
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${warranty.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  Warranty Status: {warranty.status.toUpperCase()}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Warranty details are not available for this booking.</p>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-main mb-4">Invoice Details</h2>
            <div className="space-y-3 text-sm text-slate-700">
              <p><span className="font-semibold">Invoice ID:</span> {invoice.invoice_number}</p>
              <p><span className="font-semibold">Amount:</span> ₹{invoice.amount?.toFixed(2)}</p>
              <p><span className="font-semibold">Payment Type:</span> {invoice.payment_method}</p>
              <p><span className="font-semibold">Invoice Date:</span> {new Date(invoice.invoice_date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoice;
