import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileCheck2,
  FileSignature,
  Fingerprint,
  Hash,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Loader2,
  PenLine,
  RefreshCw,
  RotateCcw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Type,
  Upload,
  Users,
  XCircle,
  Eye,
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import {
  consumeConversion,
  refundConversion,
  getUsageStatus,
} from '@/lib/usage';
import { supabase } from '@/lib/supabase';

import {
  addSignatureToPdf,
  addSignatureToPdfPages,
  createIntegrityProof,
  createSignatureDataUrl,
  fileToDataUrl,
  sha256Hex,
  signImage,
  verifyIntegrityProof,
  saveSignedArtifact,
  loadSignedArtifact,
} from '@/lib/signatures';

type Props = {
  navigate: (path: string) => void;
};

type ToolId =
  | 'create'
  | 'typed'
  | 'draw'
  | 'initials'
  | 'upload'
  | 'pdf'
  | 'image'
  | 'place'
  | 'multipage'
  | 'request'
  | 'order'
  | 'template'
  | 'verify'
  | 'hash'
  | 'audit'
  | 'download';

type SignatureTool = {
  id: ToolId;
  name: string;
  description: string;
  icon: any;
};

const SIGNATURE_TOOLS: SignatureTool[] = [
  {
    id: 'create',
    name: 'Create Signature',
    description: 'Create and download a reusable signature mark.',
    icon: PenLine,
  },
  {
    id: 'typed',
    name: 'Typed Signature',
    description: 'Turn typed text into a polished handwritten-style mark.',
    icon: Type,
  },
  {
    id: 'draw',
    name: 'Draw Signature',
    description: 'Draw naturally with mouse, touch or stylus.',
    icon: PenLine,
  },
  {
    id: 'initials',
    name: 'Initials',
    description: 'Create a compact initials signature for fast signing.',
    icon: Fingerprint,
  },
  {
    id: 'upload',
    name: 'Upload Signature',
    description: 'Use an existing PNG, JPG or WebP signature.',
    icon: Upload,
  },
  {
    id: 'pdf',
    name: 'Sign PDF',
    description: 'Place a visible signature and cryptographically sign a PDF.',
    icon: FileSignature,
  },
  {
    id: 'image',
    name: 'Sign Image',
    description: 'Place a signature on a PNG, JPG or WebP image.',
    icon: ImageIcon,
  },
  {
    id: 'place',
    name: 'Precision Placement',
    description: 'Control page, X, Y and signature size precisely.',
    icon: Link2,
  },
  {
    id: 'multipage',
    name: 'Multi-page Sign',
    description: 'Apply one signature to every selected PDF page.',
    icon: ClipboardCheck,
  },
  {
    id: 'request',
    name: 'Request Signatures',
    description: 'Create a shareable multi-signer signing workflow.',
    icon: Send,
  },
  {
    id: 'order',
    name: 'Signer Order',
    description: 'Configure sequential or parallel signer workflows.',
    icon: Users,
  },
  {
    id: 'template',
    name: 'Signature Templates',
    description: 'Save and restore your preferred signing setup.',
    icon: Sparkles,
  },
  {
    id: 'verify',
    name: 'Verify Signature',
    description: 'Verify the signed artifact against its cryptographic proof.',
    icon: BadgeCheck,
  },
  {
    id: 'hash',
    name: 'Document Hash',
    description: 'Generate a SHA-256 fingerprint for any file.',
    icon: Hash,
  },
  {
    id: 'audit',
    name: 'Audit Trail',
    description: 'Read the immutable signing events recorded for a request.',
    icon: ShieldCheck,
  },
  {
    id: 'download',
    name: 'Signed File & Proof',
    description: 'Download, preview and share the latest signed artifact.',
    icon: Download,
  },
];

const fonts = [
  {
    value: 'cursive',
    label: 'Signature Script',
  },
  {
    value: '"Brush Script MT", cursive',
    label: 'Brush',
  },
  {
    value: '"Segoe Script", cursive',
    label: 'Elegant',
  },
  {
    value: '"Lucida Handwriting", cursive',
    label: 'Handwritten',
  },
];

const SIGNATURE_TEMPLATES = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Balanced placement for contracts and business PDFs.',
    font: '"Segoe Script", cursive',
    width: 24,
    x: 68,
    y: 74,
    mode: 'typed' as const,
  },
  {
    id: 'formal',
    name: 'Formal Document',
    description: 'Compact lower-right signature placement.',
    font: 'cursive',
    width: 20,
    x: 72,
    y: 82,
    mode: 'typed' as const,
  },
  {
    id: 'initials',
    name: 'Initials',
    description: 'Small initials mark for forms and approvals.',
    font: 'cursive',
    width: 14,
    x: 80,
    y: 86,
    mode: 'initials' as const,
  },
  {
    id: 'large',
    name: 'Large Signature',
    description: 'Clear signature for forms where visibility matters.',
    font: '"Brush Script MT", cursive',
    width: 32,
    x: 60,
    y: 72,
    mode: 'typed' as const,
  },
  {
    id: 'multi',
    name: 'Multi-page',
    description: 'Consistent placement across every selected page.',
    font: 'cursive',
    width: 22,
    x: 70,
    y: 80,
    mode: 'typed' as const,
  },
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;

  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

async function pkiSignPdf(
  bytes: Uint8Array,
  filename: string,
  signerName: string,
  x: number,
  y: number,
  width: number,
  page: number
) {
  const configured = String(
    import.meta.env.VITE_SIGNING_API_URL || ''
  )
    .trim()
    .replace(/\/$/, '');

  if (!configured) {
    return bytes;
  }

  try {
    const target = new URL(configured, window.location.origin);

    const isLocalTarget = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
    ].includes(target.hostname);

    const isLocalBrowser = [
      'localhost',
      '127.0.0.1',
    ].includes(window.location.hostname);

    if (isLocalTarget && !isLocalBrowser) {
      throw new Error(
        'The signing API is configured as localhost. Set VITE_SIGNING_API_URL to your public HTTPS signing API before deploying.'
      );
    }
  } catch (e) {
    if (
      e instanceof Error &&
      e.message.includes('configured as localhost')
    ) {
      throw e;
    }

    throw new Error('Invalid VITE_SIGNING_API_URL.');
  }

  const controller = new AbortController();

  const timeout = window.setTimeout(() => {
    controller.abort();
  }, 120000);

  try {
    const form = new FormData();

    form.append(
      'file',
      new Blob([bytes], {
        type: 'application/pdf',
      }),
      filename
    );

    form.append(
      'signer_name',
      signerName || 'QuadraConverter User'
    );

    form.append('page', String(page));
    form.append('x', String(x));
    form.append('y', String(y));
    form.append('width', String(width));

    const response = await fetch(
      `${configured}/sign-pdf`,
      {
        method: 'POST',
        body: form,
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');

      throw new Error(
        detail ||
          `Signing API returned HTTP ${response.status}.`
      );
    }

    return new Uint8Array(
      await response.arrayBuffer()
    );
  } catch (e) {
    if (
      e instanceof DOMException &&
      e.name === 'AbortError'
    ) {
      throw new Error(
        'The signing server timed out. Check the signing API health and try again.'
      );
    }

    if (e instanceof TypeError) {
      throw new Error(
        'Could not reach the signing server. Set VITE_SIGNING_API_URL to the public HTTPS URL of your FastAPI signing service and enable CORS for quadraconverter.in.'
      );
    }

    throw e;
  } finally {
    window.clearTimeout(timeout);
  }
}

/* -------------------------------------------------------------------------- */
/* Live signing canvas                                                        */
/* -------------------------------------------------------------------------- */

type PlacementStageProps = {
  file: File | null;
  signature: string;
  page: number;
  pageCount: number;
  x: number;
  y: number;
  width: number;
  onPosition: (x: number, y: number) => void;
  onWidth: (width: number) => void;
  onPage: (page: number) => void;
};

function LiveSignaturePlacement({
  file,
  signature,
  page,
  pageCount,
  x,
  y,
  width,
  onPosition,
  onWidth,
  onPage,
}: PlacementStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);

  const [previewUrl, setPreviewUrl] = useState('');
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);

  const [dragOffset, setDragOffset] = useState({
    x: 0,
    y: 0,
  });

  const isPdf =
    !!file &&
    (
      file.type === 'application/pdf' ||
      /\.pdf$/i.test(file.name)
    );

  const imageRef = useRef<HTMLImageElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file || !isPdf) {
      setPreviewUrl('');
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const pdfjs =
          await import('pdfjs-dist/build/pdf.mjs');

        const bytes = new Uint8Array(
          await file.arrayBuffer()
        );

        const pdf = await pdfjs.getDocument({
          data: bytes,
          disableWorker: true,
        }).promise;

        const pdfPage = await pdf.getPage(
          Math.max(
            1,
            Math.min(page, pdf.numPages)
          )
        );

        const base = pdfPage.getViewport({
          scale: 1,
        });

        const maxWidth = 760;

        const scale = Math.min(
          2,
          maxWidth / base.width
        );

        const viewport =
          pdfPage.getViewport({
            scale,
          });

        const canvas = pdfCanvasRef.current;

        if (!canvas || cancelled) {
          return;
        }

        canvas.width = Math.ceil(
          viewport.width
        );

        canvas.height = Math.ceil(
          viewport.height
        );

        canvas.style.aspectRatio =
          `${viewport.width} / ${viewport.height}`;

        const context =
          canvas.getContext('2d');

        if (!context) {
          throw new Error(
            'Could not create PDF preview canvas.'
          );
        }

        await pdfPage.render({
          canvasContext: context,
          viewport,
        }).promise;
      } catch {
        if (!cancelled) {
          setPreviewUrl(
            URL.createObjectURL(file)
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, page, isPdf]);

  useEffect(() => {
    if (!file || isPdf) {
      return;
    }

    const url = URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, isPdf]);

  const move = (
    clientX: number,
    clientY: number
  ) => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const rect =
      stage.getBoundingClientRect();

    const sigWidthPx =
      (rect.width * width) / 100;

    const sigHeightPx = Math.max(
      36,
      sigWidthPx * 0.34
    );

    const left =
      clientX -
      rect.left -
      dragOffset.x;

    const top =
      clientY -
      rect.top -
      dragOffset.y;

    const nextX = Math.max(
      0,
      Math.min(
        100 - width,
        (left / rect.width) * 100
      )
    );

    const nextY = Math.max(
      0,
      Math.min(
        100 -
          (sigHeightPx / rect.height) *
            100,
        (top / rect.height) * 100
      )
    );

    onPosition(nextX, nextY);
  };

  const resize = (
    clientX: number
  ) => {
    const stage = stageRef.current;

    if (!stage) {
      return;
    }

    const rect =
      stage.getBoundingClientRect();

    const leftPx =
      (rect.width * x) / 100;

    const nextWidth = Math.max(
      8,
      Math.min(
        65,
        ((clientX -
          rect.left -
          leftPx) /
          rect.width) *
          100
      )
    );

    onWidth(nextWidth);
  };

  useEffect(() => {
    const movePointer = (
      e: PointerEvent
    ) => {
      if (dragging) {
        move(
          e.clientX,
          e.clientY
        );
      }

      if (resizing) {
        resize(e.clientX);
      }
    };

    const stop = () => {
      setDragging(false);
      setResizing(false);
    };

    window.addEventListener(
      'pointermove',
      movePointer
    );

    window.addEventListener(
      'pointerup',
      stop
    );

    return () => {
      window.removeEventListener(
        'pointermove',
        movePointer
      );

      window.removeEventListener(
        'pointerup',
        stop
      );
    };
  });

  if (!file) {
    return (
      <div className="mt-5 rounded-3xl border border-dashed border-ink-200 bg-ink-50 p-8 text-center">
        <FileSignature className="mx-auto h-8 w-8 text-ink-300" />

        <p className="mt-3 text-sm font-bold text-ink-700">
          Upload your document to place the signature
        </p>

        <p className="mt-1 text-xs text-ink-400">
          The live placement canvas appears here after upload.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 overflow-hidden rounded-3xl border border-ink-200 bg-ink-950">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-white/50">
            Live placement
          </p>

          <p className="text-sm font-semibold">
            Drag the signature anywhere on the document
          </p>
        </div>

        {isPdf && pageCount > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40"
              disabled={page <= 1}
              onClick={() =>
                onPage(page - 1)
              }
            >
              Previous
            </button>

            <span className="text-xs font-bold text-white/70">
              Page {page} / {pageCount}
            </span>

            <button
              type="button"
              className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold disabled:opacity-40"
              disabled={
                page >= pageCount
              }
              onClick={() =>
                onPage(page + 1)
              }
            >
              Next
            </button>
          </div>
        )}
      </div>

      <div className="max-h-[760px] overflow-auto p-4 sm:p-6">
        <div
          ref={stageRef}
          className="relative mx-auto w-fit max-w-full overflow-hidden rounded-xl bg-white shadow-2xl select-none"
        >
          {isPdf ? (
            <canvas
              ref={pdfCanvasRef}
              className="block h-auto max-w-full"
            />
          ) : (
            <img
              ref={imageRef}
              src={previewUrl}
              alt="Document preview"
              className="block max-h-[680px] max-w-full object-contain"
              draggable={false}
            />
          )}

          {signature && (
            <div
              className="absolute z-10 cursor-grab active:cursor-grabbing"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${width}%`,
              }}
              onPointerDown={(e) => {
                e.preventDefault();

                const rect =
                  e.currentTarget.getBoundingClientRect();

                setDragOffset({
                  x:
                    e.clientX -
                    rect.left,
                  y:
                    e.clientY -
                    rect.top,
                });

                setDragging(true);
              }}
            >
              <div className="relative rounded-md border-2 border-dashed border-brand-600 bg-white/10 p-1 shadow-lg">
                <img
                  src={signature}
                  alt="Signature to place"
                  className="pointer-events-none block w-full"
                  draggable={false}
                />

                <span className="absolute -top-6 left-0 whitespace-nowrap rounded-md bg-brand-700 px-2 py-1 text-[10px] font-bold text-white">
                  Drag signature
                </span>

                <button
                  type="button"
                  aria-label="Resize signature"
                  className="absolute -bottom-2 -right-2 h-5 w-5 cursor-se-resize rounded-full border-2 border-white bg-brand-700"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setResizing(true);
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 border-t border-white/10 bg-white/[.04] p-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-white/5 p-3 text-xs text-white/70">
          <b className="block text-white">
            Position
          </b>
          X {Math.round(x)}% · Y {Math.round(y)}%
        </div>

        <div className="rounded-2xl bg-white/5 p-3 text-xs text-white/70">
          <b className="block text-white">
            Size
          </b>
          {Math.round(width)}% document width
        </div>

        <div className="rounded-2xl bg-white/5 p-3 text-xs text-white/70">
          <b className="block text-white">
            Saved coordinates
          </b>
          These exact coordinates are used when the final file is generated.
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main page                                                                  */
/* -------------------------------------------------------------------------- */

export function SignaturesPage({
  navigate,
}: Props) {
  const { user } = useAuth();

  const [selected, setSelected] =
    useState<ToolId>('create');

  const [name, setName] =
    useState('');

  const [initials, setInitials] =
    useState('');

  const [font, setFont] =
    useState(fonts[0].value);

  const [signatureText, setSignatureText] =
    useState('');

  const [file, setFile] =
    useState<File | null>(null);

  const [signatureImage, setSignatureImage] =
    useState('');

  const [signedBytes, setSignedBytes] =
    useState<Uint8Array | null>(null);

  const [signedType, setSignedType] =
    useState('application/pdf');

  const [proof, setProof] =
    useState<any>(null);

  const [busy, setBusy] =
    useState(false);

  const [status, setStatus] =
    useState('');

  const [error, setError] =
    useState('');

  const [page, setPage] =
    useState(1);

  const [pageCount, setPageCount] =
    useState(1);

  const [x, setX] =
    useState(68);

  const [y, setY] =
    useState(74);

  const [width, setWidth] =
    useState(24);

  const [signerEmails, setSignerEmails] =
    useState('');

  const [signingOrder, setSigningOrder] =
    useState<'parallel' | 'sequential'>(
      'sequential'
    );

  const [templateId, setTemplateId] =
    useState('professional');

  const [requestId, setRequestId] =
    useState('');

  const [requestLinks, setRequestLinks] =
    useState<string[]>([]);

  const [hashResult, setHashResult] =
    useState('');

  const [verifyFile, setVerifyFile] =
    useState<File | null>(null);

  const [verifyProofFile, setVerifyProofFile] =
    useState<File | null>(null);

  const [verifyResult, setVerifyResult] =
    useState<{
      valid: boolean;
      reason: string;
    } | null>(null);

  const [audit, setAudit] =
    useState<any[]>([]);

  const [freeRemaining, setFreeRemaining] =
    useState<number | null>(null);

  const canvas =
    useRef<HTMLCanvasElement>(null);

  const drawing =
    useRef(false);

  const [signedPreviewUrl, setSignedPreviewUrl] =
    useState('');

  const activeTool = useMemo(
    () =>
      SIGNATURE_TOOLS.find(
        (t) => t.id === selected
      )!,
    [selected]
  );

  const ActiveIcon =
    activeTool.icon;

  const selectTool = (
    id: ToolId
  ) => {
    setSelected(id);
    setError('');
    setStatus('');
    setVerifyResult(null);
    setHashResult('');
    setRequestLinks([]);
    setBusy(false);

    if (id !== 'download') {
      setSignedBytes(null);
      setProof(null);
    }

    if (id === 'draw') {
      setSignatureImage('');
    }
  };

  const refreshUsage =
    async () => {
      try {
        const usage =
          await getUsageStatus();

        setFreeRemaining(
          usage.unlimited
            ? null
            : usage.free_remaining
        );
      } catch {
        // Usage errors are surfaced when the action runs.
      }
    };

  useEffect(() => {
    refreshUsage();
  }, []);

  useEffect(() => {
    let active = true;

    loadSignedArtifact().then(
      (saved) => {
        if (!active || !saved) {
          return;
        }

        setSignedBytes(
          saved.bytes
        );

        setSignedType(
          saved.mimeType
        );

        setProof(saved.proof);

        setStatus(
          `Recovered the latest signed artifact from this device (${new Date(
            saved.savedAt
          ).toLocaleString()}).`
        );
      }
    );

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selected !== 'download') {
      return;
    }

    let active = true;

    loadSignedArtifact().then(
      (saved) => {
        if (!active || !saved) {
          return;
        }

        setSignedBytes(
          saved.bytes
        );

        setSignedType(
          saved.mimeType
        );

        setProof(saved.proof);

        setStatus(
          'Latest signed artifact loaded and ready to download.'
        );
      }
    );

    return () => {
      active = false;
    };
  }, [selected]);

  useEffect(() => {
    setPageCount(1);

    if (
      file?.type === 'application/pdf' ||
      file?.name
        .toLowerCase()
        .endsWith('.pdf')
    ) {
      import('pdf-lib')
        .then(({ PDFDocument }) =>
          file
            .arrayBuffer()
            .then((b) =>
              PDFDocument.load(b)
            )
        )
        .then((pdf) =>
          setPageCount(
            pdf.getPageCount()
          )
        )
        .catch(() =>
          setPageCount(1)
        );
    } else {
      setPageCount(1);
    }
  }, [file]);

  useEffect(() => {
    if (!signedBytes) {
      setSignedPreviewUrl('');
      return;
    }

    const url =
      URL.createObjectURL(
        new Blob([signedBytes], {
          type: signedType,
        })
      );

    setSignedPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [signedBytes, signedType]);

  useEffect(() => {
    if (!requestId || !user) {
      return;
    }

    supabase
      .from('signature_events')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', {
        ascending: false,
      })
      .then(({ data }) => {
        setAudit(data || []);
      });
  }, [requestId, user]);

  const clearCanvas =
    () => {
      const c = canvas.current;

      if (c) {
        c.getContext('2d')?.clearRect(
          0,
          0,
          c.width,
          c.height
        );
      }

      setSignatureImage('');
    };

  const point = (
    e: PointerEvent
  ) => {
    const c = canvas.current;

    if (!c) {
      return {
        x: 0,
        y: 0,
      };
    }

    const r =
      c.getBoundingClientRect();

    return {
      x:
        ((e.clientX - r.left) *
          c.width) /
        r.width,

      y:
        ((e.clientY - r.top) *
          c.height) /
        r.height,
    };
  };

  const startDraw = (
    e: PointerEvent
  ) => {
    const c = canvas.current;

    if (!c) {
      return;
    }

    drawing.current = true;

    c.setPointerCapture(
      e.pointerId
    );

    const p = point(e);

    const ctx =
      c.getContext('2d');

    if (!ctx) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(
      p.x,
      p.y
    );

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#040720';
  };

  const moveDraw = (
    e: PointerEvent
  ) => {
    if (!drawing.current) {
      return;
    }

    const c = canvas.current;

    if (!c) {
      return;
    }

    const p = point(e);

    const ctx =
      c.getContext('2d');

    if (!ctx) {
      return;
    }

    ctx.lineTo(
      p.x,
      p.y
    );

    ctx.stroke();
  };

  const endDraw =
    () => {
      drawing.current = false;

      if (canvas.current) {
        setSignatureImage(
          canvas.current.toDataURL(
            'image/png'
          )
        );
      }
    };

  const buildSignature =
    async (
      modeOverride?: ToolId
    ) => {
      const mode =
        modeOverride ||
        selected;

      if (mode === 'upload') {
        return signatureImage;
      }

      if (
        mode === 'draw' &&
        !signatureImage
      ) {
        throw new Error(
          'Draw your signature first.'
        );
      }

      const value =
        mode === 'initials'
          ? initials ||
            name
              .slice(0, 2)
              .toUpperCase()
          : signatureText ||
            name;

      if (
        !value &&
        mode !== 'draw'
      ) {
        throw new Error(
          'Enter your name, initials or signature text.'
        );
      }

      if (mode === 'draw') {
        return signatureImage;
      }

      const result =
        await createSignatureDataUrl(
          mode === 'initials'
            ? 'initials'
            : 'typed',
          value,
          font
        );

      setSignatureImage(result);

      return result;
    };

  const reserveCredit =
    async () => {
      if (!user) {
        throw new Error(
          'Please sign in before using a signature tool.'
        );
      }

      const reservation =
        await consumeConversion();

      if (!reservation.allowed) {
        throw new Error(
          reservation.message ||
            'You have used all 5 free conversions for today.'
        );
      }

      return reservation.unlimited
        ? null
        : reservation.reservation_id ||
            null;
    };

  const run =
    async () => {
      setBusy(true);
      setError('');
      setStatus('');
      setVerifyResult(null);

      let reservationId:
        | string
        | null = null;

      let uploadedPath:
        | string
        | null = null;

      try {
        reservationId =
          await reserveCredit();

        /* -------------------------------------------------------------- */
        /* CREATE / TYPED / INITIALS                                     */
        /* -------------------------------------------------------------- */

        if (
          selected === 'create' ||
          selected === 'typed' ||
          selected === 'initials'
        ) {
          const sig =
            await buildSignature(
              selected
            );

          const raw =
            sig.split(',')[1];

          const bytes =
            Uint8Array.from(
              atob(raw),
              (c) =>
                c.charCodeAt(0)
            );

          downloadBlob(
            new Blob([bytes], {
              type: 'image/png',
            }),
            `${(
              name ||
              'quadra-signature'
            )
              .replace(
                /\s+/g,
                '-'
              )
              .toLowerCase()}.png`
          );

          setStatus(
            'Signature created and downloaded.'
          );
        }

        /* -------------------------------------------------------------- */
        /* DRAW                                                          */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'draw'
        ) {
          const sig =
            await buildSignature(
              'draw'
            );

          if (!sig) {
            throw new Error(
              'Draw your signature first.'
            );
          }

          const raw =
            sig.split(',')[1];

          const bytes =
            Uint8Array.from(
              atob(raw),
              (c) =>
                c.charCodeAt(0)
            );

          downloadBlob(
            new Blob([bytes], {
              type: 'image/png',
            }),
            'drawn-signature.png'
          );

          setStatus(
            'Hand-drawn signature created and downloaded.'
          );
        }

        /* -------------------------------------------------------------- */
        /* UPLOAD SIGNATURE                                               */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'upload'
        ) {
          if (!signatureImage) {
            throw new Error(
              'Upload a signature image first.'
            );
          }

          const raw =
            signatureImage.split(',')[1];

          const bytes =
            Uint8Array.from(
              atob(raw),
              (c) =>
                c.charCodeAt(0)
            );

          downloadBlob(
            new Blob([bytes], {
              type:
                signatureImage
                  .split(';')[0]
                  .replace(
                    'data:',
                    ''
                  ) ||
                'image/png',
            }),
            'uploaded-signature.png'
          );

          setStatus(
            'Signature image is ready.'
          );
        }

        /* -------------------------------------------------------------- */
        /* HASH                                                          */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'hash'
        ) {
          if (!file) {
            throw new Error(
              'Upload a file to hash.'
            );
          }

          setHashResult(
            await sha256Hex(
              await file.arrayBuffer()
            )
          );

          setStatus(
            'SHA-256 document fingerprint generated.'
          );
        }

        /* -------------------------------------------------------------- */
        /* VERIFY                                                        */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'verify'
        ) {
          if (
            !verifyFile ||
            !verifyProofFile
          ) {
            throw new Error(
              'Select the signed file and its .qsign.json proof.'
            );
          }

          const p =
            JSON.parse(
              await verifyProofFile.text()
            );

          const result =
            await verifyIntegrityProof(
              new Uint8Array(
                await verifyFile.arrayBuffer()
              ),
              p
            );

          setVerifyResult(
            result
          );

          setStatus(
            result.valid
              ? 'Signature proof verified: document is unchanged.'
              : 'Verification failed: the artifact does not match its proof.'
          );
        }

        /* -------------------------------------------------------------- */
        /* TEMPLATE                                                       */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'template'
        ) {
          const template = {
            version: '2.0',
            id: templateId,
            name:
              name ||
              'QuadraConverter Signature',
            signerName: name,
            initials:
              initials ||
              name
                .slice(0, 2)
                .toUpperCase(),
            signatureText:
              signatureText ||
              name,
            font,
            placement: {
              x,
              y,
              width,
            },
            signingOrder,
            createdAt:
              new Date().toISOString(),
            product:
              'QuadraConverter',
          };

          localStorage.setItem(
            'quadra_signature_template',
            JSON.stringify(
              template
            )
          );

          const sig =
            await buildSignature(
              'typed'
            );

          downloadBlob(
            new Blob(
              [
                JSON.stringify(
                  template,
                  null,
                  2
                ),
              ],
              {
                type:
                  'application/json',
              }
            ),
            `${(
              template.name ||
              'quadra-signature-template'
            )
              .replace(
                /[^a-z0-9]+/gi,
                '-'
              )
              .toLowerCase()}.qsignature.json`
          );

          if (sig) {
            const raw =
              atob(
                sig.split(',')[1]
              );

            const bytes =
              Uint8Array.from(
                raw,
                (c) =>
                  c.charCodeAt(0)
              );

            downloadBlob(
              new Blob([bytes], {
                type: 'image/png',
              }),
              `${(
                template.name ||
                'signature'
              )
                .replace(
                  /[^a-z0-9]+/gi,
                  '-'
                )
                .toLowerCase()}-preview.png`
            );
          }

          setStatus(
            'Reusable signature template and preview generated and downloaded.'
          );
        }

        /* -------------------------------------------------------------- */
        /* ORDER                                                          */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'order'
        ) {
          if (!file) {
            throw new Error(
              'Upload the PDF for the ordered signing workflow.'
            );
          }

          if (
            !/\.pdf$/i.test(
              file.name
            )
          ) {
            throw new Error(
              'Signer Order currently requires a PDF document.'
            );
          }

          const emails =
            signerEmails
              .split(',')
              .map((s) =>
                s.trim().toLowerCase()
              )
              .filter(Boolean);

          if (emails.length < 2) {
            throw new Error(
              'Add at least two signer email addresses to create a signing order.'
            );
          }

          if (!user) {
            throw new Error(
              'Sign in before creating a signing workflow.'
            );
          }

          const safeName =
            file.name.replace(
              /[^a-zA-Z0-9._-]/g,
              '_'
            );

          const path =
            `${user.id}/${crypto.randomUUID()}-${safeName}`;

          uploadedPath = path;

          const {
            error: uploadError,
          } = await supabase.storage
            .from(
              'signature-files'
            )
            .upload(
              path,
              file,
              {
                upsert: false,
                contentType:
                  file.type ||
                  'application/pdf',
              }
            );

          if (uploadError) {
            throw new Error(
              uploadError.message.includes(
                'Bucket not found'
              )
                ? 'Signature storage is not configured. Run the included signature runtime SQL migration in Supabase.'
                : uploadError.message
            );
          }

          const {
            data,
            error: rpcError,
          } = await supabase.rpc(
            'create_signature_request',
            {
              p_document_name:
                file.name,
              p_document_path:
                path,
              p_signer_emails:
                emails,
              p_signing_order:
                signingOrder,
            }
          );

          if (rpcError) {
            throw rpcError;
          }

          const result =
            data as {
              request_id: string;
              signers: Array<{
                token: string;
                email: string;
                order?: number;
              }>;
            };

          setRequestId(
            result.request_id
          );

          const {
            data: signedUrlData,
            error: urlError,
          } = await supabase.storage
            .from(
              'signature-files'
            )
            .createSignedUrl(
              path,
              60 * 60 * 24 * 7
            );

          if (
            urlError ||
            !signedUrlData?.signedUrl
          ) {
            throw new Error(
              urlError?.message ||
                'Could not create the secure document preview link.'
            );
          }

          const links =
            (result.signers || []).map(
              (signer) =>
                `${window.location.origin}/#/sign/${encodeURIComponent(
                  signer.token
                )}?doc=${encodeURIComponent(
                  signedUrlData.signedUrl
                )}`
            );

          setRequestLinks(
            links
          );

          setStatus(
            `${
              signingOrder ===
              'sequential'
                ? 'Sequential'
                : 'Parallel'
            } signing workflow created for ${
              emails.length
            } signers. Each signer is enforced by the database.`
          );
        }

        /* -------------------------------------------------------------- */
        /* AUDIT                                                          */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'audit'
        ) {
          if (!requestId) {
            throw new Error(
              'Enter a signing request ID first.'
            );
          }

          const {
            data,
            error: auditError,
          } = await supabase
            .from(
              'signature_events'
            )
            .select('*')
            .eq(
              'request_id',
              requestId
            )
            .order(
              'created_at',
              {
                ascending: false,
              }
            );

          if (auditError) {
            throw auditError;
          }

          setAudit(
            data || []
          );

          setStatus(
            `${data?.length || 0} audit events loaded.`
          );
        }

        /* -------------------------------------------------------------- */
        /* REQUEST                                                        */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'request'
        ) {
          if (!file) {
            throw new Error(
              'Upload the PDF for the signing request.'
            );
          }

          if (
            !file.name
              .toLowerCase()
              .endsWith('.pdf')
          ) {
            throw new Error(
              'Signing requests currently require a PDF so every signer can preview and sign the same document.'
            );
          }

          const emails =
            signerEmails
              .split(',')
              .map((s) =>
                s.trim()
              )
              .filter(Boolean);

          if (!emails.length) {
            throw new Error(
              'Add at least one signer email.'
            );
          }

          if (!user) {
            throw new Error(
              'Sign in before creating a signing request.'
            );
          }

          const safeName =
            file.name.replace(
              /[^a-zA-Z0-9._-]/g,
              '_'
            );

          const path =
            `${user.id}/${crypto.randomUUID()}-${safeName}`;

          uploadedPath = path;

          const {
            error: uploadError,
          } = await supabase.storage
            .from(
              'signature-files'
            )
            .upload(
              path,
              file,
              {
                upsert: false,
                contentType:
                  file.type ||
                  'application/pdf',
              }
            );

          if (uploadError) {
            throw new Error(
              uploadError.message.includes(
                'Bucket not found'
              )
                ? 'Signature storage is not configured. Run supabase/migrations/20260823190000_signature_runtime_fix.sql in Supabase SQL Editor.'
                : uploadError.message
            );
          }

          const {
            data,
            error: rpcError,
          } = await supabase.rpc(
            'create_signature_request',
            {
              p_document_name:
                file.name,
              p_document_path:
                path,
              p_signer_emails:
                emails,
              p_signing_order:
                signingOrder,
            }
          );

          if (rpcError) {
            throw rpcError;
          }

          const result =
            data as {
              request_id: string;
              signers: Array<{
                token: string;
                email: string;
              }>;
            };

          setRequestId(
            result.request_id
          );

          const {
            data: signedUrlData,
            error: urlError,
          } = await supabase.storage
            .from(
              'signature-files'
            )
            .createSignedUrl(
              path,
              60 * 60 * 24 * 7
            );

          if (
            urlError ||
            !signedUrlData?.signedUrl
          ) {
            throw new Error(
              urlError?.message ||
                'Could not create the secure document preview link. Make sure the signature-files bucket migration has been applied.'
            );
          }

          const links =
            (result.signers || []).map(
              (signer) =>
                `${window.location.origin}/#/sign/${encodeURIComponent(
                  signer.token
                )}?doc=${encodeURIComponent(
                  signedUrlData.signedUrl
                )}`
            );

          setRequestLinks(
            links
          );

          await supabase
            .from(
              'signature_events'
            )
            .insert({
              request_id:
                result.request_id,
              actor_id:
                user.id,
              event_type:
                'request_created',
              metadata: {
                signerEmails:
                  emails,
                signingOrder,
                linksCreated:
                  links.length,
              },
            });

          setStatus(
            'Signing request created. Copy a signer link and send it to the intended recipient.'
          );
        }

        /* -------------------------------------------------------------- */
        /* DOWNLOAD                                                       */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'download'
        ) {
          const saved =
            signedBytes
              ? null
              : await loadSignedArtifact();

          if (
            !signedBytes &&
            !saved
          ) {
            throw new Error(
              'There is no signed artifact ready to download. Run a signing tool first.'
            );
          }

          if (saved) {
            setSignedBytes(
              saved.bytes
            );

            setSignedType(
              saved.mimeType
            );

            setProof(
              saved.proof
            );
          }

          await downloadSigned();
          await downloadProof();

          setStatus(
            'Signed artifact and proof downloaded.'
          );
        }

        /* -------------------------------------------------------------- */
        /* PDF / PRECISION / MULTIPAGE                                    */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'pdf' ||
          selected === 'place' ||
          selected === 'multipage'
        ) {
          if (!file) {
            throw new Error(
              'Upload a PDF first.'
            );
          }

          if (
            !file.name
              .toLowerCase()
              .endsWith('.pdf')
          ) {
            throw new Error(
              'PDF signing currently requires a PDF input. Convert DOCX to PDF first for the most reliable signing workflow.'
            );
          }

          const sig =
            signatureImage ||
            (await buildSignature(
              'typed'
            ));

          const source =
            await file.arrayBuffer();

          const visualBytes =
            selected ===
            'multipage'
              ? await addSignatureToPdfPages(
                  source,
                  sig,
                  Array.from(
                    {
                      length:
                        pageCount,
                    },
                    (_, i) =>
                      i + 1
                  ),
                  x,
                  y,
                  width
                )
              : await addSignatureToPdf(
                  source,
                  sig,
                  page,
                  x,
                  y,
                  width
                );

          let finalBytes =
            visualBytes;

          let pkiStatus =
            'Browser cryptographic proof';

          try {
            finalBytes =
              await pkiSignPdf(
                visualBytes,
                file.name,
                name ||
                  user?.email ||
                  'QuadraConverter User',
                x,
                y,
                width,
                page
              );

            if (
              finalBytes !==
              visualBytes
            ) {
              pkiStatus =
                'PAdES/PKI digital signature embedded by signing server';
            }
          } catch (e) {
            if (
              import.meta.env
                .VITE_SIGNING_API_URL
            ) {
              throw e;
            }

            setStatus(
              'Visual signature created. PKI server is not configured, so the downloadable proof uses browser ECDSA instead.'
            );
          }

          setSignedBytes(
            finalBytes
          );

          setSignedType(
            'application/pdf'
          );

          const p =
            await createIntegrityProof(
              finalBytes,
              {
                originalFile:
                  file.name,
                signatureMode:
                  selected,
                signerName:
                  name,
                initials,
                page,
                x,
                y,
                width,
                pkiStatus,
              }
            );

          setProof(p);

          await saveSignedArtifact(
            finalBytes,
            'application/pdf',
            `${file.name.replace(
              /\.[^.]+$/,
              ''
            )}-signed.pdf`,
            p
          );

          if (user) {
            const {
              data: req,
              error: reqError,
            } = await supabase
              .from(
                'signature_requests'
              )
              .insert({
                owner_id:
                  user.id,
                document_name:
                  file.name,
                signer_emails:
                  [],
                signing_order:
                  signingOrder,
                status:
                  'completed',
                document_hash:
                  p.documentHash,
                proof: p,
              })
              .select()
              .single();

            if (
              !reqError &&
              req?.id
            ) {
              setRequestId(
                req.id
              );

              await supabase
                .from(
                  'signature_events'
                )
                .insert({
                  request_id:
                    req.id,
                  actor_id:
                    user.id,
                  event_type:
                    'document_signed',
                  signer_email:
                    user.email,
                  metadata: p,
                });
            }
          }

          setStatus(
            `Signed PDF ready. ${pkiStatus}.`
          );
        }

        /* -------------------------------------------------------------- */
        /* IMAGE                                                          */
        /* -------------------------------------------------------------- */

        else if (
          selected === 'image'
        ) {
          if (
            !file ||
            !file.type.startsWith(
              'image/'
            )
          ) {
            throw new Error(
              'Upload a PNG, JPG or WebP image.'
            );
          }

          const sig =
            signatureImage ||
            (await buildSignature(
              'typed'
            ));

          const blob =
            await signImage(
              file,
              sig,
              x,
              y,
              width
            );

          const bytes =
            new Uint8Array(
              await blob.arrayBuffer()
            );

          setSignedBytes(
            bytes
          );

          setSignedType(
            'image/png'
          );

          const p =
            await createIntegrityProof(
              bytes,
              {
                originalFile:
                  file.name,
                signatureMode:
                  'image',
                signerName:
                  name,
                x,
                y,
                width,
              }
            );

          setProof(p);

          await saveSignedArtifact(
            bytes,
            'image/png',
            `${file.name.replace(
              /\.[^.]+$/,
              ''
            )}-signed.png`,
            p
          );

          setStatus(
            'Signed image created with a SHA-256 + ECDSA integrity proof.'
          );
        }

        await refreshUsage();
      } catch (e) {
        if (uploadedPath) {
          try {
            await supabase.storage
              .from(
                'signature-files'
              )
              .remove([
                uploadedPath,
              ]);
          } catch {
            // Ignore cleanup failure.
          }
        }

        if (reservationId) {
          try {
            await refundConversion(
              reservationId
            );
          } catch {
            // Keep the original error.
          }
        }

        setError(
          e instanceof Error
            ? e.message
            : 'Signature operation failed.'
        );
      } finally {
        setBusy(false);
      }
    };

  const applyTemplate = (
    id: string
  ) => {
    const template =
      SIGNATURE_TEMPLATES.find(
        (item) =>
          item.id === id
      );

    if (!template) {
      return;
    }

    setTemplateId(id);
    setFont(template.font);
    setX(template.x);
    setY(template.y);
    setWidth(template.width);
    setSignatureImage('');

    if (
      template.mode ===
        'initials' &&
      !initials &&
      name
    ) {
      setInitials(
        name
          .slice(0, 2)
          .toUpperCase()
      );
    }

    setStatus(
      `${template.name} template selected. Enter the signer details below, then run the tool.`
    );
  };

  const saveTemplate =
    () => {
      localStorage.setItem(
        'quadra_signature_template',
        JSON.stringify({
          name,
          initials,
          signatureText,
          font,
          x,
          y,
          width,
          signingOrder,
          templateId,
        })
      );

      setStatus(
        'Your custom signing setup was saved on this device.'
      );
    };

  const loadCustomTemplate =
    () => {
      try {
        const raw =
          localStorage.getItem(
            'quadra_signature_template'
          );

        if (!raw) {
          setStatus(
            'Choose one of the built-in templates above. No saved custom template is required.'
          );

          return;
        }

        const v =
          JSON.parse(raw);

        setName(
          v.name || ''
        );

        setInitials(
          v.initials || ''
        );

        setSignatureText(
          v.signatureText ||
            ''
        );

        setFont(
          v.font ||
            fonts[0].value
        );

        setX(
          v.x ?? 68
        );

        setY(
          v.y ?? 74
        );

        setWidth(
          v.width ?? 24
        );

        setSigningOrder(
          v.signingOrder ||
            'sequential'
        );

        setTemplateId(
          v.templateId ||
            'professional'
        );

        setStatus(
          'Custom signing setup loaded.'
        );
      } catch {
        setError(
          'Saved custom template is invalid.'
        );
      }
    };

  const onUploadSignature =
    async (
      f: File
    ) => {
      setError('');

      const allowed = [
        'image/png',
        'image/jpeg',
        'image/webp',
      ];

      if (
        !allowed.includes(
          f.type
        )
      ) {
        setError(
          'Choose a PNG, JPG or WebP signature image.'
        );

        return;
      }

      if (
        f.size >
        5 * 1024 * 1024
      ) {
        setError(
          'Signature images must be 5 MB or smaller.'
        );

        return;
      }

      try {
        setSignatureImage(
          await fileToDataUrl(f)
        );
      } catch {
        setError(
          'Could not read that signature image. Please choose another file.'
        );
      }
    };

  const downloadSigned =
    async () => {
      let bytes =
        signedBytes;

      let type =
        signedType;

      let filename = file
        ? `${file.name.replace(
            /\.[^.]+$/,
            ''
          )}-signed.${
            type ===
            'application/pdf'
              ? 'pdf'
              : 'png'
          }`
        : `quadra-signed.${
            type ===
            'application/pdf'
              ? 'pdf'
              : 'png'
          }`;

      if (!bytes) {
        const saved =
          await loadSignedArtifact();

        if (!saved) {
          setError(
            'There is no signed artifact on this device yet. Run a signing tool first.'
          );

          return;
        }

        bytes =
          saved.bytes;

        type =
          saved.mimeType;

        filename =
          saved.filename;

        setSignedBytes(
          bytes
        );

        setSignedType(
          type
        );

        setProof(
          saved.proof
        );
      }

      downloadBlob(
        new Blob([bytes], {
          type,
        }),
        filename
      );
    };

  const downloadProof =
    async () => {
      let currentProof =
        proof;

      let filename = `${
        file?.name?.replace(
          /\.[^.]+$/,
          ''
        ) ||
        'document'
      }-signed.qsign.json`;

      if (!currentProof) {
        const saved =
          await loadSignedArtifact();

        if (saved) {
          currentProof =
            saved.proof;

          filename =
            saved.filename.replace(
              /\.[^.]+$/,
              ''
            ) +
            '.qsign.json';
        }
      }

      if (currentProof) {
        downloadBlob(
          new Blob(
            [
              JSON.stringify(
                currentProof,
                null,
                2
              ),
            ],
            {
              type:
                'application/json',
            }
          ),
          filename
        );
      } else {
        setError(
          'No signed proof is available. Run a signing tool first.'
        );
      }
    };

  const share =
    async () => {
      if (
        !signedBytes ||
        !file
      ) {
        return;
      }

      const ext =
        signedType ===
        'application/pdf'
          ? 'pdf'
          : 'png';

      const signedFile =
        new File(
          [
            signedBytes,
          ],
          `${file.name.replace(
            /\.[^.]+$/,
            ''
          )}-signed.${ext}`,
          {
            type:
              signedType,
          }
        );

      if (
        navigator.share
      ) {
        try {
          await navigator.share({
            title:
              'Signed document',
            text:
              'Signed with QuadraConverter',
            files: [
              signedFile,
            ],
          });
        } catch (e) {
          if (
            !(
              e instanceof DOMException &&
              e.name ===
                'AbortError'
            )
          ) {
            setError(
              'Sharing was not completed. You can still download the signed file.'
            );
          }
        }
      } else {
        setStatus(
          'Native sharing is not available in this browser. Use Download instead.'
        );
      }
    };

  const signatureNeedsFile =
    [
      'pdf',
      'place',
      'multipage',
      'image',
      'request',
      'order',
      'hash',
    ].includes(selected);

  return (
    <div className="signature-shell">
      {/* HERO */}
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 grid-pattern opacity-30" />

        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-600/30 blur-3xl" />

        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-brand-400/15 blur-3xl" />

        <div className="container-page relative py-14 sm:py-20">
          <div className="max-w-4xl">
            <span className="signature-kicker">
              <FileSignature className="h-3.5 w-3.5" />
              16 signature tools · included in your 5 daily credits
            </span>

            <h1 className="mt-5 font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              Sign documents with a workflow built for trust.
            </h1>

            <p className="mt-5 max-w-3xl text-base leading-7 text-white/65 sm:text-lg">
              Create a visible signature, hash the final artifact,
              produce an ECDSA integrity proof, and — when the
              signing API is configured — embed a standards-based
              PAdES digital signature with an X.509 certificate
              and optional trusted timestamp.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <span className="signature-pill">
                <Hash className="h-4 w-4" />
                SHA-256
              </span>

              <span className="signature-pill">
                <KeyRound className="h-4 w-4" />
                ECDSA P-256
              </span>

              <span className="signature-pill">
                <ShieldCheck className="h-4 w-4" />
                PAdES / PKI ready
              </span>

              <span className="signature-pill">
                <Sparkles className="h-4 w-4" />
                5 free credits/day
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* MAIN */}
      <section className="container-page py-8 sm:py-12">
        <div className="mb-7 flex flex-col gap-3 rounded-3xl border border-brand-100 bg-brand-50/70 p-5 shadow-soft sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-brand-700">
              Daily signature allowance
            </p>

            <p className="mt-1 text-sm text-ink-600">
              Signature actions consume the same conversion credits
              as every other QuadraConverter tool. There is no
              Signature Suite paywall.
            </p>
          </div>

          <div className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-ink-900 ring-1 ring-brand-100">
            {freeRemaining === null
              ? 'Unlimited'
              : `${freeRemaining ?? '—'} credits left today`}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* SIDEBAR */}
          <aside className="card h-fit overflow-hidden p-2 lg:sticky lg:top-28">
            <div className="px-3 py-3">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-ink-400">
                Signature workspace
              </p>

              <p className="mt-1 text-xs text-ink-500">
                Every tool is live and credit-metered.
              </p>
            </div>

            <div className="max-h-[65vh] space-y-1 overflow-auto pr-1">
              {SIGNATURE_TOOLS.map(
                (tool) => {
                  const Icon =
                    tool.icon;

                  return (
                    <button
                      key={
                        tool.id
                      }
                      type="button"
                      disabled={
                        busy
                      }
                      onClick={() =>
                        selectTool(
                          tool.id
                        )
                      }
                      className={`signature-tool ${
                        selected ===
                        tool.id
                          ? 'signature-tool-active'
                          : ''
                      }`}
                    >
                      <span className="signature-tool-icon">
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0 text-left">
                        <span className="block truncate text-xs font-extrabold">
                          {
                            tool.name
                          }
                        </span>

                        <span className="mt-0.5 block line-clamp-2 text-[10px] leading-snug text-ink-400">
                          {
                            tool.description
                          }
                        </span>
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </aside>

          {/* WORKSPACE */}
          <div className="min-w-0 space-y-6">
            <div className="card overflow-hidden">
              <div className="flex flex-col gap-4 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
                <div>
                  <span className="section-eyebrow">
                    <ActiveIcon className="h-3.5 w-3.5" />
                    Active tool
                  </span>

                  <h2 className="mt-3 font-display text-2xl font-extrabold text-ink-900">
                    {
                      activeTool.name
                    }
                  </h2>

                  <p className="mt-1 max-w-2xl text-sm text-ink-500">
                    {
                      activeTool.description
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    refreshUsage
                  }
                  className="btn-secondary"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh credits
                </button>
              </div>

              <div className="p-5 sm:p-7">
                {/* BASIC SIGNATURE TOOLS */}
                {(
                  selected ===
                    'create' ||
                  selected ===
                    'typed' ||
                  selected ===
                    'initials' ||
                  selected ===
                    'draw'
                ) && (
                  <div className="grid gap-5 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-bold">
                        Signer name
                      </label>

                      <input
                        className="input mt-1.5"
                        value={name}
                        onChange={(
                          e
                        ) =>
                          setName(
                            e.target
                              .value
                          )
                        }
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold">
                        Signature text
                      </label>

                      <input
                        className="input mt-1.5"
                        value={
                          signatureText
                        }
                        onChange={(
                          e
                        ) =>
                          setSignatureText(
                            e.target
                              .value
                          )
                        }
                        placeholder="How you want the signature to appear"
                      />
                    </div>

                    {(
                      selected ===
                        'typed' ||
                      selected ===
                        'create'
                    ) && (
                      <div>
                        <label className="text-sm font-bold">
                          Style
                        </label>

                        <select
                          className="input mt-1.5"
                          value={font}
                          onChange={(
                            e
                          ) =>
                            setFont(
                              e.target
                                .value
                            )
                          }
                        >
                          {fonts.map(
                            (
                              f
                            ) => (
                              <option
                                key={
                                  f.value
                                }
                                value={
                                  f.value
                                }
                              >
                                {
                                  f.label
                                }
                              </option>
                            )
                          )}
                        </select>
                      </div>
                    )}

                    {selected ===
                      'initials' && (
                      <div>
                        <label className="text-sm font-bold">
                          Initials
                        </label>

                        <input
                          className="input mt-1.5"
                          value={
                            initials
                          }
                          onChange={(
                            e
                          ) =>
                            setInitials(
                              e.target
                                .value
                                .toUpperCase()
                            )
                          }
                          maxLength={6}
                          placeholder="DL"
                        />
                      </div>
                    )}

                    {selected ===
                      'draw' && (
                      <div className="md:col-span-2">
                        <div className="mb-2 flex items-center justify-between">
                          <label className="text-sm font-bold">
                            Draw with mouse, touch or stylus
                          </label>

                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={
                              clearCanvas
                            }
                          >
                            <RotateCcw className="h-4 w-4" />
                            Clear
                          </button>
                        </div>

                        <canvas
                          ref={canvas}
                          width={1200}
                          height={300}
                          className="signature-canvas"
                          onPointerDown={
                            startDraw
                          }
                          onPointerMove={
                            moveDraw
                          }
                          onPointerUp={
                            endDraw
                          }
                          onPointerCancel={
                            endDraw
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* UPLOAD SIGNATURE */}
                {selected ===
                  'upload' && (
                  <div>
                    <label className="text-sm font-bold">
                      Signature image
                    </label>

                    <label className="mt-2 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-ink-200 bg-ink-50/60 p-7 transition hover:border-brand-300 hover:bg-brand-50">
                      <Upload className="h-6 w-6 text-brand-600" />

                      <span>
                        <b>
                          {signatureImage
                            ? 'Signature selected'
                            : 'Choose PNG, JPG or WebP'}
                        </b>

                        <span className="mt-1 block text-xs text-ink-500">
                          Transparent PNG gives the cleanest result.
                        </span>
                      </span>

                      <input
                        className="hidden"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(
                          e
                        ) => {
                          const selectedFile =
                            e.target
                              .files?.[0];

                          if (
                            selectedFile
                          ) {
                            onUploadSignature(
                              selectedFile
                            );
                          }
                        }}
                      />
                    </label>
                  </div>
                )}

                {/* FILE BASED TOOLS */}
                {(
                  selected ===
                    'pdf' ||
                  selected ===
                    'place' ||
                  selected ===
                    'multipage' ||
                  selected ===
                    'image' ||
                  selected ===
                    'request' ||
                  selected ===
                    'order' ||
                  selected ===
                    'hash'
                ) && (
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="text-sm font-bold">
                        Input file
                      </label>

                      <label
                        className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-ink-200 bg-white p-5 transition hover:border-brand-300 hover:bg-brand-50/30"
                        onDragOver={(
                          e
                        ) =>
                          e.preventDefault()
                        }
                        onDrop={(
                          e
                        ) => {
                          e.preventDefault();

                          const dropped =
                            e
                              .dataTransfer
                              .files?.[0];

                          if (
                            !dropped
                          ) {
                            return;
                          }

                          const valid =
                            selected ===
                            'image'
                              ? dropped.type.startsWith(
                                  'image/'
                                )
                              : dropped.type ===
                                  'application/pdf' ||
                                /\.pdf$/i.test(
                                  dropped.name
                                );

                          if (
                            valid
                          ) {
                            setFile(
                              dropped
                            );
                            setError(
                              ''
                            );
                          } else {
                            setError(
                              selected ===
                                'image'
                                ? 'Drop a PNG, JPG or WebP image.'
                                : 'Drop a PDF document.'
                            );
                          }
                        }}
                      >
                        <Upload className="h-6 w-6 shrink-0 text-brand-600" />

                        <span className="min-w-0">
                          <b className="block truncate">
                            {file
                              ? file.name
                              : selected ===
                                'image'
                              ? 'Drop an image here or choose one'
                              : 'Drop a PDF here or choose one'}
                          </b>

                          <span className="mt-1 block text-xs text-ink-500">
                            You can drag and drop the document directly into this area.
                          </span>
                        </span>

                        <input
                          className="hidden"
                          type="file"
                          accept={
                            selected ===
                            'image'
                              ? 'image/png,image/jpeg,image/webp'
                              : '.pdf,application/pdf'
                          }
                          onChange={(
                            e
                          ) =>
                            setFile(
                              e.target
                                .files?.[0] ||
                                null
                            )
                          }
                        />
                      </label>
                    </div>

                    {(
                      selected ===
                        'pdf' ||
                      selected ===
                        'place' ||
                      selected ===
                        'multipage' ||
                      selected ===
                        'image'
                    ) && (
                      <>
                        <div>
                          <label className="text-sm font-bold">
                            Signature text
                          </label>

                          <input
                            className="input mt-1.5"
                            value={
                              signatureText
                            }
                            onChange={(
                              e
                            ) =>
                              setSignatureText(
                                e.target
                                  .value
                              )
                            }
                            placeholder="Type signer name"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-bold">
                            Style
                          </label>

                          <select
                            className="input mt-1.5"
                            value={font}
                            onChange={(
                              e
                            ) =>
                              setFont(
                                e.target
                                  .value
                              )
                            }
                          >
                            {fonts.map(
                              (
                                f
                              ) => (
                                <option
                                  key={
                                    f.value
                                  }
                                  value={
                                    f.value
                                  }
                                >
                                  {
                                    f.label
                                  }
                                </option>
                              )
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="text-sm font-bold">
                            Page
                          </label>

                          <input
                            className="input mt-1.5"
                            type="number"
                            min={1}
                            max={
                              pageCount
                            }
                            value={
                              page
                            }
                            onChange={(
                              e
                            ) =>
                              setPage(
                                Math.max(
                                  1,
                                  Math.min(
                                    pageCount,
                                    Number(
                                      e
                                        .target
                                        .value
                                    ) ||
                                      1
                                  )
                                )
                              )
                            }
                            disabled={
                              selected ===
                              'multipage'
                            }
                          />
                        </div>

                        <div>
                          <label className="text-sm font-bold">
                            Width ·{' '}
                            {Math.round(
                              width
                            )}
                            %
                          </label>

                          <input
                            className="mt-3 w-full"
                            type="range"
                            min={8}
                            max={60}
                            value={
                              width
                            }
                            onChange={(
                              e
                            ) =>
                              setWidth(
                                Number(
                                  e
                                    .target
                                    .value
                                )
                              )
                            }
                          />
                        </div>

                        <div>
                          <label className="text-sm font-bold">
                            X position ·{' '}
                            {Math.round(
                              x
                            )}
                            %
                          </label>

                          <input
                            className="mt-3 w-full"
                            type="range"
                            min={0}
                            max={95}
                            value={x}
                            onChange={(
                              e
                            ) =>
                              setX(
                                Number(
                                  e
                                    .target
                                    .value
                                )
                              )
                            }
                          />
                        </div>

                        <div>
                          <label className="text-sm font-bold">
                            Y position ·{' '}
                            {Math.round(
                              y
                            )}
                            %
                          </label>

                          <input
                            className="mt-3 w-full"
                            type="range"
                            min={0}
                            max={95}
                            value={y}
                            onChange={(
                              e
                            ) =>
                              setY(
                                Number(
                                  e
                                    .target
                                    .value
                                )
                              )
                            }
                          />
                        </div>
                      </>
                    )}

                    {(
                      selected ===
                        'request' ||
                      selected ===
                        'order'
                    ) && (
                      <>
                        <div className="md:col-span-2">
                          <label className="text-sm font-bold">
                            Signer email addresses
                          </label>

                          <input
                            className="input mt-1.5"
                            value={
                              signerEmails
                            }
                            onChange={(
                              e
                            ) =>
                              setSignerEmails(
                                e.target
                                  .value
                              )
                            }
                            placeholder="alice@example.com, bob@example.com"
                          />

                          <p className="mt-1 text-xs text-ink-400">
                            Separate multiple email addresses with commas.
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-bold">
                            Signer order
                          </label>

                          <select
                            className="input mt-1.5"
                            value={
                              signingOrder
                            }
                            onChange={(
                              e
                            ) =>
                              setSigningOrder(
                                e.target
                                  .value as
                                  | 'parallel'
                                  | 'sequential'
                              )
                            }
                          >
                            <option value="sequential">
                              Sequential
                            </option>

                            <option value="parallel">
                              Parallel
                            </option>
                          </select>
                        </div>
                      </>
                    )}

                    {selected ===
                      'hash' && (
                      <div className="md:col-span-2 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">
                        The SHA-256 result is calculated from the exact uploaded bytes — not from the filename or metadata.
                      </div>
                    )}
                  </div>
                )}

                {/* LIVE PLACEMENT */}
                {(
                  selected ===
                    'pdf' ||
                  selected ===
                    'place' ||
                  selected ===
                    'multipage' ||
                  selected ===
                    'image'
                ) && (
                  <LiveSignaturePlacement
                    file={file}
                    signature={
                      signatureImage
                    }
                    page={page}
                    pageCount={
                      pageCount
                    }
                    x={x}
                    y={y}
                    width={width}
                    onPosition={(
                      nx,
                      ny
                    ) => {
                      setX(nx);
                      setY(ny);
                    }}
                    onWidth={
                      setWidth
                    }
                    onPage={
                      setPage
                    }
                  />
                )}

                {/* SIGNER ORDER */}
                {selected ===
                  'order' && (
                  <div className="mt-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSigningOrder(
                            'sequential'
                          )
                        }
                        className={`rounded-2xl border p-5 text-left ${
                          signingOrder ===
                          'sequential'
                            ? 'border-brand-400 bg-brand-50'
                            : 'border-ink-200'
                        }`}
                      >
                        <b>
                          Sequential
                        </b>

                        <p className="mt-1 text-xs text-ink-500">
                          Signer 2 is blocked until signer 1 is actually recorded as signed by the database.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setSigningOrder(
                            'parallel'
                          )
                        }
                        className={`rounded-2xl border p-5 text-left ${
                          signingOrder ===
                          'parallel'
                            ? 'border-brand-400 bg-brand-50'
                            : 'border-ink-200'
                        }`}
                      >
                        <b>
                          Parallel
                        </b>

                        <p className="mt-1 text-xs text-ink-500">
                          All signers can sign independently. Each action is recorded in the audit trail.
                        </p>
                      </button>
                    </div>

                    <div className="mt-4 rounded-2xl bg-ink-50 p-4 text-sm text-ink-600">
                      For a real signing request, enter the signer email addresses in{' '}
                      <b>
                        Request Signatures
                      </b>
                      . This tool only selects the workflow; the database enforces the order.
                    </div>
                  </div>
                )}

                {/* TEMPLATES */}
                {selected ===
                  'template' && (
                  <div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {SIGNATURE_TEMPLATES.map(
                        (
                          template
                        ) => (
                          <button
                            key={
                              template.id
                            }
                            type="button"
                            onClick={() =>
                              applyTemplate(
                                template.id
                              )
                            }
                            className={`rounded-2xl border p-5 text-left transition ${
                              templateId ===
                              template.id
                                ? 'border-brand-400 bg-brand-50 shadow-soft'
                                : 'border-ink-200 bg-white hover:border-brand-200 hover:bg-brand-50/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <b>
                                {
                                  template.name
                                }
                              </b>

                              {templateId ===
                                template.id && (
                                <CheckCircle2 className="h-5 w-5 text-brand-600" />
                              )}
                            </div>

                            <p className="mt-1 text-xs leading-5 text-ink-500">
                              {
                                template.description
                              }
                            </p>
                          </button>
                        )
                      )}
                    </div>

                    <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-5">
                      <p className="text-sm font-extrabold text-ink-900">
                        1. Select a template · 2. Enter signer details · 3. Run a signing tool
                      </p>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="text-sm font-bold">
                          Signer full name

                          <input
                            className="input mt-1.5"
                            value={
                              name
                            }
                            onChange={(
                              e
                            ) =>
                              setName(
                                e.target
                                  .value
                              )
                            }
                            placeholder="Legal/full name"
                          />
                        </label>

                        <label className="text-sm font-bold">
                          Initials

                          <input
                            className="input mt-1.5"
                            value={
                              initials
                            }
                            onChange={(
                              e
                            ) =>
                              setInitials(
                                e.target
                                  .value
                                  .toUpperCase()
                              )
                            }
                            maxLength={6}
                            placeholder="AB"
                          />
                        </label>

                        <label className="text-sm font-bold">
                          Signature text

                          <input
                            className="input mt-1.5"
                            value={
                              signatureText
                            }
                            onChange={(
                              e
                            ) =>
                              setSignatureText(
                                e.target
                                  .value
                              )
                            }
                            placeholder="Text shown in the signature"
                          />
                        </label>

                        <label className="text-sm font-bold">
                          Signing order

                          <select
                            className="input mt-1.5"
                            value={
                              signingOrder
                            }
                            onChange={(
                              e
                            ) =>
                              setSigningOrder(
                                e.target
                                  .value as
                                  | 'sequential'
                                  | 'parallel'
                              )
                            }
                          >
                            <option value="sequential">
                              Sequential
                            </option>

                            <option value="parallel">
                              Parallel
                            </option>
                          </select>
                        </label>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={
                            saveTemplate
                          }
                        >
                          Save this setup
                        </button>

                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={
                            loadCustomTemplate
                          }
                        >
                          Load custom setup
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* VERIFY */}
                {selected ===
                  'verify' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="rounded-2xl border border-ink-200 p-5 text-sm font-bold">
                      Signed file

                      <input
                        className="mt-3 block w-full text-sm"
                        type="file"
                        onChange={(
                          e
                        ) =>
                          setVerifyFile(
                            e.target
                              .files?.[0] ||
                              null
                          )
                        }
                      />
                    </label>

                    <label className="rounded-2xl border border-ink-200 p-5 text-sm font-bold">
                      Proof (.qsign.json)

                      <input
                        className="mt-3 block w-full text-sm"
                        type="file"
                        accept="application/json,.json"
                        onChange={(
                          e
                        ) =>
                          setVerifyProofFile(
                            e.target
                              .files?.[0] ||
                              null
                          )
                        }
                      />
                    </label>
                  </div>
                )}

                {/* AUDIT */}
                {selected ===
                  'audit' && (
                  <div className="grid gap-4">
                    <input
                      className="input"
                      value={
                        requestId
                      }
                      onChange={(
                        e
                      ) =>
                        setRequestId(
                          e.target
                            .value
                        )
                      }
                      placeholder="Signing request UUID"
                    />

                    {audit.length >
                      0 && (
                      <div className="space-y-2">
                        {audit.map(
                          (
                            event
                          ) => (
                            <div
                              key={
                                event.id
                              }
                              className="rounded-xl bg-ink-50 p-3 text-sm"
                            >
                              <b>
                                {
                                  event.event_type
                                }
                              </b>

                              <span className="ml-2 text-xs text-ink-400">
                                {new Date(
                                  event.created_at
                                ).toLocaleString()}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* DOWNLOAD */}
                {selected ===
                  'download' && (
                  <div className="rounded-2xl bg-ink-50 p-6">
                    <p className="text-sm text-ink-600">
                      Use this tool after signing to download or share the latest artifact and proof.
                    </p>
                  </div>
                )}

                {/* STATUS */}
                {status && (
                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {status}
                      </span>
                    </div>
                  </div>
                )}

                {/* ERROR */}
                {error && (
                  <div className="mt-5 rounded-2xl border border-err-100 bg-err-50 p-4 text-sm text-err-700">
                    <div className="flex items-start gap-2">
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />

                      <span>
                        {error}
                      </span>
                    </div>
                  </div>
                )}

                {/* RUN */}
                <button
                  type="button"
                  onClick={
                    run
                  }
                  disabled={
                    busy
                  }
                  className="btn-primary mt-6 w-full py-3.5"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing securely…
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="h-4 w-4" />

                      {selected ===
                      'request'
                        ? 'Create signing request'
                        : selected ===
                          'order'
                        ? 'Create ordered signing workflow'
                        : selected ===
                          'audit'
                        ? 'Load audit trail'
                        : [
                            'pdf',
                            'place',
                            'multipage',
                            'image',
                          ].includes(
                            selected
                          )
                        ? 'Save & Download Signed File'
                        : selected ===
                          'template'
                        ? 'Generate reusable template'
                        : 'Run tool · 1 credit'}
                    </>
                  )}
                </button>

                {signatureNeedsFile &&
                  selected !==
                    'audit' && (
                    <p className="mt-3 text-center text-xs text-ink-400">
                      One successful run reserves one daily conversion credit.
                      Failed runs automatically refund the reserved credit.
                    </p>
                  )}
              </div>
            </div>

            {/* REQUEST LINKS */}
            {requestLinks.length >
              0 && (
              <div className="card p-6">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-brand-600" />

                  <h3 className="font-display text-lg font-extrabold">
                    Signer links
                  </h3>
                </div>

                <p className="mt-1 text-sm text-ink-500">
                  Send the correct link to each signer. Links expire after 7 days.
                </p>

                <div className="mt-4 space-y-3">
                  {requestLinks.map(
                    (
                      link,
                      index
                    ) => (
                      <div
                        key={
                          link
                        }
                        className="flex flex-col gap-2 rounded-2xl bg-ink-50 p-3 sm:flex-row sm:items-center"
                      >
                        <span className="text-xs font-bold text-ink-500">
                          Signer{' '}
                          {index +
                            1}
                        </span>

                        <code className="min-w-0 flex-1 break-all text-xs text-ink-700">
                          {
                            link
                          }
                        </code>

                        <button
                          type="button"
                          className="btn-secondary shrink-0"
                          onClick={() =>
                            navigator.clipboard.writeText(
                              link
                            )
                          }
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* VERIFY RESULT */}
            {verifyResult && (
              <div
                className={`card p-6 ${
                  verifyResult.valid
                    ? 'ring-2 ring-emerald-200'
                    : 'ring-2 ring-err-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {verifyResult.valid ? (
                    <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                  ) : (
                    <XCircle className="h-7 w-7 text-err-500" />
                  )}

                  <div>
                    <h3 className="font-display font-extrabold">
                      {verifyResult.valid
                        ? 'Signature verified'
                        : 'Verification failed'}
                    </h3>

                    <p className="mt-1 text-sm text-ink-500">
                      {
                        verifyResult.reason
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* HASH RESULT */}
            {hashResult && (
              <div className="card p-6">
                <div className="flex items-center gap-2">
                  <Hash className="h-5 w-5 text-brand-600" />

                  <h3 className="font-display font-extrabold">
                    SHA-256 fingerprint
                  </h3>
                </div>

                <code className="mt-4 block break-all rounded-2xl bg-ink-950 p-4 text-xs leading-6 text-white">
                  {
                    hashResult
                  }
                </code>
              </div>
            )}

            {/* SIGNED OUTPUT */}
            {signedBytes && (
              <div className="card overflow-hidden p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 font-display font-extrabold text-emerald-900">
                      <CheckCircle2 className="h-5 w-5" />
                      Signed output ready
                    </div>

                    <div className="mt-1 text-xs text-ink-500">
                      Document hash:{' '}
                      {
                        proof?.documentHash
                      }
                    </div>
                  </div>

                  <span className="chip">
                    {
                      proof
                        ?.metadata
                        ?.pkiStatus ||
                      'Cryptographic proof'
                    }
                  </span>
                </div>

                {signedType ===
                  'application/pdf' && (
                  <iframe
                    title="Signed PDF preview"
                    className="mt-4 h-[520px] w-full rounded-2xl bg-white ring-1 ring-ink-200"
                    src={
                      signedPreviewUrl
                    }
                  />
                )}

                {signedType.startsWith(
                  'image/'
                ) && (
                  <img
                    alt="Signed output"
                    className="mt-4 max-h-[520px] w-full rounded-2xl bg-ink-50 object-contain"
                    src={
                      signedPreviewUrl
                    }
                  />
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={
                      downloadSigned
                    }
                    className="btn-primary"
                  >
                    <Download className="h-4 w-4" />
                    Download signed
                  </button>

                  {proof && (
                    <button
                      type="button"
                      onClick={
                        downloadProof
                      }
                      className="btn-secondary"
                    >
                      <KeyRound className="h-4 w-4" />
                      Download proof
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={
                      share
                    }
                    className="btn-secondary"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        'verify'
                      )
                    }
                    className="btn-ghost"
                  >
                    <Eye className="h-4 w-4" />
                    Verify
                  </button>
                </div>
              </div>
            )}

            {/* TRUST FEATURES */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card p-5">
                <Hash className="h-5 w-5 text-brand-600" />

                <h3 className="mt-3 font-bold">
                  Hash the final bytes
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  Any post-signing change produces a different SHA-256 fingerprint.
                </p>
              </div>

              <div className="card p-5">
                <KeyRound className="h-5 w-5 text-brand-600" />

                <h3 className="mt-3 font-bold">
                  Cryptographic proof
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  Browser proofs use ECDSA P-256. The server can add an X.509-backed PAdES signature.
                </p>
              </div>

              <div className="card p-5">
                <ShieldCheck className="h-5 w-5 text-brand-600" />

                <h3 className="mt-3 font-bold">
                  Verification-ready
                </h3>

                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  Adobe Acrobat can validate a properly configured PAdES certificate chain and timestamp.
                </p>
              </div>
            </div>

            {/* TRUST BOUNDARY */}
            <div className="rounded-3xl bg-ink-950 p-6 text-white">
              <div className="flex items-center gap-2 font-bold">
                <ShieldCheck className="h-5 w-5" />
                Important trust boundary
              </div>

              <p className="mt-2 text-sm leading-relaxed text-white/65">
                A self-generated certificate is cryptographically valid
                but is not automatically trusted by Adobe. For production
                trust, configure QuadraConverter with your organisation's
                CA-issued signing certificate/private key and a trusted
                RFC 3161 timestamp authority. The included signing API
                supports that deployment model.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}