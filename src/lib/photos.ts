/** Downscales a user-picked image into a JPEG data URL (kept in localStorage). */
export function fileToDataUrl(f: File, max = 1100): Promise<string> {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onerror = reject;
    rd.onload = () => {
      const im = new Image();
      im.onerror = reject;
      im.onload = () => {
        const sc = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * sc);
        c.height = Math.round(im.height * sc);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      im.src = rd.result as string;
    };
    rd.readAsDataURL(f);
  });
}
