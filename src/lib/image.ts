const MAX_SIZE = 1600; // ใบเสร็จต้องอ่านออก จึงใหญ่กว่ารูปสินค้า
const QUALITY = 0.8;

/** ย่อรูปใบเสร็จก่อนอัปโหลด */
export function compressReceipt(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('ไฟล์ไม่ใช่รูปภาพ'));
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error('เปิดรูปไม่สำเร็จ'));
    };
    img.onload = () => {
      URL.revokeObjectURL(src);
      const scale = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('ประมวลผลรูปไม่ได้'));
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('บีบรูปไม่สำเร็จ'))), 'image/jpeg', QUALITY);
    };
    img.src = src;
  });
}
