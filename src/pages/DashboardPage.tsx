import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getUsageStatus, type UsageStatus } from '@/lib/usage';
import { useAuth } from '@/lib/auth';
import { jsPDF } from 'jspdf';
import {
  HardDrive, History, Zap,
  FileText, Image as ImageIcon, FileCode2, QrCode,
  Calculator, Type, KeyRound, Palette, Loader2, Trash2, CheckCircle2,
  XCircle, Sparkles, Activity, BarChart3, Download,  RefreshCw, Bell, ReceiptText, Crown, X,
} from 'lucide-react';

interface ApprovedPayment {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  utr: string | null;
  payment_note: string | null;
  created_at: string;
  verified_at: string | null;
}

interface ConversionRecord {
  id: string;
  tool_id: string;
  tool_name: string;
  category: string;
  input_name: string | null;
  output_name: string | null;
  output_format: string;
  status: string;
  file_size: number | null;
  output_path: string | null;
  created_at: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DashboardPage({ navigate }: { navigate: (path: string) => void }) {
  const { user } = useAuth();
  const [conversions, setConversions] = useState<ConversionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [serverStats, setServerStats] = useState<{ total: number; completed: number; failed: number; total_size: number; categories: Record<string, number> } | null>(null);
  const [approvedPayment, setApprovedPayment] = useState<ApprovedPayment | null>(null);
  const [paymentNotice, setPaymentNotice] = useState(false);
  const [receiptGenerating, setReceiptGenerating] = useState(false);
  const approvedSeenRef = useRef<string | null>(null);

  const loadConversions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('conversions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!error && data) setConversions(data as ConversionRecord[]);
    const { data: paymentData } = await supabase
      .from('payment_requests')
      .select('id,plan,amount,currency,status,utr,payment_note,created_at,verified_at')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .order('verified_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentData) {
      const payment = paymentData as ApprovedPayment;
      setApprovedPayment(payment);
      const seenKey = `quadra-payment-seen-${payment.id}`;
      const isRecent = payment.verified_at
        ? Date.now() - new Date(payment.verified_at).getTime() < 48 * 60 * 60 * 1000
        : false;
      if (approvedSeenRef.current !== payment.id && !localStorage.getItem(seenKey) && isRecent) {
        setPaymentNotice(true);
        approvedSeenRef.current = payment.id;
      }
    }

    const { data: statsData } = await supabase.rpc('get_conversion_stats');
    if (statsData) setServerStats(statsData as typeof serverStats);
    try { setUsage(await getUsageStatus()); } catch (error) { console.error('Usage status failed:', error); }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadConversions();
    if (!user) return;
    const channel = supabase
      .channel(`dashboard-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversions', filter: `user_id=eq.${user.id}` }, () => { loadConversions(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `user_id=eq.${user.id}` }, () => { loadConversions(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadConversions, user]);

  const downloadHistoryFile = async (path: string | null, filename: string | null) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from('conversion-files').createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) return;
    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = filename || 'converted-file';
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
  };

  const deleteConversion = async (id: string, outputPath?: string | null) => {
    if (outputPath) await supabase.storage.from('conversion-files').remove([outputPath]);
    await supabase.from('conversions').delete().eq('id', id);
    setConversions((prev) => prev.filter((c) => c.id !== id));
  };

  const clearHistory = async () => {
    if (!user) return;
    const paths = conversions.map((c) => c.output_path).filter(Boolean) as string[];
    if (paths.length) await supabase.storage.from('conversion-files').remove(paths);
    await supabase.from('conversions').delete().eq('user_id', user.id);
    setConversions([]);
  };

  const localStats = {
    total: conversions.length,
    completed: conversions.filter((c) => c.status === 'completed').length,
    failed: conversions.filter((c) => c.status === 'failed').length,
    totalSize: conversions.reduce((sum, c) => sum + (c.file_size || 0), 0),
    byCategory: conversions.reduce<Record<string, number>>((acc, c) => {
      acc[c.category] = (acc[c.category] || 0) + 1;
      return acc;
    }, {}),
  };
  const stats = {
    total: serverStats?.total ?? localStats.total,
    completed: serverStats?.completed ?? localStats.completed,
    failed: serverStats?.failed ?? localStats.failed,
    totalSize: Number(serverStats?.total_size ?? localStats.totalSize),
    byCategory: serverStats?.categories ?? localStats.byCategory,
  };


  const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    image: ImageIcon,
    pdf: FileText,
    text: Type,
    dev: FileCode2,
    qr: QrCode,
    color: Palette,
    calc: Calculator,
    security: KeyRound,
  };

  const filteredConversions = filter === 'all' ? conversions : conversions.filter((c) => c.category === filter);

  const storageLimitBytes = 500 * 1024 * 1024;
  const storagePercent = Math.min((stats.totalSize / storageLimitBytes) * 100, 100);


  const downloadReceipt = async (payment: ApprovedPayment) => {
    setReceiptGenerating(true);
    try {
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const navy = '#071A3A';
      const blue = '#1F5AF0';
      const muted = '#68758A';
      const amount = Number(payment.amount || 0).toFixed(2);
      const date = payment.verified_at
        ? new Date(payment.verified_at).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })
        : new Date(payment.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' });
      const receiptNo = `QCR-${payment.id.slice(0, 8).toUpperCase()}`;

      pdf.setFillColor(navy);
      pdf.rect(0, 0, 210, 44, 'F');
      pdf.setTextColor('#FFFFFF');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(23);
      pdf.text('QuadraConverter', 18, 19);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Professional digital conversion platform', 18, 27);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('PAYMENT RECEIPT', 192, 18, { align: 'right' });
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.text(receiptNo, 192, 25, { align: 'right' });

      pdf.setTextColor(navy);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(15);
      pdf.text('Payment successful', 18, 62);
      pdf.setTextColor(muted);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('This receipt confirms that your subscription payment was verified by the administrator.', 18, 69);

      pdf.setDrawColor('#DDE4EF');
      pdf.roundedRect(18, 82, 174, 54, 4, 4, 'S');
      const rows = [
        ['Customer', user?.email || 'Registered user'],
        ['Plan', payment.plan.replace(/^\w/, c => c.toUpperCase())],
        ['Payment method', 'UPI'],
        ['UTR / Transaction ID', payment.utr || '—'],
        ['Verified on', date],
      ];
      let y = 94;
      rows.forEach(([label, value]) => {
        pdf.setTextColor(muted);
        pdf.setFontSize(8);
        pdf.text(label.toUpperCase(), 25, y);
        pdf.setTextColor(navy);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.text(String(value).slice(0, 88), 78, y);
        pdf.setFont('helvetica', 'normal');
        y += 8;
      });

      pdf.setFillColor('#EEF4FF');
      pdf.roundedRect(18, 147, 174, 30, 4, 4, 'F');
      pdf.setTextColor(muted);
      pdf.setFontSize(8);
      pdf.text('AMOUNT PAID', 25, 158);
      pdf.setTextColor(blue);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(21);
      pdf.text(`${payment.currency || 'INR'} ${amount}`, 25, 169);
      pdf.setTextColor(muted);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Subscription status: ACTIVE', 192, 164, { align: 'right' });

      pdf.setTextColor(navy);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.text('Included with your plan', 18, 198);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      ['Access to your selected premium plan', 'Conversion history and dashboard access', 'Secure UPI payment verification', 'Receipt available for future download'].forEach((item, i) => {
        pdf.setTextColor(blue);
        pdf.text('✓', 20, 208 + i * 8);
        pdf.setTextColor(muted);
        pdf.text(item, 27, 208 + i * 8);
      });

      pdf.setDrawColor('#DDE4EF');
      pdf.line(18, 246, 192, 246);
      pdf.setTextColor(muted);
      pdf.setFontSize(8);
      pdf.text('Thank you for choosing QuadraConverter.', 18, 257);
      pdf.text('Generated electronically • No signature required', 18, 264);
      pdf.text(receiptNo, 192, 264, { align: 'right' });
      pdf.save(`${receiptNo}-payment-receipt.pdf`);
    } finally {
      setReceiptGenerating(false);
    }
  };

  const dismissPaymentNotice = () => {
    if (approvedPayment) localStorage.setItem(`quadra-payment-seen-${approvedPayment.id}`, '1');
    setPaymentNotice(false);
  };

  return (
    <div className="container-page py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-extrabold text-ink-900">Dashboard</h1>
          <p className="text-ink-500 mt-1">Welcome back, {user?.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadConversions} className="btn-secondary" title="Refresh dashboard">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button onClick={() => navigate('/tools')} className="btn-primary">
          <Sparkles className="h-4 w-4" /> Browse Tools
          </button>
        </div>
      </div>


      <section className="relative mb-8 overflow-hidden rounded-[2rem] bg-[#040720] p-6 text-white shadow-float sm:p-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-200">Command center</span>
              <span className="rounded-full border border-emerald-300/15 bg-emerald-300/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.16em] text-emerald-200">Secure workspace</span>
            </div>
            <h2 className="mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your files. Your workflows. One intelligent workspace.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60">
              Jump straight into your most-used tools, monitor activity, manage credits and keep signing workflows moving without hunting through menus.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={() => navigate('/tool/pdf-to-word')} className="btn bg-white text-[#040720] hover:bg-blue-50"><FileText className="h-4 w-4" /> Convert a document</button>
              <button onClick={() => navigate('/signatures')} className="btn bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"><KeyRound className="h-4 w-4" /> Sign a document</button>
              <button onClick={() => navigate('/tools/qr')} className="btn bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"><QrCode className="h-4 w-4" /> Create a QR</button>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-2">
            <img
              src="https://images.unsplash.com/photo-1558655146-d09347e92766?auto=format&fit=crop&w=900&q=80"
              alt="Creative digital workspace"
              className="h-56 w-full rounded-2xl object-cover opacity-90"
              loading="lazy"
            />
            <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-[#040720]/85 p-4 backdrop-blur">
              <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-blue-200">Workflow insight</p>
              <p className="mt-1 text-sm font-bold">Keep repetitive document work in one place.</p>
            </div>
          </div>
        </div>
      </section>

      {paymentNotice && approvedPayment && (
        <div className="mb-6 overflow-hidden rounded-3xl bg-ink-950 text-white shadow-float animate-fade-up">
          <div className="flex items-start gap-4 p-5 sm:p-6">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent-500/20 text-accent-300">
              <Bell className="h-6 w-6 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-extrabold">Payment approved!</p>
                <span className="rounded-full bg-accent-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-300">Subscription active</span>
              </div>
              <p className="mt-1 text-sm text-white/65">Your {approvedPayment.plan} plan is now active. Your professional receipt is ready to download.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => downloadReceipt(approvedPayment)} disabled={receiptGenerating} className="btn bg-white text-ink-900 hover:bg-brand-50">
                  <ReceiptText className="h-4 w-4" /> {receiptGenerating ? 'Preparing receipt…' : 'Download receipt'}
                </button>
                <button onClick={dismissPaymentNotice} className="btn bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15">Dismiss</button>
              </div>
            </div>
            <button onClick={dismissPaymentNotice} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <div className="mb-8 rounded-3xl border border-ink-200 bg-white p-5 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-bold uppercase tracking-wider text-ink-400">Current plan</p><div className="mt-1 flex items-center gap-3"><h2 className="font-display text-2xl font-extrabold capitalize text-ink-900">{usage?.plan ?? 'free'}</h2><span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{usage?.unlimited ? 'Unlimited' : `${usage?.free_remaining ?? 5} free today`}</span></div></div>
          <button onClick={() => navigate('/pricing')} className="btn-secondary">Upgrade with UPI <Zap className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Activity} label="Total Conversions" value={String(stats.total)} color="from-brand-500 to-brand-600" />
        <StatCard icon={CheckCircle2} label="Completed" value={String(stats.completed)} color="from-accent-500 to-accent-600" />
        <StatCard icon={XCircle} label="Failed" value={String(stats.failed)} color="from-err-500 to-err-600" />
        <StatCard icon={HardDrive} label="Storage Used" value={formatBytes(stats.totalSize)} color="from-warn-500 to-warn-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Conversion History */}
        <div className="bg-white rounded-3xl border border-ink-200 shadow-card overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-ink-100">
            <h2 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
              <History className="w-5 h-5 text-brand-600" /> Conversion History
            </h2>
            {conversions.length > 0 && (
              <button onClick={clearHistory} className="text-sm text-err-500 hover:text-err-600 font-medium flex items-center gap-1">
                <Trash2 className="w-4 h-4" /> Clear All
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 p-4 border-b border-ink-100">
            <FilterChip label="All" count={stats.total} active={filter === 'all'} onClick={() => setFilter('all')} />
            {Object.entries(stats.byCategory).map(([cat, count]) => (
              <FilterChip key={cat} label={cat} count={count} active={filter === cat} onClick={() => setFilter(cat)} />
            ))}
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
              <p className="text-sm text-ink-500 mt-3">Loading your conversions…</p>
            </div>
          ) : filteredConversions.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-ink-300 mx-auto" />
              <p className="text-ink-500 mt-3 font-medium">No conversions yet</p>
              <p className="text-sm text-ink-400 mt-1">Start using tools to see your history here</p>
              <button onClick={() => navigate('/tools')} className="btn-primary mt-4">
                <Sparkles className="h-4 w-4" /> Explore Tools
              </button>
            </div>
          ) : (
            <div className="divide-y divide-ink-50 max-h-[600px] overflow-auto">
              {filteredConversions.map((conv) => {
                const CatIcon = categoryIcons[conv.category] || FileText;
                return (
                  <div key={conv.id} className="flex items-center gap-4 p-4 hover:bg-ink-50 transition group">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 grid place-items-center shrink-0">
                      <CatIcon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-ink-900 truncate">{conv.tool_name}</p>
                        {conv.status === 'completed' ? (
                          <CheckCircle2 className="w-4 h-4 text-accent-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-err-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-ink-500 truncate">
                        {conv.input_name || '—'} → {conv.output_name || '—'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-ink-400">{timeAgo(conv.created_at)}</p>
                      <p className="text-xs text-ink-500">{formatBytes(conv.file_size)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {conv.output_path && (
                        <button
                          onClick={() => downloadHistoryFile(conv.output_path, conv.output_name)}
                          className="opacity-0 group-hover:opacity-100 text-brand-600 hover:text-brand-700 transition"
                          title="Download converted file"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteConversion(conv.id, conv.output_path)}
                        className="opacity-0 group-hover:opacity-100 text-ink-400 hover:text-err-500 transition"
                        title="Delete history"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Storage */}
          <div className="bg-white rounded-2xl border border-ink-200 p-5">
            <h3 className="font-display font-bold text-ink-900 mb-3 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-brand-600" /> Storage
            </h3>
            <div className="relative h-3 bg-ink-100 rounded-full overflow-hidden mb-2">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-accent-500 rounded-full transition-all duration-500"
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-ink-500">
              <span>{formatBytes(stats.totalSize)}</span>
              <span>500 MB limit</span>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-2xl border border-ink-200 p-5">
            <h3 className="font-display font-bold text-ink-900 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-brand-600" /> By Category
            </h3>
            {Object.keys(stats.byCategory).length === 0 ? (
              <p className="text-sm text-ink-400">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
                  const CatIcon = categoryIcons[cat] || FileText;
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2 text-ink-600 capitalize">
                          <CatIcon className="w-3.5 h-3.5" /> {cat}
                        </span>
                        <span className="font-semibold text-ink-900">{count}</span>
                      </div>
                      <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment receipt */}
          {approvedPayment && (
            <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-white to-brand-50 p-5 shadow-soft">
              <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-brand-200/40 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-ink-900 flex items-center gap-2"><ReceiptText className="w-4 h-4 text-brand-600" /> Latest receipt</h3>
                  <Crown className="h-4 w-4 text-brand-500" />
                </div>
                <p className="mt-2 text-xs text-ink-500">Verified {approvedPayment.verified_at ? timeAgo(approvedPayment.verified_at) : 'recently'}</p>
                <div className="mt-4 rounded-xl bg-white/80 p-3 ring-1 ring-ink-100">
                  <div className="flex items-end justify-between gap-3">
                    <div><p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Plan</p><p className="mt-0.5 font-display font-extrabold capitalize text-ink-900">{approvedPayment.plan}</p></div>
                    <p className="font-display text-lg font-extrabold text-brand-700">{approvedPayment.currency || 'INR'} {Number(approvedPayment.amount).toFixed(2)}</p>
                  </div>
                  <p className="mt-2 text-[10px] text-ink-400">Receipt QCR-{approvedPayment.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <button onClick={() => downloadReceipt(approvedPayment)} disabled={receiptGenerating} className="btn-secondary mt-3 w-full">
                  <Download className="h-4 w-4" /> {receiptGenerating ? 'Generating…' : 'Download PDF receipt'}
                </button>
              </div>
            </div>
          )}

          {/* Quick Access */}
          <div className="bg-gradient-to-br from-brand-50 to-accent-50 rounded-2xl border border-brand-100 p-5">
            <h3 className="font-display font-bold text-ink-900 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-brand-600" /> Quick Access
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {['pdf-merge', 'img-compress', 'text-case', 'qr-generate'].map((id) => (
                <button
                  key={id}
                  onClick={() => navigate(`/tool/${id}`)}
                  className="p-3 rounded-xl bg-white border border-ink-100 hover:border-brand-300 hover:shadow-soft transition text-left"
                >
                  <p className="text-xs font-semibold text-ink-800 capitalize">{id.replace(/-/g, ' ')}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-ink-200 p-5">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} text-white grid place-items-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-display font-extrabold text-ink-900">{value}</p>
      <p className="text-xs text-ink-500 mt-0.5">{label}</p>
    </div>
  );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition capitalize ${active ? 'bg-brand-600 text-white' : 'bg-ink-50 text-ink-600 hover:bg-ink-100'}`}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );
}
