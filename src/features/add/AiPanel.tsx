// Photo and/or text description -> AI-estimated items.

import { useMutation } from '@tanstack/react-query';
import { Camera, ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button, ErrorNote, Field, IconButton } from '../../components/ui';
import { api } from '../../lib/api';
import { prepareImage, type PreparedImage } from '../../lib/image';
import type { AnalyzeResult } from '../../../shared/types';

export function AiPanel({
  mode,
  onResult,
}: {
  mode: 'photo' | 'text';
  onResult: (result: AnalyzeResult, previewUrl: string | null) => void;
}) {
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [imageError, setImageError] = useState<unknown>(null);
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const analyze = useMutation({
    mutationFn: () =>
      api.analyze({
        image: image?.base64,
        mimeType: image?.mimeType,
        text: text.trim() || undefined,
      }),
    onSuccess: (result) => onResult(result, image?.previewUrl ?? null),
  });

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImageError(null);
    try {
      setImage(await prepareImage(file));
    } catch (err) {
      setImageError(err);
    }
  };

  const canSubmit = mode === 'photo' ? Boolean(image) : text.trim().length > 0;

  return (
    <div className="add-panel">
      {mode === 'photo' &&
        (image ? (
          <div className="photo-preview">
            <img src={image.previewUrl} alt="已選擇的照片" />
            <IconButton label="移除照片" onClick={() => setImage(null)} disabled={analyze.isPending}>
              <X size={18} />
            </IconButton>
          </div>
        ) : (
          <div
            className={`drop-zone${dragging ? ' is-dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              onFile(e.dataTransfer.files[0]);
            }}
          >
            <p>拍下整份餐點，AI 會拆解每樣食物並估算份量與營養素</p>
            <div className="button-row" style={{ justifyContent: 'center' }}>
              <Button variant="primary" onClick={() => cameraRef.current?.click()}>
                <Camera size={18} /> 拍照
              </Button>
              <Button onClick={() => galleryRef.current?.click()}>
                <ImagePlus size={18} /> 選擇照片
              </Button>
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
            <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        ))}
      <ErrorNote error={imageError} />

      <div style={{ marginTop: mode === 'photo' ? 16 : 0 }}>
        <Field
          label={mode === 'photo' ? '補充說明（選填）' : '描述你吃了什麼'}
          htmlFor="ai-text"
          hint={mode === 'photo' ? '例如：飯只吃一半、無糖' : '寫得越具體越準確，例如份量、店家、做法'}
        >
          <textarea
            id="ai-text"
            className="textarea"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder={mode === 'photo' ? '' : '例如：7-11 雞胸肉沙拉一盒、一杯大杯無糖豆漿'}
          />
        </Field>
      </div>

      <div className="stack" style={{ marginTop: 16 }}>
        <ErrorNote error={analyze.error} />
        <Button variant="primary" block disabled={!canSubmit} loading={analyze.isPending} onClick={() => analyze.mutate()}>
          分析
        </Button>
        {analyze.isPending && (
          <p className="subtle" style={{ textAlign: 'center', fontSize: 13 }}>
            分析中，通常需要 5–15 秒
          </p>
        )}
      </div>
    </div>
  );
}
