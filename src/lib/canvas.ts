/* ============================================================
 * Canvas = courte vidéo verticale jouée en boucle (comme sur Spotify).
 * Ces limites sont aussi vérifiées côté serveur.
 * ============================================================ */

export const CANVAS_MAX_SECONDS = 8.5;
export const CANVAS_MAX_BYTES = 15 * 1024 * 1024;

/** Retourne un message d'erreur en français, ou null si le fichier est valide. */
export function checkCanvasFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!/\.(mp4|m4v|webm)$/i.test(file.name)) {
      resolve('Format non supporté : utilisez un fichier .mp4 ou .webm.');
      return;
    }
    if (file.size > CANVAS_MAX_BYTES) {
      resolve(`Fichier trop lourd (${(file.size / 1048576).toFixed(1)} Mo) : ${Math.round(CANVAS_MAX_BYTES / 1048576)} Mo maximum. Exportez en 720p pour l'alléger.`);
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;

    let finished = false;
    const done = (message: string | null) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load();
      resolve(message);
    };
    const timer = window.setTimeout(() => done('Impossible de lire cette vidéo.'), 10000);

    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > CANVAS_MAX_SECONDS) {
        done(`Cette vidéo dure ${video.duration.toFixed(1)} s : 8 secondes maximum.`);
      } else {
        done(null);
      }
    };
    video.onerror = () => done('Cette vidéo ne peut pas être lue par le navigateur (essayez un MP4 en H.264).');
    video.src = url;
  });
}
