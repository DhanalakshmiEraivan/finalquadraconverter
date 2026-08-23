import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Download, FileSignature, Loader2, PenLine, ShieldCheck, Type, Upload, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addSignatureToPdf, createIntegrityProof, createSignatureDataUrl, fileToDataUrl } from '@/lib/signatures';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function serverSign(bytes: Uint8Array, filename: string, signerName: string) {
  const base = (import.meta.env.VITE_SIGNING_API_URL || import.meta.env.VITE_CONVERTER_API_URL || '').replace(/\/$/, '');
  if (!base) return bytes;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 120000);
  try {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'application/pdf' }), filename);
    form.append('signer_name', signerName);
    const r = await fetch(`${base}/sign-pdf`, { method: 'POST', body: form, signal: controller.signal });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      throw new Error(detail || `Digital signing service returned HTTP ${r.status}.`);
    }
    return new Uint8Array(await r.arrayBuffer());
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('The signing service timed out. Please try again.');
    if (e instanceof TypeError) throw new Error('Could not reach the digital signing service. Check its public HTTPS URL and CORS configuration.');
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

export function PublicSigningPage() {
  const [token, setToken] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [session, setSession] = useState<any>(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'typed' | 'drawn' | 'uploaded'>('typed');
  const [sig, setSig] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [consent, setConsent] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const [routePart, queryPart = ''] = hash.split('?');
    const parts = routePart.split('/');
    const rawToken = decodeURIComponent(parts[1] || '');
    const params = new URLSearchParams(queryPart);
    const rawDoc = params.get('doc') || '';
    setToken(rawToken); setDocUrl(rawDoc);
    if (!rawToken) { setError('This signing link is invalid.'); setBusy(false); return; }

    let cancelled = false;
    const loadSession = async (silent = false) => {
      const { data, error: e } = await supabase.rpc('get_public_signing_session', { p_token: rawToken });
      if (cancelled) return;
      if (e) setError(e.message);
      else if (!data?.valid) setError(data?.message || 'This signing link is invalid or expired.');
      else {
        setSession(data);
        if (data.can_sign) setError('');
        else if (data.waiting) setError(data.message || 'Waiting for the previous signer.');
        if (!silent) setBusy(false);
      }
      if (!silent) setBusy(false);
    };
    loadSession();
    const poll = window.setInterval(() => {
      if (!done) loadSession(true);
    }, 10000);
    return () => { cancelled = true; window.clearInterval(poll); };
  }, [done]);

  const point = (e: React.PointerEvent) => { const c = canvas.current; if (!c) return { x: 0, y: 0 }; const r = c.getBoundingClientRect(); return { x: (e.clientX-r.left)*c.width/r.width, y: (e.clientY-r.top)*c.height/r.height }; };
  const start = (e: React.PointerEvent) => { const c=canvas.current; if(!c)return; drawing.current=true; c.setPointerCapture(e.pointerId); const p=point(e); const ctx=c.getContext('2d')!; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineWidth=5; ctx.lineCap='round'; ctx.strokeStyle='#040720'; };
  const move = (e: React.PointerEvent) => { if(!drawing.current)return; const c=canvas.current;if(!c)return;const p=point(e);const ctx=c.getContext('2d')!;ctx.lineTo(p.x,p.y);ctx.stroke(); };
  const end = () => { drawing.current=false; if(canvas.current)setSig(canvas.current.toDataURL('image/png')); };

  const submit = async () => {
    setBusy(true); setError(''); setUploadError('');
    try {
      if (!session || !docUrl) throw new Error('The signing document could not be loaded. Ask the sender to create a fresh signing link.');
      if (!session.can_sign) throw new Error(session.message || 'You cannot sign this request yet.');
      if (!name.trim()) throw new Error('Enter your full legal name.');
      if (!consent) throw new Error('Confirm the signing consent before continuing.');
      let signature = sig;
      if (mode === 'typed') signature = await createSignatureDataUrl('typed', name.trim(), 'cursive');
      if (mode === 'drawn' && !signature) throw new Error('Draw your signature first.');
      if (mode === 'uploaded' && !signature) throw new Error('Upload a signature image first.');

      const sourceResponse = await fetch(docUrl); if (!sourceResponse.ok) throw new Error('The signing document link has expired.');
      const source = await sourceResponse.arrayBuffer();
      const visual = await addSignatureToPdf(source, signature, 1, 68, 74, 24);
      const signed = await serverSign(visual, session.document_name || 'document.pdf', name.trim());
      const proof = await createIntegrityProof(signed, { signerName: name.trim(), signerEmail: session.signer_email, requestId: session.request_id, signerId: session.signer_id, mode });
      const { error: completeError } = await supabase.rpc('complete_public_signing_session', { p_token: token, p_proof: proof });
      if (completeError) throw completeError;
      downloadBlob(new Blob([signed], { type: 'application/pdf' }), `${(session.document_name || 'document').replace(/\.[^.]+$/, '')}-signed.pdf`);
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Signing failed.'); } finally { setBusy(false); }
  };

  if (busy && !session) return <div className="min-h-screen grid place-items-center bg-ink-50"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>;
  if (error && !session) return <div className="min-h-screen grid place-items-center bg-ink-50 p-5"><div className="card max-w-lg p-8 text-center"><XCircle className="mx-auto h-12 w-12 text-err-500" /><h1 className="mt-4 text-2xl font-extrabold">Signing link unavailable</h1><p className="mt-2 text-sm leading-6 text-ink-500">{error}</p></div></div>;
  if (done) return <div className="min-h-screen grid place-items-center bg-ink-50 p-5"><div className="card max-w-xl p-8 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /><h1 className="mt-4 text-3xl font-extrabold">Document signed</h1><p className="mt-2 text-sm leading-6 text-ink-500">Your cryptographic proof has been recorded. The signed PDF was downloaded to this device.</p><div className="mt-5 rounded-2xl bg-emerald-50 p-4 text-left text-sm text-emerald-800"><b>Audit event recorded.</b><br />Signer: {session?.signer_email}<br />Request: {session?.request_id}</div></div></div>;

  if (session?.already_signed) return <div className="min-h-screen grid place-items-center bg-ink-50 p-5"><div className="card max-w-xl p-8 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" /><h1 className="mt-4 text-3xl font-extrabold">Already signed</h1><p className="mt-3 text-sm leading-6 text-ink-500">This signer has already completed this signing step. The link cannot be used again.</p><div className="mt-5 rounded-2xl bg-ink-50 p-4 text-left text-sm text-ink-600"><b>Signer:</b> {session?.signer_email}<br /><b>Request:</b> {session?.request_id}</div></div></div>;

  if (session?.waiting && !session?.can_sign) return <div className="min-h-screen grid place-items-center bg-ink-50 p-5"><div className="card max-w-xl p-8 text-center"><ShieldCheck className="mx-auto h-14 w-14 text-brand-600" /><h1 className="mt-4 text-3xl font-extrabold">Waiting for the previous signer</h1><p className="mt-3 text-sm leading-6 text-ink-500">{session.message || 'The previous signer must complete this document first.'}</p><p className="mt-5 text-xs text-ink-400">This page checks the signing status automatically every 10 seconds.</p></div></div>;

  return <div className="min-h-screen bg-ink-50 text-ink-900"><div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink-950 text-white"><FileSignature className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">QuadraConverter</p><h1 className="font-display text-xl font-extrabold">Secure signing request</h1></div></div><span className="chip"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Token protected</span></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <div className="card overflow-hidden"><div className="border-b border-ink-100 p-5"><p className="text-xs font-bold uppercase tracking-widest text-ink-400">Document</p><h2 className="mt-1 font-display text-lg font-extrabold">{session?.document_name}</h2><p className="mt-1 text-xs text-ink-500">Signing as {session?.signer_email}</p></div>{docUrl ? <iframe title="Document preview" src={docUrl} className="h-[70vh] min-h-[520px] w-full bg-white" /> : <div className="grid min-h-[520px] place-items-center p-8 text-sm text-ink-500">Document preview unavailable.</div>}</div>
      <div className="card h-fit p-6"><div className="flex gap-2 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800"><ShieldCheck className="h-5 w-5 shrink-0" /><span>This action is recorded in the request audit trail. A later modification will change the document hash.</span></div><label className="mt-6 block text-sm font-bold">Your full name<input className="input mt-2" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Enter your legal name" /></label><div className="mt-5 grid grid-cols-3 gap-2"><button onClick={()=>setMode('typed')} className={`rounded-xl p-3 text-xs font-bold ring-1 ${mode==='typed'?'bg-brand-50 text-brand-700 ring-brand-200':'ring-ink-200'}`}><Type className="mx-auto mb-1 h-4 w-4"/>Type</button><button onClick={()=>setMode('drawn')} className={`rounded-xl p-3 text-xs font-bold ring-1 ${mode==='drawn'?'bg-brand-50 text-brand-700 ring-brand-200':'ring-ink-200'}`}><PenLine className="mx-auto mb-1 h-4 w-4"/>Draw</button><label className={`cursor-pointer rounded-xl p-3 text-center text-xs font-bold ring-1 ${mode==='uploaded'?'bg-brand-50 text-brand-700 ring-brand-200':'ring-ink-200'}`}><Upload className="mx-auto mb-1 h-4 w-4"/>Upload<input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={async(e)=>{const f=e.target.files?.[0];if(!f)return;const allowed=['image/png','image/jpeg','image/webp'];if(!allowed.includes(f.type)){setUploadError('Choose a PNG, JPG or WebP image.');return;}if(f.size>5*1024*1024){setUploadError('Signature images must be 5 MB or smaller.');return;}try{setUploadError('');setMode('uploaded');setSig(await fileToDataUrl(f));}catch{setUploadError('Could not read that signature image.');}}}/></label></div>{mode==='drawn'&&<div className="mt-4"><canvas ref={canvas} width={1000} height={260} className="signature-canvas" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/></div>}{mode==='uploaded'&&sig&&<img src={sig} alt="Uploaded signature" className="mt-4 h-32 w-full object-contain rounded-2xl bg-ink-50"/>}{uploadError&&<div className="mt-3 rounded-2xl bg-err-50 p-3 text-sm text-err-700">{uploadError}</div>}<label className="mt-5 flex items-start gap-3 rounded-2xl border border-ink-200 bg-ink-50 p-4 text-xs leading-5 text-ink-600"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={consent} onChange={(e)=>setConsent(e.target.checked)} /> <span>I confirm that I am the intended signer, that the name above is accurate, and that I consent to applying this electronic signature and recording the signing event.</span></label>{error&&<div className="mt-4 rounded-2xl bg-err-50 p-3 text-sm text-err-700">{error}</div>}<button onClick={submit} disabled={busy || !session?.can_sign} className="btn-primary mt-5 w-full py-3.5">{busy?<><Loader2 className="h-4 w-4 animate-spin"/> Signing…</>:<><FileSignature className="h-4 w-4"/> Sign & download</>}</button><p className="mt-3 text-center text-xs leading-5 text-ink-400">By signing, you agree that the signature and timestamped audit event represent your signing action.</p></div>
    </div></div></div>;
}
