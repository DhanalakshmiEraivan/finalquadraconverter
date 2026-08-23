import { PDFDocument } from 'pdf-lib';

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < arr.length; i += chunk) {
    s += String.fromCharCode(...arr.subarray(i, i + chunk));
  }
  return btoa(s);
}
function fromB64(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

let signingKeyPair: CryptoKeyPair | null = null;

async function getKeyPair() {
  if (signingKeyPair) return signingKeyPair;
  signingKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  return signingKeyPair;
}

export async function createIntegrityProof(bytes: Uint8Array, metadata: Record<string, unknown> = {}) {
  const hash = await sha256Hex(bytes);
  const pair = await getKeyPair();
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    pair.privateKey,
    new TextEncoder().encode(hash),
  );
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return {
    version: '1.0',
    algorithm: 'ECDSA-P256-SHA256',
    hashAlgorithm: 'SHA-256',
    documentHash: hash,
    signature: b64(signature),
    publicKeyJwk: publicKey,
    signedAt: new Date().toISOString(),
    metadata,
    trust: 'Browser-generated integrity proof. This is not an accredited CA-issued PKI/DSC certificate.',
  };
}

export async function verifyIntegrityProof(bytes: Uint8Array, proof: any) {
  if (!proof?.documentHash || !proof?.signature || !proof?.publicKeyJwk) {
    return { valid: false, reason: 'Invalid or incomplete proof file.' };
  }
  const hash = await sha256Hex(bytes);
  if (hash !== proof.documentHash) {
    return { valid: false, reason: 'Document hash mismatch. The document has changed since the proof was created.', hash };
  }
  const key = await crypto.subtle.importKey(
    'jwk',
    proof.publicKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    fromB64(proof.signature),
    new TextEncoder().encode(proof.documentHash),
  );
  return { valid: ok, reason: ok ? 'Hash and cryptographic signature match.' : 'Cryptographic signature verification failed.', hash };
}



const SIGNED_ARTIFACT_DB = 'quadra-signature-artifacts';
const SIGNED_ARTIFACT_STORE = 'latest';

function openSignedArtifactDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SIGNED_ARTIFACT_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SIGNED_ARTIFACT_STORE)) {
        db.createObjectStore(SIGNED_ARTIFACT_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local signature storage.'));
  });
}

export async function saveSignedArtifact(
  bytes: Uint8Array,
  mimeType: string,
  filename: string,
  proof: unknown,
) {
  const db = await openSignedArtifactDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SIGNED_ARTIFACT_STORE, 'readwrite');
    tx.objectStore(SIGNED_ARTIFACT_STORE).put({
      bytes: new Uint8Array(bytes),
      mimeType,
      filename,
      proof,
      savedAt: new Date().toISOString(),
    }, 'latest');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Could not save signed artifact.'));
  });
  db.close();
}

export async function loadSignedArtifact(): Promise<{
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
  proof: any;
  savedAt: string;
} | null> {
  try {
    const db = await openSignedArtifactDb();
    const value = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(SIGNED_ARTIFACT_STORE, 'readonly');
      const request = tx.objectStore(SIGNED_ARTIFACT_STORE).get('latest');
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    if (!value?.bytes) return null;
    return {
      bytes: value.bytes instanceof Uint8Array ? value.bytes : new Uint8Array(value.bytes),
      mimeType: value.mimeType || 'application/pdf',
      filename: value.filename || 'signed-document.pdf',
      proof: value.proof || null,
      savedAt: value.savedAt || '',
    };
  } catch {
    return null;
  }
}

export function dataUrlToBytes(dataUrl: string) {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Invalid signature image data.');
  const base64 = dataUrl.slice(comma + 1);
  if (!base64) throw new Error('Signature image is empty.');
  return fromB64(base64);
}

export async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function createSignatureDataUrl(
  mode: 'typed' | 'initials' | 'drawn',
  value: string,
  font = 'cursive',
) {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 300;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#040720';
  ctx.strokeStyle = '#040720';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  if (mode === 'drawn') {
    throw new Error('Drawn signatures must be captured from the signature canvas.');
  }
  const size = mode === 'initials' ? 118 : 92;
  ctx.font = `${mode === 'initials' ? '700 ' : ''}${size}px ${font}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(value || (mode === 'initials' ? 'AB' : 'Signature'), 40, 150);
  return canvas.toDataURL('image/png');
}

export async function addSignatureToPdf(
  source: ArrayBuffer,
  signatureDataUrl: string,
  pageNumber: number,
  xPercent: number,
  yPercent: number,
  widthPercent: number,
) {
  const pdf = await PDFDocument.load(source);
  const pages = pdf.getPages();
  const index = Math.max(0, Math.min(pages.length - 1, pageNumber - 1));
  const page = pages[index];
  const png = await pdf.embedPng(dataUrlToBytes(signatureDataUrl));
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  const width = Math.max(40, pageWidth * (widthPercent / 100));
  const height = width * (png.height / png.width);
  const x = Math.max(0, Math.min(pageWidth - width, pageWidth * (xPercent / 100)));
  const y = Math.max(0, Math.min(pageHeight - height, pageHeight * (1 - yPercent / 100) - height));
  page.drawImage(png, { x, y, width, height });
  pdf.setProducer('QuadraConverter Signature Engine');
  pdf.setCreator('QuadraConverter');
  pdf.setSubject(`E-signature placement • ${new Date().toISOString()}`);
  return new Uint8Array(await pdf.save());
}

export async function signImage(
  file: File,
  signatureDataUrl: string,
  xPercent: number,
  yPercent: number,
  widthPercent: number,
) {
  const src = await fileToDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const sig = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = signatureDataUrl;
  });
  const width = Math.max(60, canvas.width * widthPercent / 100);
  const height = width * sig.naturalHeight / sig.naturalWidth;
  const x = Math.max(0, Math.min(canvas.width - width, canvas.width * xPercent / 100));
  const y = Math.max(0, Math.min(canvas.height - height, canvas.height * yPercent / 100));
  ctx.drawImage(sig, x, y, width, height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Could not create signed image.')), 'image/png'),
  );
}

export async function addSignatureToPdfPages(
  source: ArrayBuffer,
  signatureDataUrl: string,
  pagesToSign: number[],
  xPercent: number,
  yPercent: number,
  widthPercent: number,
) {
  const pdf = await PDFDocument.load(source);
  const png = await pdf.embedPng(dataUrlToBytes(signatureDataUrl));
  for (const pageNumber of pagesToSign) {
    const page = pdf.getPages()[Math.max(0, Math.min(pdf.getPages().length - 1, pageNumber - 1))];
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    const width = Math.max(40, pageWidth * (widthPercent / 100));
    const height = width * (png.height / png.width);
    const x = Math.max(0, Math.min(pageWidth - width, pageWidth * (xPercent / 100)));
    const y = Math.max(0, Math.min(pageHeight - height, pageHeight * (1 - yPercent / 100) - height));
    page.drawImage(png, { x, y, width, height });
  }
  pdf.setProducer('QuadraConverter Signature Engine');
  pdf.setCreator('QuadraConverter');
  pdf.setSubject(`Multi-page e-signature • ${new Date().toISOString()}`);
  return new Uint8Array(await pdf.save());
}
