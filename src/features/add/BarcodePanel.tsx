import { useMutation } from '@tanstack/react-query';
import { ScanLine } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ErrorNote, Field, TextInput } from '../../components/ui';
import { api, ApiError } from '../../lib/api';
import type { BarcodeResult } from '../../../shared/types';

/** Live camera scanning with ZXing (loaded on demand). */
function Scanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const detectedRef = useRef(onDetected);
  detectedRef.current = onDetected;

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ]);
        if (cancelled || !videoRef.current) return;
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        let done = false;
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result, _err, ctrl) => {
            if (result && !done) {
              done = true;
              ctrl.stop();
              detectedRef.current(result.getText());
            }
          },
        );
        if (cancelled) controls.stop();
        else stop = () => controls.stop();
      } catch {
        if (!cancelled) setError('無法開啟相機。請確認已允許相機權限，或直接輸入條碼數字。');
      }
    })();

    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  if (error) return <p className="notice">{error}</p>;
  return (
    <div className="scanner">
      <video ref={videoRef} muted playsInline />
      <div className="scanner-frame" />
    </div>
  );
}

export function BarcodePanel({
  onFound,
  onNotFound,
}: {
  onFound: (result: BarcodeResult) => void;
  onNotFound: (code: string) => void;
}) {
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState('');

  const lookup = useMutation({
    mutationFn: (value: string) => api.barcode(value),
    onSuccess: onFound,
  });

  const run = (value: string) => {
    setCode(value);
    setScanning(false);
    lookup.mutate(value);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (code.trim()) run(code.trim());
  };

  const notFound = lookup.error instanceof ApiError && lookup.error.status === 404;

  return (
    <div className="add-panel">
      {scanning ? (
        <>
          <Scanner onDetected={run} />
          <Button block variant="ghost" style={{ marginTop: 8 }} onClick={() => setScanning(false)}>
            停止掃描
          </Button>
        </>
      ) : (
        <Button variant="primary" block onClick={() => setScanning(true)}>
          <ScanLine size={18} /> 開啟相機掃描
        </Button>
      )}

      <form onSubmit={onSubmit} style={{ marginTop: 20 }}>
        <Field label="或輸入條碼數字" htmlFor="barcode">
          <div style={{ display: 'flex', gap: 8 }}>
            <TextInput
              id="barcode"
              inputMode="numeric"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="4710088410108"
            />
            <Button type="submit" loading={lookup.isPending} disabled={!code.trim()}>
              查詢
            </Button>
          </div>
        </Field>
      </form>

      {lookup.error && (
        <div className="stack" style={{ marginTop: 16 }}>
          {notFound ? (
            <p className="notice">
              {lookup.error.message}。許多台灣本地商品不在國際資料庫中，可以依包裝上的營養標示建立一次，之後掃描就會直接帶出。
            </p>
          ) : (
            <ErrorNote error={lookup.error} />
          )}
          {notFound && (
            <Button block onClick={() => onNotFound(lookup.variables ?? code)}>
              依營養標示建立
            </Button>
          )}
        </div>
      )}
      <p className="field-hint" style={{ marginTop: 16 }}>
        優先比對你建立過的食物，其次查詢 Open Food Facts 開放資料庫。
      </p>
    </div>
  );
}
