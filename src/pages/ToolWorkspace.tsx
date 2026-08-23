import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';

import {
  ArrowLeft,
  Download,
  Sparkles,
  CheckCircle2,
  FileCheck2,
  RefreshCw,
  Star,
  Clock,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Settings2,
  Mail,
  Share2,
  Eye,
} from 'lucide-react';

import * as Icons from 'lucide-react';
import * as PdfJs from 'pdfjs-dist/build/pdf.mjs';

import type { Tool, ToolOption } from '@/data/tools';
import * as Converters from '@/lib/converters';
import * as PDFConverters from '@/lib/pdf-converters';
import {
  consumeConversion,
  refundConversion,
} from '@/lib/usage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

type Props = {
  tool: Tool;
  navigate: (path: string) => void;
};

type Stage =
  | 'idle'
  | 'working'
  | 'done'
  | 'error';

type ConversionOutput =
  | Converters.ConvertResult
  | Converters.ConvertResult[];

/*
 * Some PDF functions in the old ToolWorkspace were referenced
 * even though they are not exported by the current pdf-converters.ts.
 *
 * Using this adapter prevents TypeScript from generating hundreds
 * of cascading errors. If a particular engine is not implemented
 * in pdf-converters.ts, the user receives a clear runtime message.
 */
type ConverterFunction = (
  ...args: any[]
) => ConversionOutput | Promise<ConversionOutput>;

const converterFunctions =
  Converters as unknown as Record<
    string,
    ConverterFunction
  >;

const pdfConverterFunctions =
  PDFConverters as unknown as Record<
    string,
    ConverterFunction
  >;

async function callConverter(
  name: string,
  ...args: any[]
): Promise<ConversionOutput> {
  const fn = converterFunctions[name];

  if (typeof fn !== 'function') {
    throw new Error(
      `Converter "${name}" is not registered in src/lib/converters.ts.`
    );
  }

  return await fn(...args);
}

async function callPDFConverter(
  name: string,
  ...args: any[]
): Promise<ConversionOutput> {
  const fn = pdfConverterFunctions[name];

  if (typeof fn !== 'function') {
    throw new Error(
      `PDF converter "${name}" is not registered in src/lib/pdf-converters.ts.`
    );
  }

  return await fn(...args);
}

export function ToolWorkspace({
  tool,
  navigate,
}: Props) {
  const { user } = useAuth();

  const [stage, setStage] =
    useState<Stage>('idle');

  const [error, setError] =
    useState<string | null>(null);

  const [results, setResults] =
    useState<Converters.ConvertResult[]>([]);

  const [storedFiles, setStoredFiles] =
    useState<File[]>([]);

  const [options, setOptions] =
    useState<
      Record<
        string,
        string | number | boolean
      >
    >(() => {
      const defaults: Record<
        string,
        string | number | boolean
      > = {};

      tool.options?.forEach((option) => {
        defaults[option.key] =
          option.default;
      });

      return defaults;
    });

  const [userRequirement, setUserRequirement] =
    useState('');

  const [requirementMessage, setRequirementMessage] =
    useState('');

  const [progress, setProgress] =
    useState(0);

  const [previewResult, setPreviewResult] =
    useState<Converters.ConvertResult | null>(
      null
    );

  const [emailResult, setEmailResult] =
    useState<Converters.ConvertResult | null>(
      null
    );

  const [emailAddress, setEmailAddress] =
    useState('');

  const [emailStatus, setEmailStatus] =
    useState<string | null>(null);

  const [emailSending, setEmailSending] =
    useState(false);

  const [dragOver, setDragOver] =
    useState(false);

  const inputRef =
    useRef<HTMLInputElement>(null);

  /*
   * ---------------------------------------------------------
   * RESET OPTIONS WHEN TOOL CHANGES
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const defaults: Record<
      string,
      string | number | boolean
    > = {};

    tool.options?.forEach((option) => {
      defaults[option.key] =
        option.default;
    });

    setOptions(defaults);
    setStage('idle');
    setError(null);
    setResults([]);
    setStoredFiles([]);
    setProgress(0);
    setPreviewResult(null);
    setEmailResult(null);
    setEmailStatus(null);
    setEmailAddress('');
    setUserRequirement('');
    setRequirementMessage('');
  }, [tool]);

  /*
   * ---------------------------------------------------------
   * SMOOTH PROGRESS
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (stage !== 'working') {
      return;
    }

    const timer =
      window.setInterval(() => {
        setProgress((value) => {
          if (value >= 92) {
            return value;
          }

          const step =
            value < 35
              ? 4
              : value < 70
                ? 2
                : 0.8;

          return Math.min(
            92,
            value + step
          );
        });
      }, 180);

    return () =>
      window.clearInterval(timer);
  }, [stage]);

  /*
   * ---------------------------------------------------------
   * ICON
   * ---------------------------------------------------------
   */

  const getIcon = (name: string) => {
    const Icon =
      (
        Icons as unknown as Record<
          string,
          ComponentType<{
            className?: string;
          }>
        >
      )[name];

    return Icon ? (
      <Icon className="h-5 w-5" />
    ) : (
      <Icons.FileText className="h-5 w-5" />
    );
  };

  /*
   * ---------------------------------------------------------
   * OPTION HELPERS
   * ---------------------------------------------------------
   */

  const updateOption = (
    key: string,
    value:
      | string
      | number
      | boolean
  ) => {
    setOptions((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  /*
   * ---------------------------------------------------------
   * EXECUTE CONVERSION
   * ---------------------------------------------------------
   */

  const executeConversion = async (
    files: File[],
    opts: Record<
      string,
      string | number | boolean
    >
  ): Promise<ConversionOutput> => {
    const first = files[0];

    const text = (
      key = 'text'
    ): string =>
      String(opts[key] ?? '').trim();

    const num = (
      key: string,
      fallback = 0
    ): number => {
      const value = Number(
        opts[key]
      );

      return Number.isFinite(value)
        ? value
        : fallback;
    };

    const bool = (
      key: string,
      fallback = false
    ): boolean =>
      typeof opts[key] === 'boolean'
        ? Boolean(opts[key])
        : fallback;

    if (
      tool.inputType === 'file' ||
      tool.inputType === 'multi-file' ||
      tool.inputType === 'file-options'
    ) {
      if (!first && files.length === 0) {
        throw new Error(
          'Please upload a file first.'
        );
      }
    }

    switch (tool.engine) {
      /*
       * ======================================================
       * IMAGE TOOLS
       * ======================================================
       */

      case 'imageToImage':
        return callConverter(
          'imageToImage',
          first,
          text('targetFormat')
        );

      case 'imageToSVG':
        return callConverter('imageToSVG', first);

      case 'imageToPDF':
        return callConverter('imageToPDF', first);

      case 'imageCompress':
        return callConverter(
          'imageCompress',
          first,
          {
            mode: text('mode') as
              | 'target-size'
              | 'quality'
              | 'balanced',

            targetSize: num(
              'targetSize',
              200
            ),

            targetUnit: text(
              'targetUnit'
            ) as 'KB' | 'MB',

            quality: num(
              'quality',
              85
            ),

            format: text(
              'format'
            ) as
              | 'auto'
              | 'jpg'
              | 'webp'
              | 'png',

            preserveDimensions:
              bool(
                'preserveDimensions',
                true
              ),
          }
        );

      case 'imageResize':
        return callConverter(
          'imageResize',
          first,
          {
            mode: text(
              'mode'
            ) as
              | 'dimensions'
              | 'percentage'
              | 'long-edge',

            width: num(
              'width',
              1080
            ),

            height: num(
              'height',
              1080
            ),

            percentage: num(
              'percentage',
              50
            ),

            longEdge: num(
              'longEdge',
              1200
            ),

            fitMode: text(
              'fitMode'
            ) as
              | 'fit'
              | 'fill'
              | 'stretch',

            preserveAspectRatio:
              bool(
                'preserveAspectRatio',
                true
              ),
          }
        );

      case 'imageRotate':
        return callConverter(
          'imageRotate',
          first,
          {
            degrees: num(
              'degrees',
              90
            ),

            direction: text(
              'direction'
            ) as
              | 'clockwise'
              | 'counterclockwise',

            expand: bool(
              'expand',
              true
            ),
          }
        );

      case 'imageGrayscale':
        return callConverter(
          'imageGrayscale',
          first
        );

      case 'imageFlip':
        return callConverter(
          'imageFlip',
          first,
          text('axis') as
            | 'h'
            | 'v'
        );

      case 'imageToBase64':
        return callConverter(
          'imageToBase64',
          first
        );

      case 'imageCropToSquare':
        return callConverter(
          'imageCropToSquare',
          first,
          {
            position: text(
              'position'
            ) as
              | 'center'
              | 'top'
              | 'bottom'
              | 'left'
              | 'right',

            size: num(
              'size',
              1080
            ),
          }
        );

      /*
       * ======================================================
       * PDF TOOLS
       * ======================================================
       */

      /*
       * IMPORTANT:
       *
       * Your old code used:
       *
       * Converters.pdfToImages(...)
       *
       * That function does not exist.
       *
       * The working implementation is:
       *
       * PDFConverters.pdfToJPG(...)
       *
       * This fixes:
       *
       * "No converter is registered for tool engine pdfToImages"
       */

      case 'pdfToImages':
        return callPDFConverter(
          'pdfToJPG',
          first,
          num('quality', 90),
          text('pageRange') || 'all'
        );

      case 'pdfToJPG':
        return callPDFConverter(
          'pdfToJPG',
          first,
          num('quality', 90),
          text('pageRange') || 'all'
        );

      case 'imagesToPDF':
        return callPDFConverter(
          'imagesToPDF',
          files
        );

      case 'mergePDFs':
        return callPDFConverter(
          'mergePDFs',
          files
        );

      case 'splitPDF':
        return callPDFConverter(
          'splitPDF',
          first,
          text('splitPoints')
        );

      case 'textToPDF':
        return callPDFConverter(
          'textToPDF',
          text('text'),
          `${tool.name
            .replace(/\s+/g, '-')
            .toLowerCase()}.pdf`
        );

      case 'htmlToPDF':
        return callPDFConverter(
          'htmlToPDF',
          text('text'),
          `${tool.name
            .replace(/\s+/g, '-')
            .toLowerCase()}.pdf`
        );

      case 'pdfRemovePages':
        return callPDFConverter(
          'removePages',
          first,
          text('pageRange')
        );

      case 'pdfExtractPages':
        return callPDFConverter(
          'extractPages',
          first,
          text('pageRange')
        );

      case 'pdfOrganize':
        return callPDFConverter(
          'organizePDF',
          first,
          text('pageOrder')
        );

      case 'pdfScanToPDF':
        return callPDFConverter(
          'scanToPDF',
          files
        );

      case 'pdfOptimize':
        return callPDFConverter(
          'optimizePDF',
          first
        );

      case 'pdfCompress':
        return callPDFConverter(
          'compressPDF',
          first,
          num('quality', 75)
        );

      case 'pdfRepair':
        return callPDFConverter(
          'repairPDF',
          first
        );

      case 'pdfOCR':
        return callPDFConverter(
          'ocrPDF',
          first,
          text('language') || 'eng'
        );

      case 'pdfConvertTo':
        return callPDFConverter(
          'convertToPDF',
          first
        );

      case 'pdfJpgToPDF':
        return callPDFConverter(
          'jpgToPDF',
          files
        );

      case 'pdfWordToPDF':
        return callPDFConverter(
          'wordToPDF',
          first
        );

      case 'pdfPptxToPDF':
        return callPDFConverter(
          'pptxToPDF',
          first
        );

      case 'pdfExcelToPDF':
        return callPDFConverter(
          'excelToPDF',
          first
        );

      case 'pdfHtmlFileToPDF':
        return callPDFConverter(
          'htmlToPDFFile',
          first
        );

      case 'pdfToWord':
        return callPDFConverter(
          'pdfToWord',
          first
        );

      case 'pdfToPPTX':
        return callPDFConverter(
          'pdfToPPTX',
          first
        );

      case 'pdfToExcel':
        return callPDFConverter(
          'pdfToExcel',
          first
        );

      case 'pdfToPDFA':
        return callPDFConverter(
          'pdfToPDFA',
          first
        );

      case 'pdfRotate':
        return callPDFConverter(
          'rotatePDF',
          first,
          num('degrees', 90)
        );

      case 'pdfAddPageNumbers':
        return callPDFConverter(
          'addPageNumbers',
          first,
          text('position') ||
            'bottom-center'
        );

      case 'pdfAddWatermark':
        return callPDFConverter(
          'addWatermark',
          first,
          text('text'),
          num('opacity', 0.25)
        );

      case 'pdfCrop':
        return callPDFConverter(
          'cropPDF',
          first,
          num('margin', 20)
        );

      case 'pdfFlatten':
        return callPDFConverter(
          'flattenPDF',
          first
        );

      case 'pdfUnlock':
        return callPDFConverter(
          'unlockPDF',
          first,
          text('password')
        );

      case 'pdfProtect':
        return callPDFConverter(
          'protectPDF',
          first,
          text('password')
        );

      case 'pdfSign':
        return callPDFConverter(
          'signPDF',
          first,
          text('name')
        );

      case 'pdfRedact':
        return callPDFConverter(
          'redactPDF',
          first,
          text('searchText')
        );

      case 'pdfCompare':
        if (files.length < 2) {
          throw new Error(
            'Please upload two PDF files to compare.'
          );
        }

        return callPDFConverter(
          'comparePDF',
          files[0],
          files[1]
        );

      case 'pdfSummarize':
        return callPDFConverter(
          'summarizePDF',
          first,
          num('ratio', 0.25)
        );

      case 'pdfTranslate':
        return callPDFConverter(
          'translatePDF',
          first,
          text('targetLang') || 'en'
        );

      case 'pdfToMarkdown':
        return callPDFConverter(
          'pdfToMarkdown',
          first
        );

      /*
       * ======================================================
       * TEXT / DEVELOPER TOOLS
       * ======================================================
       */

      case 'textCaseConvert':
        return callConverter(
          'textCaseConvert',
          text('text'),
          text('mode')
        );

      case 'textToBase64':
        return callConverter(
          'textToBase64',
          text('text')
        );

      case 'base64ToText':
        return callConverter(
          'base64ToText',
          text('text')
        );

      case 'textToBinary':
        return callConverter(
          'textToBinary',
          text('text')
        );

      case 'binaryToText':
        return callConverter(
          'binaryToText',
          text('text')
        );

      case 'textToHex':
        return callConverter(
          'textToHex',
          text('text')
        );

      case 'hexToText':
        return callConverter(
          'hexToText',
          text('text')
        );

      case 'textToMorse':
        return callConverter(
          'textToMorse',
          text('text')
        );

      case 'morseToText':
        return callConverter(
          'morseToText',
          text('text')
        );

      case 'textToLeet':
        return callConverter(
          'textToLeet',
          text('text')
        );

      case 'textRemoveDuplicates':
        return callConverter(
          'textRemoveDuplicates',
          text('text')
        );

      case 'textWordCount':
        return callConverter(
          'textWordCount',
          text('text')
        );

      case 'textFindReplace':
        return callConverter(
          'textFindReplace',
          text('text'),
          text('find'),
          text('replace')
        );

      case 'textSortLines':
        return callConverter(
          'textSortLines',
          text('text'),
          text('mode')
        );

      case 'textTrimLines':
        return callConverter(
          'textTrimLines',
          text('text')
        );

      case 'textAddLineNumbers':
        return callConverter(
          'textAddLineNumbers',
          text('text')
        );

      case 'textSlugify':
        return callConverter(
          'textSlugify',
          text('text')
        );

      case 'textLoremIpsum':
        return callConverter(
          'textLoremIpsum',
          num('paragraphs', 3)
        );

      case 'jsonBeautify':
        return callConverter(
          'jsonBeautify',
          text('json'),
          num('indent', 2)
        );

      case 'jsonMinify':
        return callConverter(
          'jsonMinify',
          text('json')
        );

      case 'jsonToCSV':
        return callConverter(
          'jsonToCSV',
          text('json')
        );

      case 'csvToJSON':
        return callConverter(
          'csvToJSON',
          text('text')
        );

      case 'jsonToYAML':
        return callConverter(
          'jsonToYAML',
          text('json')
        );

      case 'urlEncode':
        return callConverter(
          'urlEncode',
          text('text')
        );

      case 'urlDecode':
        return callConverter(
          'urlDecode',
          text('text')
        );

      case 'htmlEncode':
        return callConverter(
          'htmlEncode',
          text('text')
        );

      case 'htmlDecode':
        return callConverter(
          'htmlDecode',
          text('text')
        );

      case 'htmlToMarkdown':
        return callConverter(
          'htmlToMarkdown',
          text('text')
        );

      case 'markdownToHTML':
        return callConverter(
          'markdownToHTML',
          text('text')
        );

      case 'generateQRCode':
        return callConverter(
          'generateQRCode',
          text('text'),
          num('size', 512)
        );

      case 'generateQRCodeSVG':
        return callConverter(
          'generateQRCodeSVG',
          text('text')
        );

      case 'qrUrl':
      case 'qrEmail':
      case 'qrPhone':
      case 'qrSms':
      case 'qrWifi':
      case 'qrVcard':
      case 'qrLocation':
      case 'qrText':
      case 'qrEvent':
      case 'qrApp':
      case 'qrSocial':
        return callConverter(
          tool.engine as keyof typeof Converters,
          text('text'),
          num('size', 512)
        );

      case 'qrSvgPro':
        return callConverter('qrSvgPro', text('text'));

      case 'colorHexRgb':
      case 'colorRgbHex':
      case 'colorComplement':
      case 'colorInvert':
      case 'colorLighten':
      case 'colorDarken':
      case 'colorContrast':
      case 'colorPalette':
      case 'colorGradient':
      case 'colorCss':
      case 'colorAccessibility':
      case 'colorRandom':
        return callConverter(
          tool.engine as keyof typeof Converters,
          text('text')
        );

      case 'colorConverter':
        return callConverter(
          'colorConverter',
          text('text')
        );

      case 'calculatePercentage':
        return callConverter(
          'calculatePercentage',
          text('value'),
          text('total')
        );

      case 'calculateBMI':
        return callConverter(
          'calculateBMI',
          text('weight'),
          text('height')
        );

      case 'calculateAge':
        return callConverter(
          'calculateAge',
          text('birthDate')
        );

      case 'calculateLoan':
        return callConverter(
          'calculateLoan',
          text('principal'),
          text('rate'),
          text('years')
        );

      case 'calculateUnit':
        return callConverter(
          'calculateUnit',
          text('value'),
          text('from'),
          text('to'),
          text('type')
        );

      case 'calculateTimezones':
        return callConverter(
          'calculateTimezones',
          text('timezone')
        );

      case 'generateHash':
        return callConverter(
          'generateHash',
          text('text'),
          text('algorithm') ||
            'SHA-256'
        );

      case 'generateUUID':
        return callConverter(
          'generateUUID'
        );

      case 'generatePassword':
        return callConverter(
          'generatePassword',
          num('length', 16),
          {
            upper: bool(
              'upper',
              true
            ),
            lower: bool(
              'lower',
              true
            ),
            numbers: bool(
              'numbers',
              true
            ),
            symbols: bool(
              'symbols',
              true
            ),
          }
        );

      default:
        throw new Error(
          `No converter is registered for tool engine "${tool.engine}".`
        );
    }
  };

  /*
   * ---------------------------------------------------------
   * RUN CONVERSION
   * ---------------------------------------------------------
   */

  const runConversion = async (
    files?: File[]
  ) => {
    const useFiles =
      files && files.length > 0
        ? files
        : storedFiles;

    const requiresFile =
      tool.inputType === 'file' ||
      tool.inputType ===
        'multi-file' ||
      tool.inputType ===
        'file-options';

    if (
      requiresFile &&
      useFiles.length === 0
    ) {
      setError(
        'Please upload a file first.'
      );
      setStage('error');
      return;
    }

    if (stage === 'working') {
      return;
    }

    if (!user) {
      setError(
        'Please sign in before starting a conversion. Your free conversion credits are tied to your account.'
      );
      setStage('error');
      return;
    }

    let reservationId:
      | string
      | null = null;

    try {
      const reservation =
        await consumeConversion();

      if (!reservation.allowed) {
        setError(
          reservation.message ||
            'You have reached your daily free conversion limit. Please upgrade to continue.'
        );

        setStage('error');
        return;
      }

      reservationId =
        reservation.unlimited
          ? null
          : (
              reservation.reservation_id ??
              null
            );

      if (
        !reservation.unlimited &&
        !reservationId
      ) {
        throw new Error(
          'The conversion credit could not be reserved safely. Please try again.'
        );
      }
    } catch (usageError) {
      console.error(
        'Conversion credit reservation failed:',
        usageError
      );

      setError(
        usageError instanceof Error
          ? usageError.message
          : 'Unable to reserve a conversion credit.'
      );

      setStage('error');
      return;
    }

    const conversionStartedAt = performance.now();
    setStage('working');
    setError(null);
    setProgress(8);

    try {
      const opts =
        options as Record<
          string,
          string | number | boolean
        >;

      const output =
        await executeConversion(
          useFiles,
          opts
        );

      if (!output) {
        throw new Error(
          'The converter did not return a result.'
        );
      }

      const resultArr =
        Array.isArray(output)
          ? output
          : [output];

      const validResults =
        resultArr.filter(
          (
            result
          ): result is Converters.ConvertResult =>
            Boolean(
              result &&
                result.blob instanceof Blob &&
                result.blob.size > 0 &&
                result.filename
            )
        );

      if (
        validResults.length === 0
      ) {
        throw new Error(
          'The conversion completed but returned no usable output file.'
        );
      }

      setProgress(100);
      setResults(validResults);

      if (user) {
        const firstResult =
          validResults[0];

        const {
          error: insertError,
        } = await supabase
          .from('conversions')
          .insert({
            tool_id: tool.id,
            tool_name: tool.name,
            category: tool.category,
            input_name:
              useFiles.length > 0
                ? useFiles[0].name
                : 'text-input',
            output_name:
              firstResult.filename,
            output_format:
              tool.outputFormat,
            status: 'completed',
            file_size:
              firstResult.blob.size,
            conversion_ms: Math.round(performance.now() - conversionStartedAt),
          });

        if (insertError) {
          console.error(
            'Failed to save conversion history:',
            insertError
          );
        }
      }

      window.setTimeout(
        () => setStage('done'),
        150
      );
    } catch (err: unknown) {
      console.error(
        'Conversion error:',
        err
      );

      const message =
        err instanceof Error
          ? err.message
          : 'Conversion failed.';

      setError(message);
      setStage('error');

      if (reservationId) {
        try {
          await refundConversion(
            reservationId
          );
        } catch (refundError) {
          console.error(
            'Failed to refund conversion credit:',
            refundError
          );
        }
      }

      if (user) {
        const {
          error: insertError,
        } = await supabase
          .from('conversions')
          .insert({
            tool_id: tool.id,
            tool_name: tool.name,
            category: tool.category,
            input_name:
              useFiles.length > 0
                ? useFiles[0].name
                : 'text-input',
            output_name: '',
            output_format:
              tool.outputFormat,
            status: 'failed',
            file_size: null,
            conversion_ms: Math.round(performance.now() - conversionStartedAt),
          });

        if (insertError) {
          console.error(
            'Failed to save failed conversion history:',
            insertError
          );
        }
      }
    }
  };

  /*
   * ---------------------------------------------------------
   * FILE HANDLING
   * ---------------------------------------------------------
   */

  const handleFiles = (
    files: FileList | File[]
  ) => {
    const fileArr =
      Array.from(files);

    if (
      fileArr.length === 0
    ) {
      return;
    }

    setStoredFiles(fileArr);
    setResults([]);
    setError(null);
    setStage('idle');
    setProgress(0);

    /*
     * Normal file tools start automatically.
     *
     * file-options tools wait for the user
     * to choose settings and click Run.
     */
    if (
      tool.inputType === 'file' ||
      tool.inputType ===
        'multi-file'
    ) {
      void runConversion(
        fileArr
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * DOWNLOAD
   * ---------------------------------------------------------
   */

  const handleDownload = (
    result: Converters.ConvertResult
  ) => {
    const downloadFn =
      converterFunctions[
        'downloadBlob'
      ];

    if (
      typeof downloadFn !==
      'function'
    ) {
      const url =
        URL.createObjectURL(
          result.blob
        );

      const anchor =
        document.createElement(
          'a'
        );

      anchor.href = url;
      anchor.download =
        result.filename;

      document.body.appendChild(
        anchor
      );

      anchor.click();

      anchor.remove();

      URL.revokeObjectURL(url);

      return;
    }

    void downloadFn(
      result.blob,
      result.filename
    );
  };

  const handleDownloadAll =
    () => {
      results.forEach(
        (result, index) => {
          window.setTimeout(
            () => {
              handleDownload(
                result
              );
            },
            index * 200
          );
        }
      );
    };

  /*
   * ---------------------------------------------------------
   * PREVIEW
   * ---------------------------------------------------------
   */

  const handlePreview = (
    result: Converters.ConvertResult
  ) => {
    setPreviewResult(result);
  };

  /*
   * ---------------------------------------------------------
   * SHARE
   * ---------------------------------------------------------
   */

  const handleShare = async (
  result: Converters.ConvertResult,
  method: "email" | "whatsapp"
) => {
  if (method === "whatsapp") {
    const file = new File([result.blob], result.filename, {
      type: result.blob.type || "application/octet-stream",
      lastModified: Date.now(),
    });

    try {
      if (
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: "QuadraConverter Output",
          text: `Converted using ${tool.name}`,
          files: [file],
        });

        return;
      }

      // Desktop fallback
      const url = URL.createObjectURL(result.blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();

      URL.revokeObjectURL(url);

      alert(
        "WhatsApp Web cannot receive files directly from a browser. The converted file has been downloaded. Attach it in WhatsApp."
      );
    } catch (err) {
      console.error(err);
    }

    return;
  }

  // Email dialog
  setEmailResult(result);
  setEmailAddress("");
  setEmailStatus(null);
};
  /*
  /*
   * ---------------------------------------------------------
   * RESET
   * ---------------------------------------------------------
   */

  const reset = () => {
    setStage('idle');
    setResults([]);
    setError(null);
    setProgress(0);
    setStoredFiles([]);
    setPreviewResult(null);
    setEmailResult(null);
    setEmailAddress('');
    setEmailStatus(null);
    setUserRequirement('');
    setRequirementMessage('');
  };

  /*
   * ---------------------------------------------------------
   * ADVANCED IMAGE REQUIREMENTS
   * ---------------------------------------------------------
   */

  const isAdvancedImageTool = [
    'img-compress',
    'img-resize',
    'img-rotate',
    'img-crop-square',
  ].includes(tool.id);

  const understandRequirement =
    () => {
      const requirement =
        userRequirement
          .trim()
          .toLowerCase();

      if (!requirement) {
        setRequirementMessage(
          'Please describe what you want to do with the image.'
        );

        return;
      }

      setRequirementMessage('');

      /*
       * IMAGE COMPRESS
       */

      if (
        tool.id === 'img-compress'
      ) {
        const sizeMatch =
          requirement.match(
            /(\d+(?:\.\d+)?)\s*(kb|mb)/i
          );

        if (sizeMatch) {
          updateOption(
            'targetSize',
            Number(
              sizeMatch[1]
            )
          );

          updateOption(
            'targetUnit',
            sizeMatch[2].toUpperCase()
          );

          updateOption(
            'mode',
            'target-size'
          );
        }

        if (
          requirement.includes(
            'webp'
          )
        ) {
          updateOption(
            'format',
            'webp'
          );
        } else if (
          requirement.includes(
            'png'
          )
        ) {
          updateOption(
            'format',
            'png'
          );
        } else if (
          requirement.includes(
            'jpg'
          ) ||
          requirement.includes(
            'jpeg'
          )
        ) {
          updateOption(
            'format',
            'jpg'
          );
        }

        if (
          requirement.includes(
            'best quality'
          ) ||
          requirement.includes(
            'maximum quality'
          ) ||
          requirement.includes(
            'highest quality'
          )
        ) {
          updateOption(
            'quality',
            95
          );
        }

        setRequirementMessage(
          'Requirement understood. Please review the settings below.'
        );

        return;
      }

      /*
       * IMAGE RESIZE
       */

      if (
        tool.id === 'img-resize'
      ) {
        const dimensionMatch =
          requirement.match(
            /(\d+)\s*[x×]\s*(\d+)/i
          );

        const percentageMatch =
          requirement.match(
            /(\d+)\s*%/i
          );

        const longEdgeMatch =
          requirement.match(
            /(?:longest|long)\s*(?:edge|side).*?(\d+)\s*(?:px|pixel)?/i
          );

        if (
          dimensionMatch
        ) {
          updateOption(
            'mode',
            'dimensions'
          );

          updateOption(
            'width',
            Number(
              dimensionMatch[1]
            )
          );

          updateOption(
            'height',
            Number(
              dimensionMatch[2]
            )
          );
        } else if (
          percentageMatch
        ) {
          updateOption(
            'mode',
            'percentage'
          );

          updateOption(
            'percentage',
            Number(
              percentageMatch[1]
            )
          );
        } else if (
          longEdgeMatch
        ) {
          updateOption(
            'mode',
            'long-edge'
          );

          updateOption(
            'longEdge',
            Number(
              longEdgeMatch[1]
            )
          );
        }

        if (
          requirement.includes(
            'without cropping'
          ) ||
          requirement.includes(
            'no crop'
          ) ||
          requirement.includes(
            'preserve aspect'
          )
        ) {
          updateOption(
            'fitMode',
            'fit'
          );

          updateOption(
            'preserveAspectRatio',
            true
          );
        } else if (
          requirement.includes(
            'crop'
          ) ||
          requirement.includes(
            'fill'
          )
        ) {
          updateOption(
            'fitMode',
            'fill'
          );
        }

        setRequirementMessage(
          'Requirement understood. Please review the settings below.'
        );

        return;
      }

      /*
       * IMAGE ROTATE
       */

      if (
        tool.id === 'img-rotate'
      ) {
        const degreeMatch =
          requirement.match(
            /(\d+(?:\.\d+)?)\s*(?:degree|degrees|°)/i
          );

        if (degreeMatch) {
          updateOption(
            'degrees',
            Number(
              degreeMatch[1]
            )
          );
        }

        updateOption(
          'direction',
          requirement.includes(
            'counter'
          ) ||
            requirement.includes(
              'anticlockwise'
            ) ||
            requirement.includes(
              'anti-clockwise'
            ) ||
            requirement.includes(
              'left'
            )
            ? 'counterclockwise'
            : 'clockwise'
        );

        setRequirementMessage(
          'Requirement understood. Please review the settings below.'
        );

        return;
      }

      /*
       * IMAGE CROP
       */

      if (
        tool.id ===
        'img-crop-square'
      ) {
        if (
          requirement.includes(
            'top'
          )
        ) {
          updateOption(
            'position',
            'top'
          );
        } else if (
          requirement.includes(
            'bottom'
          )
        ) {
          updateOption(
            'position',
            'bottom'
          );
        } else if (
          requirement.includes(
            'left'
          )
        ) {
          updateOption(
            'position',
            'left'
          );
        } else if (
          requirement.includes(
            'right'
          )
        ) {
          updateOption(
            'position',
            'right'
          );
        } else {
          updateOption(
            'position',
            'center'
          );
        }

        const sizeMatch =
          requirement.match(
            /(\d+)\s*[x×]?\s*(?:px|pixel)/i
          );

        if (sizeMatch) {
          updateOption(
            'size',
            Number(
              sizeMatch[1]
            )
          );
        }

        setRequirementMessage(
          'Requirement understood. Please review the settings below.'
        );
      }
    };

  /*
   * ---------------------------------------------------------
   * INPUT TYPES
   * ---------------------------------------------------------
   */

  const needsFile =
    tool.inputType ===
      'file' ||
    tool.inputType ===
      'multi-file';

  const needsText =
    tool.inputType ===
    'text';

  const needsOptionsOnly =
    tool.inputType ===
    'none';

  const needsFileOptions =
    tool.inputType ===
    'file-options';

  /*
   * ---------------------------------------------------------
   * FILE DROP ZONE
   * ---------------------------------------------------------
   */

  const renderFileZone = (
    compact: boolean
  ) => {
    return (
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => {
          setDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);

          handleFiles(
            event.dataTransfer.files
          );
        }}
        onClick={() =>
          inputRef.current?.click()
        }
        className={`
          group relative cursor-pointer overflow-hidden rounded-2xl
          border-2 border-dashed transition-all duration-300
          ${
            compact
              ? 'p-8'
              : 'p-10 sm:p-14'
          }
          ${
            dragOver
              ? 'border-brand-500 bg-brand-50/60 scale-[1.01]'
              : 'border-ink-200 bg-white hover:border-brand-400 hover:bg-brand-50/30'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={
            tool.accept || '*'
          }
          multiple={
            tool.inputType ===
            'multi-file'
          }
          className="hidden"
          onChange={(event) => {
            if (
              event.target.files
            ) {
              handleFiles(
                event.target.files
              );
            }

            event.currentTarget.value =
              '';
          }}
        />

        <div className="text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <Download className="h-7 w-7" />
          </div>

          <p className="font-display text-lg font-bold text-ink-900">
            {storedFiles.length >
            0
              ? 'Files selected'
              : 'Drop your file here'}
          </p>

          <p className="mt-1 text-sm text-ink-500">
            {storedFiles.length >
            0
              ? `${storedFiles.length} file${
                  storedFiles.length >
                  1
                    ? 's'
                    : ''
                } selected`
              : 'or click to browse from your computer'}
          </p>

          <p className="mt-3 text-xs text-ink-400">
            {tool.accept ||
              'Any file type'}
          </p>
        </div>

        {storedFiles.length >
          0 && (
          <div className="mt-6 space-y-2">
            {storedFiles.map(
              (
                file,
                index
              ) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {file.name}
                    </p>

                    <p className="text-xs text-ink-500">
                      {(
                        file.size /
                        1024
                      ).toFixed(
                        1
                      )}{' '}
                      KB
                    </p>
                  </div>

                  <FileCheck2 className="h-5 w-5 shrink-0 text-brand-600" />
                </div>
              )
            )}
          </div>
        )}
      </div>
    );
  };

  /*
   * ---------------------------------------------------------
   * RENDER
   * ---------------------------------------------------------
   */

  return (
    <div className="container-page py-8">
      <button
        type="button"
        onClick={() =>
          navigate('/tools')
        }
        className="mb-6 flex items-center gap-2 text-sm font-semibold text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tools
      </button>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* TOOL HEADER */}

          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-ink-100 text-ink-800">
              {getIcon(tool.icon)}
            </div>

            <div>
              <h1 className="font-display text-2xl font-bold text-ink-900">
                {tool.name}
              </h1>

              <p className="mt-0.5 text-ink-500">
                {tool.description}
              </p>
            </div>
          </div>

          {/* MAIN CARD */}

          <div className="overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-card">
            {/* IDLE */}

            {stage === 'idle' && (
              <div className="p-6 sm:p-8">
                {/* FILE */}

                {needsFile &&
                  renderFileZone(
                    false
                  )}

                {/* FILE + OPTIONS */}

                {needsFileOptions && (
                  <>
                    {renderFileZone(
                      true
                    )}

                    {isAdvancedImageTool && (
                      <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/40 p-5">
                        <div className="mb-2 flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-brand-600" />

                          <p className="text-sm font-bold text-ink-900">
                            What do you want to achieve?
                          </p>
                        </div>

                        <p className="mb-3 text-xs text-ink-500">
                          Describe your requirement in your own words. QuadraConverter will fill the advanced settings for you.
                        </p>

                        <textarea
                          value={
                            userRequirement
                          }
                          onChange={(
                            event
                          ) =>
                            setUserRequirement(
                              event
                                .target
                                .value
                            )
                          }
                          placeholder={
                            tool.id ===
                            'img-compress'
                              ? 'Example: Compress this image below 200 KB while keeping the best possible quality.'
                              : tool.id ===
                                  'img-resize'
                                ? 'Example: Resize this image to 1080x1080 without cropping.'
                                : tool.id ===
                                    'img-rotate'
                                  ? 'Example: Rotate this image 25 degrees clockwise.'
                                  : 'Example: Crop this image to a 1080x1080 square from the top.'
                          }
                          rows={3}
                          className="w-full resize-none rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                        />

                        <button
                          type="button"
                          onClick={
                            understandRequirement
                          }
                          className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
                        >
                          <Sparkles className="h-4 w-4" />
                          Understand Requirement
                        </button>

                        {requirementMessage && (
                          <div className="mt-3 rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-700">
                            {
                              requirementMessage
                            }
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-5">
                      <p className="mb-3 text-sm font-semibold text-ink-700">
                        Options
                      </p>

                      {tool.options?.map(
                        (
                          option
                        ) => (
                          <OptionField
                            key={
                              option.key
                            }
                            opt={
                              option
                            }
                            value={
                              options[
                                option.key
                              ]
                            }
                            onChange={(
                              value
                            ) =>
                              updateOption(
                                option.key,
                                value
                              )
                            }
                          />
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        void runConversion()
                      }
                      disabled={
                        stage ==
                        'working'
                      }
                      className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      Run Conversion
                    </button>
                  </>
                )}

                {/* TEXT / OPTION-ONLY */}

                {(needsText ||
                  needsOptionsOnly) && (
                  <>
                    {tool.options?.map(
                      (
                        option
                      ) => (
                        <OptionField
                          key={
                            option.key
                          }
                          opt={
                            option
                          }
                          value={
                            options[
                              option.key
                            ]
                          }
                          onChange={(
                            value
                          ) =>
                            updateOption(
                              option.key,
                              value
                            )
                          }
                        />
                      )
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        void runConversion()
                      }
                      disabled={
                        stage ==
                        'working'
                      }
                      className="btn-primary mt-2 w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Sparkles className="h-4 w-4" />
                      {needsOptionsOnly
                        ? 'Run Tool'
                        : 'Run Conversion'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* WORKING */}

            {stage ===
              'working' && (
              <div className="relative overflow-hidden p-8 text-center sm:p-12">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-50/70 via-white to-accent-50/60" />

                <div className="relative mx-auto max-w-xl">
                  <div className="conversion-glow relative mx-auto grid h-36 w-36 place-items-center rounded-full bg-white shadow-float ring-1 ring-brand-100">
                    <div className="absolute inset-3 rounded-full border-2 border-brand-100" />

                    <div className="conversion-orbit absolute inset-3 rounded-full border-2 border-transparent border-r-accent-500 border-t-brand-600" />

                    <div className="grid h-20 w-20 place-items-center rounded-3xl bg-ink-950 text-white shadow-soft">
                      <Loader2 className="h-9 w-9 animate-spin" />
                    </div>
                  </div>

                  <p className="mt-7 font-display text-xl font-extrabold text-ink-900">
                    Optimizing your conversion…
                  </p>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-500">
                    QuadraConverter is using the fastest available processing path for this file. Your document stays in the conversion pipeline until the output is verified.
                  </p>

                  <div className="premium-progress mt-7 h-2.5 rounded-full bg-ink-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 transition-[width] duration-200"
                      style={{
                        width: `${Math.round(
                          progress
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-400">
                    <span>
                      Processing
                    </span>

                    <span>
                      {Math.round(
                        progress
                      )}
                      %
                    </span>
                  </div>

                  <div className="mt-7 grid grid-cols-3 gap-2 text-left">
                    {[
                      [
                        '01',
                        'Reading',
                        'File structure',
                      ],
                      [
                        '02',
                        'Converting',
                        'Native engine',
                      ],
                      [
                        '03',
                        'Verifying',
                        'Output quality',
                      ],
                    ].map(
                      ([
                        number,
                        title,
                        description,
                      ]) => (
                        <div
                          key={
                            number
                          }
                          className="rounded-2xl bg-white/80 p-3 ring-1 ring-ink-100"
                        >
                          <span className="text-[10px] font-extrabold text-brand-600">
                            {
                              number
                            }
                          </span>

                          <p className="mt-1 text-xs font-bold text-ink-800">
                            {
                              title
                            }
                          </p>

                          <p className="mt-0.5 text-[10px] text-ink-400">
                            {
                              description
                            }
                          </p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DONE */}

            {stage ===
              'done' && (
              <div className="p-6 sm:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent-100 text-accent-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>

                  <div>
                    <p className="font-display text-lg font-bold text-ink-900">
                      Conversion Complete!
                    </p>

                    <p className="text-sm text-ink-500">
                      {results.length}{' '}
                      file
                      {results.length >
                      1
                        ? 's'
                        : ''}{' '}
                      ready to
                      download
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {results.map(
                    (
                      result,
                      index
                    ) => (
                      <div
                        key={`${result.filename}-${index}`}
                        className="rounded-2xl border border-ink-100 bg-ink-50 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <FileCheck2 className="h-5 w-5 shrink-0 text-brand-600" />

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink-900">
                                {
                                  result.filename
                                }
                              </p>

                              <p className="text-xs text-ink-500">
                                {(
                                  result
                                    .blob
                                    .size /
                                  1024
                                ).toFixed(
                                  1
                                )}{' '}
                                KB ·{' '}
                                {
                                  result.mimeType
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleDownload(
                                result
                              )
                            }
                            className="btn-primary text-sm"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handlePreview(
                                result
                              )
                            }
                            className="btn-secondary text-sm"
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </button>

                          

                          <button
                            type="button"
                            onClick={() =>
                              handleShare(
                                result,
                                'whatsapp'
                              )
                            }
                            className="btn-ghost text-sm"
                          >
                            <Share2 className="h-4 w-4" />
                            Share
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>

                {results.length >
                  1 && (
                  <button
                    type="button"
                    onClick={
                      handleDownloadAll
                    }
                    className="btn-secondary mt-4 w-full"
                  >
                    <Download className="h-4 w-4" />
                    Download All
                  </button>
                )}

                {previewResult && (
                  <LivePreview
                    result={
                      previewResult
                    }
                    onClose={() =>
                      setPreviewResult(
                        null
                      )
                    }
                  />
                )}

                {results[0] &&
                  !results[0]
                    .preview &&
                  results[0].mimeType.startsWith(
                    'text/'
                  ) && (
                    <PreviewText
                      result={
                        results[0]
                      }
                    />
                  )}

                <button
                  type="button"
                  onClick={reset}
                  className="btn-ghost mt-4 w-full"
                >
                  <RefreshCw className="h-4 w-4" />
                  Convert Another
                </button>
              </div>
            )}

            {/* ERROR */}

            {stage ===
              'error' && (
              <div className="p-8 text-center sm:p-12">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-err-50 text-err-500">
                  <AlertCircle className="h-8 w-8" />
                </div>

                <p className="mt-4 font-display text-lg font-bold text-ink-900">
                  Conversion Failed
                </p>

                <p className="mx-auto mt-1 max-w-md text-sm text-err-600">
                  {error ||
                    'Something went wrong while converting your file.'}
                </p>

                <button
                  type="button"
                  onClick={reset}
                  className="btn-primary mt-6"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SIDEBAR */}

        <aside className="space-y-4">
          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-ink-900">
              <Settings2 className="h-4 w-4 text-brand-600" />
              How it works
            </h3>

            <ol className="space-y-3">
              {(needsFile ||
                needsFileOptions) && (
                <>
                  <li className="flex gap-3 text-sm text-ink-600">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      1
                    </span>

                    Upload your{' '}
                    {tool.inputType ===
                    'multi-file'
                      ? 'files'
                      : 'file'}
                  </li>

                  <li className="flex gap-3 text-sm text-ink-600">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      2
                    </span>

                    {needsFileOptions
                      ? 'Set options and click Run'
                      : 'Conversion runs automatically'}
                  </li>
                </>
              )}

              {(needsText ||
                needsOptionsOnly) && (
                <>
                  <li className="flex gap-3 text-sm text-ink-600">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      1
                    </span>

                    {needsText
                      ? 'Enter your input text or data'
                      : 'Set the tool options'}
                  </li>

                  <li className="flex gap-3 text-sm text-ink-600">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                      2
                    </span>

                    Click "
                    {needsOptionsOnly
                      ? 'Run Tool'
                      : 'Run Conversion'}
                    "
                  </li>
                </>
              )}

              <li className="flex gap-3 text-sm text-ink-600">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent-100 text-xs font-bold text-accent-700">
                  3
                </span>

                Download, preview,
                or share your result
              </li>
            </ol>
          </div>

          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <h3 className="mb-3 font-display font-bold text-ink-900">
              Tool Info
            </h3>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">
                  Category
                </dt>

                <dd className="font-semibold capitalize text-ink-800">
                  {tool.category}
                </dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-ink-500">
                  Output
                </dt>

                <dd className="font-semibold uppercase text-ink-800">
                  {tool.outputFormat}
                </dd>
              </div>

              <div className="flex justify-between">
                <dt className="text-ink-500">
                  Input
                </dt>

                <dd className="font-semibold capitalize text-ink-800">
                  {tool.inputType}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-accent-50 p-5">
            <div className="mb-2 flex items-center gap-2 text-brand-700">
              <ShieldCheck className="h-4 w-4" />

              <span className="text-sm font-bold">
                Privacy Guaranteed
              </span>
            </div>

            <p className="text-xs text-ink-600">
              Browser-safe tools run locally.
              Office and other server-backed
              tools upload files only to the
              configured QuadraConverter
              conversion service.
            </p>
          </div>

          <div className="rounded-2xl border border-ink-200 bg-white p-5">
            <div className="mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 fill-warn-500 text-warn-500" />

              <span className="text-sm font-bold text-ink-900">
                Popular Tool
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-ink-500">
              <Clock className="h-3.5 w-3.5" />
              Instant results
            </div>
          </div>
        </aside>
      </div>

      {/* EMAIL DIALOG */}

      {emailResult && (
        <EmailShareDialog
          result={emailResult}
          toolName={tool.name}
          email={emailAddress}
          setEmail={
            setEmailAddress
          }
          sending={
            emailSending
          }
          status={
            emailStatus
          }
          onClose={() => {
            if (!emailSending) {
              setEmailResult(
                null
              );
              setEmailStatus(
                null
              );
            }
          }}
          onSend={async () => {
            if (
              !emailAddress.trim()
            ) {
              setEmailStatus(
                'Please enter an email address.'
              );

              return;
            }

            setEmailSending(true);
            setEmailStatus(
              null
            );

            try {
              const apiUrl =
                import.meta.env
                  .VITE_CONVERTER_API_URL;

              if (!apiUrl) {
                throw new Error(
                  'Email service is not configured.'
                );
              }

              const formData =
                new FormData();

              formData.append(
                'file',
                emailResult.blob,
                emailResult.filename
              );

              formData.append(
                'to',
                emailAddress.trim()
              );

              formData.append(
                'subject',
                `Converted file: ${emailResult.filename}`
              );

              formData.append(
                'tool',
                tool.name
              );

              const response =
                await fetch(
                  `${apiUrl}/send-email`,
                  {
                    method: 'POST',
                    body: formData,
                  }
                );

              let data: {
                detail?: string;
                message?: string;
              } = {};

              try {
                data =
                  await response.json();
              } catch {
                // Non-JSON response.
              }

              if (!response.ok) {
                throw new Error(
                  data.detail ||
                    data.message ||
                    'Email could not be sent.'
                );
              }

              setEmailStatus(
                'Email sent successfully.'
              );
            } catch (err) {
              setEmailStatus(
                err instanceof Error
                  ? err.message
                  : 'Email could not be sent.'
              );
            } finally {
              setEmailSending(
                false
              );
            }
          }}
        />
      )}
    </div>
  );
}

/*
 * ============================================================
 * PREVIEW TEXT
 * ============================================================
 */

function PreviewText({
  result,
}: {
  result: Converters.ConvertResult;
}) {
  const [text, setText] =
    useState<string>('');

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    result.blob
      .text()
      .then((value) => {
        if (!active) {
          return;
        }

        setText(value);
        setLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setText(
          'Unable to preview this file.'
        );

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [result]);

  return (
    <div className="mt-6 rounded-2xl border border-ink-200 bg-white p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-700">
        <Eye className="h-4 w-4" />
        Preview
      </p>

      {loading ? (
        <p className="text-sm text-ink-400">
          Loading…
        </p>
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-50 p-3 font-mono text-xs text-ink-700">
          {text.substring(
            0,
            5000
          )}

          {text.length > 5000
            ? '\n\n… (truncated)'
            : ''}
        </pre>
      )}
    </div>
  );
}

/*
 * ============================================================
 * OPTION FIELD
 * ============================================================
 */

function OptionField({
  opt,
  value,
  onChange,
}: {
  opt: ToolOption;

  value:
    | string
    | number
    | boolean;

  onChange: (
    value:
      | string
      | number
      | boolean
  ) => void;
}) {
  if (
    opt.type === 'text'
  ) {
    return (
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-ink-700">
          {opt.label}
        </label>

        <textarea
          value={String(
            value ?? ''
          )}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          placeholder={
            opt.placeholder
          }
          rows={6}
          className="w-full resize-y rounded-xl border border-ink-200 px-4 py-3 font-mono text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>
    );
  }

  if (
    opt.type === 'select'
  ) {
    return (
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-ink-700">
          {opt.label}
        </label>

        <select
          value={String(
            value ?? ''
          )}
          onChange={(event) =>
            onChange(
              event.target.value
            )
          }
          className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          {opt.choices?.map(
            (choice) => (
              <option
                key={
                  choice.value
                }
                value={
                  choice.value
                }
              >
                {
                  choice.label
                }
              </option>
            )
          )}
        </select>
      </div>
    );
  }

  if (
    opt.type === 'number'
  ) {
    return (
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-ink-700">
          {opt.label}
        </label>

        <input
          type="number"
          value={Number(
            value ?? 0
          )}
          onChange={(event) =>
            onChange(
              Number(
                event.target
                  .value
              )
            )
          }
          min={opt.min}
          max={opt.max}
          step={opt.step}
          placeholder={
            opt.placeholder
          }
          className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </div>
    );
  }

  if (
    opt.type === 'range'
  ) {
    return (
      <div className="mb-4">
        <label className="mb-1.5 flex justify-between text-sm font-medium text-ink-700">
          <span>
            {opt.label}
          </span>

          <span className="font-bold text-brand-600">
            {Number(
              value ?? 0
            )}
            %
          </span>
        </label>

        <input
          type="range"
          value={Number(
            value ?? 0
          )}
          onChange={(event) =>
            onChange(
              Number(
                event.target
                  .value
              )
            )
          }
          min={opt.min}
          max={opt.max}
          step={opt.step}
          className="w-full accent-brand-600"
        />
      </div>
    );
  }

  if (
    opt.type ===
    'checkbox'
  ) {
    return (
      <label className="mb-4 flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={Boolean(
            value
          )}
          onChange={(event) =>
            onChange(
              event.target
                .checked
            )
          }
          className="h-5 w-5 rounded accent-brand-600"
        />

        <span className="text-sm font-medium text-ink-700">
          {opt.label}
        </span>
      </label>
    );
  }

  return null;
}

/*
 * ============================================================
 * LIVE PREVIEW
 * ============================================================
 */

function LivePreview({
  result,
  onClose,
}: {
  result: Converters.ConvertResult;
  onClose: () => void;
}) {
  const [url, setUrl] =
    useState<string>('');

  useEffect(() => {
    const objectUrl =
      URL.createObjectURL(
        result.blob
      );

    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [result]);

  const mime =
    result.mimeType.toLowerCase();

  const isImage =
    mime.startsWith(
      'image/'
    );

  const isPdf =
    mime ===
    'application/pdf';

  const isText =
    mime.startsWith(
      'text/'
    ) ||
    mime.includes('json') ||
    mime.includes(
      'javascript'
    ) ||
    mime.includes('xml');

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-brand-600" />

          <div>
            <p className="text-sm font-bold text-ink-900">
              Live Preview
            </p>

            <p className="max-w-[280px] truncate text-xs text-ink-500">
              {result.filename}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={
            onClose
          }
          className="text-xs font-semibold text-ink-500 hover:text-ink-900"
        >
          Close
        </button>
      </div>

      <div className="bg-ink-50 p-4">
        {!url && (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        )}

        {url &&
          isImage && (
            <div className="flex max-h-[650px] min-h-[300px] items-center justify-center overflow-auto rounded-xl bg-white p-4">
              <img
                src={url}
                alt={
                  result.filename
                }
                className="max-h-[600px] max-w-full rounded-lg object-contain"
              />
            </div>
          )}

        {url && isPdf && (
          <MobilePdfPreview url={url} filename={result.filename} />
        )}

        {url &&
          isText && (
            <TextBlobPreview
              result={
                result
              }
            />
          )}

        {url &&
          !isImage &&
          !isPdf &&
          !isText && (
            <div className="rounded-xl bg-white p-8 text-center">
              <FileCheck2 className="mx-auto h-10 w-10 text-brand-600" />

              <p className="mt-3 text-sm font-semibold text-ink-900">
                Preview not available
                for this file type
              </p>

              <button
                type="button"
                onClick={() => {
                  const objectUrl =
                    URL.createObjectURL(
                      result.blob
                    );

                  const anchor =
                    document.createElement(
                      'a'
                    );

                  anchor.href =
                    objectUrl;

                  anchor.download =
                    result.filename;

                  document.body.appendChild(
                    anchor
                  );

                  anchor.click();

                  anchor.remove();

                  URL.revokeObjectURL(
                    objectUrl
                  );
                }}
                className="btn-primary mt-4"
              >
                <Download className="h-4 w-4" />
                Download File
              </button>
            </div>
          )}
      </div>
    </div>
  );
}

/*
 * ============================================================
 * TEXT BLOB PREVIEW
 * ============================================================
 */


function MobilePdfPreview({ url, filename }: { url: string; filename: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  useEffect(() => {
    let disposed = false;
    const render = async () => {
      setLoading(true); setError('');
      try {
        const pdfjs = PdfJs;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        const response = await fetch(url);
        if (!response.ok) throw new Error('The preview file could not be loaded.');
        const bytes = new Uint8Array(await response.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data: bytes }).promise;
        if (disposed) return;
        setPageCount(pdf.numPages);
        const safePage = Math.min(page, pdf.numPages);
        if (safePage !== page) setPage(safePage);
        const pdfPage = await pdf.getPage(safePage);
        const viewport = pdfPage.getViewport({ scale: 1.45 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Could not create preview canvas.');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) { if (!disposed) setError(e instanceof Error ? e.message : 'PDF preview failed.'); }
      finally { if (!disposed) setLoading(false); }
    };
    render();
    return () => { disposed = true; };
  }, [url, page]);

  return <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 bg-ink-50 px-3 py-2">
      <span className="truncate text-xs font-bold text-ink-700">{filename}</span>
      <div className="flex items-center gap-1.5"><button className="btn-ghost px-2 py-1.5 text-xs" disabled={page<=1} onClick={()=>setPage((p)=>Math.max(1,p-1))}>Previous</button><span className="px-2 text-xs font-bold text-ink-500">{page}/{pageCount}</span><button className="btn-ghost px-2 py-1.5 text-xs" disabled={page>=pageCount} onClick={()=>setPage((p)=>Math.min(pageCount,p+1))}>Next</button></div>
    </div>
    <div className="min-h-[520px] overflow-auto bg-ink-100 p-3 sm:p-6">{loading && <div className="grid min-h-[480px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>}{error && <div className="grid min-h-[480px] place-items-center p-8 text-center text-sm text-err-600">{error}</div>}<canvas ref={canvasRef} className={`${loading || error ? 'hidden' : 'block'} mx-auto h-auto max-w-full rounded-md bg-white shadow-card`} /></div>
  </div>;
}

function TextBlobPreview({
  result,
}: {
  result: Converters.ConvertResult;
}) {
  const [text, setText] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let active = true;

    result.blob
      .text()
      .then((value) => {
        if (!active) {
          return;
        }

        setText(value);
        setLoading(false);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setText(
          'Unable to preview this file.'
        );

        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [result]);

  if (loading) {
    return (
      <div className="grid h-64 place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <pre className="max-h-[600px] overflow-auto whitespace-pre-wrap rounded-xl border border-ink-200 bg-white p-4 font-mono text-xs text-ink-700">
      {text.length >
      20000
        ? `${text.substring(
            0,
            20000
          )}\n\n... Preview truncated`
        : text}
    </pre>
  );
}

/*
 * ============================================================
 * EMAIL SHARE DIALOG
 * ============================================================
 */

function EmailShareDialog({
  result,
  toolName,
  email,
  setEmail,
  sending,
  status,
  onClose,
  onSend,
}: {
  result: Converters.ConvertResult;
  toolName: string;
  email: string;
  setEmail: (
    value: string
  ) => void;
  sending: boolean;
  status: string | null;
  onClose: () => void;
  onSend: () => void;
}) {
  const success =
    status ===
    'Email sent successfully.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-ink-200 bg-white shadow-2xl">
        <div className="border-b border-ink-100 px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-bold text-ink-900">
                Email Converted File
              </h2>

              <p className="mt-1 text-xs text-ink-500">
                Send the converted file directly to an email address.
              </p>
            </div>

            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                sending
              }
              className="text-lg text-ink-400 hover:text-ink-900 disabled:opacity-50"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-4 rounded-xl border border-ink-100 bg-ink-50 p-3">
            <p className="truncate text-sm font-semibold text-ink-900">
              {result.filename}
            </p>

            <p className="mt-1 text-xs text-ink-500">
              {(
                result.blob
                  .size /
                1024
              ).toFixed(
                1
              )}{' '}
              KB ·{' '}
              {toolName}
            </p>
          </div>

          <label className="mb-2 block text-sm font-semibold text-ink-700">
            Recipient Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target
                  .value
              )
            }
            placeholder="recipient@example.com"
            disabled={
              sending ||
              success
            }
            className="w-full rounded-xl border border-ink-200 px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50"
          />

          {status && (
            <div
              className={`mt-3 rounded-xl px-4 py-3 text-sm ${
                success
                  ? 'bg-accent-50 text-accent-700'
                  : 'bg-err-50 text-err-600'
              }`}
            >
              {status}
            </div>
          )}

          {!success && (
            <button
              type="button"
              onClick={
                onSend
              }
              disabled={
                sending
              }
              className="btn-primary mt-5 w-full disabled:opacity-60"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send Email
                </>
              )}
            </button>
          )}

          {success && (
            <button
              type="button"
              onClick={
                onClose
              }
              className="btn-primary mt-5 w-full"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
