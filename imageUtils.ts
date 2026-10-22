import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

/**
 * Canvas APIを利用して画像を長辺最大1024pxに自動縮小し、JPEG形式に圧縮する
 * @param file アップロードされた画像ファイル
 * @param maxDimension 最大長辺ピクセル数 (デフォルト: 1024px)
 * @param quality 圧縮品質 (0.0〜1.0, デフォルト: 0.85)
 */
export async function resizeAndCompressImage(
  file: File,
  maxDimension = 1024,
  quality = 0.85
): Promise<CompressedImageResult> {
  return new Promise((resolve, reject) => {
    // MIMEタイプの確認
    if (!file.type.startsWith('image/')) {
      return reject(new Error('選択されたファイルは画像形式ではありません。'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    
    reader.onload = (event) => {
      const srcUrl = event.target?.result as string;
      const img = new Image();

      img.onerror = () => reject(new Error('画像の解析に失敗しました。壊れたファイルまたは非対応フォーマットです。'));

      img.onload = () => {
        let { width, height } = img;

        // 長辺が最大サイズを超えている場合、アスペクト比を維持して縮小計算
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // HTML5 Canvas要素で描画とリサンプリング
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D コンテキストの取得に失敗しました。'));
        }

        // 画質向上のためのスムージング設定
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 白背景を描画（PNG透過の黒化防止）
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // 画像を描画
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG 形式で Blob 出力
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('画像の圧縮変換に失敗しました。'));
            }

            // プレビュー表示用 Data URL も生成
            const dataUrl = canvas.toDataURL('image/jpeg', quality);

            resolve({
              blob,
              dataUrl,
              width,
              height,
              originalSizeBytes: file.size,
              compressedSizeBytes: blob.size
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = srcUrl;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * 圧縮画像を Firebase Storage にアップロードし、ダウンロードURLと保存パスを返す
 * @param file アップロード対象ファイル
 * @param facilityId 施設ID
 * @param residentId 入所者ID
 * @param date 記録日 (YYYY-MM-DD)
 */
export async function uploadVitalImage(
  file: File,
  facilityId: string,
  residentId: string,
  date: string
): Promise<{ downloadUrl: string; storagePath: string; compressedSizeKB: number }> {
  // 1. フロントエンドで自動リサイズ & 圧縮
  const compressed = await resizeAndCompressImage(file, 1024, 0.85);
  const compressedSizeKB = Math.round(compressed.compressedSizeBytes / 1024);

  // 2. Storage の保存パス設計: vital_images/{facilityId}/{residentId}/{date}_{timestamp}_{random}.jpg
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  const fileName = `${date}_${timestamp}_${randomStr}.jpg`;
  const storagePath = `vital_images/${facilityId}/${residentId}/${fileName}`;

  try {
    const storageRef = ref(storage, storagePath);
    
    // 3. Firebase Storage にアップロード
    const snapshot = await uploadBytes(storageRef, compressed.blob, {
      contentType: 'image/jpeg',
      customMetadata: {
        facilityId,
        residentId,
        recordDate: date,
        originalName: file.name,
        compressedSize: String(compressed.compressedSizeBytes)
      }
    });

    // 4. ダウンロード公開URLの取得
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return {
      downloadUrl,
      storagePath,
      compressedSizeKB
    };
  } catch (error) {
    console.warn('[Storage] Firebase Storage upload failed or offline. Falling back to compressed DataURL:', error);
    // Storageへの書き込み権限エラーや未設定環境でも、圧縮済みDataURL（~100KB）をフォールバックとして保持
    return {
      downloadUrl: compressed.dataUrl,
      storagePath: 'inline_data_url',
      compressedSizeKB
    };
  }
}

/**
 * Firebase Storage 上の画像を削除する
 * @param storagePath 保存パス
 */
export async function deleteVitalImage(storagePath: string): Promise<void> {
  if (!storagePath || storagePath === 'inline_data_url' || storagePath.startsWith('data:')) {
    return;
  }
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('[Storage] Could not delete image from Firebase Storage:', err);
  }
}

/**
 * バイト数を読みやすい形式（KB / MB）にフォーマット
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
