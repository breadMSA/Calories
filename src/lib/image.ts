// Downscales photos before upload: phone photos are often 5–12 MB, which is slow on mobile
// data and exceeds the serverless request size limit.

const MAX_EDGE = 1280;

export interface PreparedImage {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('無法讀取這張圖片');

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
  if (!blob) throw new Error('無法處理這張圖片');

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', previewUrl: dataUrl };
}
