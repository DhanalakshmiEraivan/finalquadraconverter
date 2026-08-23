import { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Copy, ImageUp, Smartphone, Upload, X } from 'lucide-react';
import { PAYMENT_CONFIG, type PaidPlan } from '@/lib/payment-config';
import { supabase } from '@/lib/supabase';

interface Props { plan: PaidPlan; onSubmitted?: () => void; }

export default function UPIPaymentQR({ plan, onSubmitted }: Props) {
  const [utr, setUtr] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const selectedPlan = PAYMENT_CONFIG.plans[plan];

  const upiUrl = useMemo(() => {
    const params = new URLSearchParams({
      pa: PAYMENT_CONFIG.upiId,
      pn: PAYMENT_CONFIG.merchantName,
      am: selectedPlan.amount.toFixed(2),
      cu: PAYMENT_CONFIG.currency,
      tn: `QuadraConverter ${selectedPlan.name}`,
    });
    return `upi://pay?${params.toString()}`;
  }, [selectedPlan]);

  const chooseScreenshot = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return setError('Upload a PNG, JPG or WebP payment screenshot.');
    if (file.size > 8 * 1024 * 1024) return setError('Payment screenshot must be 8 MB or smaller.');
    setScreenshot(file);
    setPreview(URL.createObjectURL(file));
  };

  const copyUPI = async () => {
    try { await navigator.clipboard.writeText(PAYMENT_CONFIG.upiId); } catch { setError('Could not copy the UPI ID.'); }
  };

  const submitPayment = async () => {
    setError(null);
    const cleanUTR = utr.trim();
    if (cleanUTR.length < 6) return setError('Enter a valid UTR / transaction ID (minimum 6 characters).');
    if (!screenshot) return setError('Payment screenshot is mandatory. Upload the screenshot from your UPI app before submitting.');
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please login before making a payment.');

      const safeName = screenshot.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('payment-screenshots').upload(path, screenshot, { upsert: false, contentType: screenshot.type });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('payment_requests').insert({
        user_id: user.id,
        plan,
        amount: selectedPlan.amount,
        currency: 'INR',
        status: 'submitted',
        utr: cleanUTR,
        payment_screenshot_path: path,
        submitted_at: new Date().toISOString(),
      });
      if (insertError) {
        await supabase.storage.from('payment-screenshots').remove([path]);
        throw insertError;
      }
      setSubmitted(true);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit payment.');
    } finally { setLoading(false); }
  };

  if (submitted) return (
    <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-soft">
      <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
      <h3 className="mt-4 text-2xl font-bold text-emerald-900">Payment submitted for verification</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-emerald-700">Your UTR and payment screenshot have been securely attached to the verification request. Your plan activates only after the admin verifies the payment.</p>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-float">
      <div className="bg-ink-950 p-6 text-white sm:p-8">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><Smartphone className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">Secure UPI checkout</p><h2 className="mt-1 text-2xl font-extrabold">Pay ₹{selectedPlan.amount}</h2></div></div>
        <p className="mt-3 text-sm text-white/60">{selectedPlan.name} plan · 30 days · manual verification</p>
      </div>
      <div className="p-6 sm:p-8">
        <div className="flex justify-center"><div className="rounded-3xl border border-ink-200 bg-white p-4 shadow-card"><QRCodeSVG value={upiUrl} size={240} level="H" includeMargin /></div></div>
        <p className="mt-4 text-center text-sm font-semibold text-ink-700">Scan with Google Pay, PhonePe, Paytm or another UPI app</p>
        <div className="mt-5 rounded-2xl bg-ink-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-ink-400">UPI ID</p><div className="mt-2 flex items-center justify-between gap-3"><code className="break-all text-sm font-bold text-ink-900">{PAYMENT_CONFIG.upiId}</code><button type="button" onClick={copyUPI} className="rounded-xl p-2 hover:bg-white" title="Copy UPI ID"><Copy className="h-4 w-4" /></button></div></div>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          <div><label className="text-sm font-bold text-ink-800">UTR / transaction ID <span className="text-err-500">*</span></label><input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Enter UTR after payment" className="input mt-2" /></div>
          <div><label className="text-sm font-bold text-ink-800">Payment screenshot <span className="text-err-500">*</span></label><label className="mt-2 flex min-h-[96px] cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 p-4 hover:border-brand-300 hover:bg-brand-50"><ImageUp className="h-5 w-5 shrink-0 text-brand-600" /><span className="min-w-0 text-sm"><b className="block truncate">{screenshot?.name || 'Upload screenshot'}</b><span className="mt-1 block text-xs text-ink-400">PNG/JPG/WebP · max 8 MB</span></span><input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => chooseScreenshot(e.target.files?.[0])} /></label></div>
        </div>

        {preview && <div className="relative mt-5 overflow-hidden rounded-2xl border border-ink-200 bg-ink-50 p-2"><button type="button" onClick={() => { setScreenshot(null); setPreview(''); }} className="absolute right-3 top-3 z-10 rounded-full bg-ink-950/80 p-2 text-white" aria-label="Remove screenshot"><X className="h-4 w-4" /></button><img src={preview} alt="Payment screenshot preview" className="max-h-72 w-full rounded-xl object-contain" /></div>}
        {error && <p className="mt-4 rounded-2xl bg-err-50 p-3 text-sm font-medium text-err-700">{error}</p>}
        <button type="button" disabled={loading} onClick={submitPayment} className="btn-primary mt-5 w-full py-3.5">{loading ? 'Uploading proof securely…' : <><Upload className="h-4 w-4" /> Submit payment proof</>}</button>
        <p className="mt-4 text-center text-xs leading-5 text-ink-400">Both the UTR and screenshot are required. QuadraConverter never activates a subscription from the UTR alone.</p>
      </div>
    </div>
  );
}
