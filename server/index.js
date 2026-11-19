import express from 'express';
import compression from 'compression';
import fs from 'node:fs';
import path from 'node:path';
import { PORT, DATA_DIR, DIST_DIR } from './config.js';
import db from './db.js';
import mediaRouter from './media.js';
import publicRoutes from './routes/public.js';
import accountRoutes from './routes/account.js';
import distroRoutes from './routes/distro.js';
import { optionalUser } from './auth.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Compression des réponses texte/JSON (jamais sur l'audio : déjà compressé et en Range)
app.use(
  compression({
    filter: (req, res) => (req.path.startsWith('/media/') ? false : compression.filter(req, res)),
  })
);

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Fichiers médias servis depuis DATA_DIR/uploads (chemins relatifs stockés en base)
app.use('/media', mediaRouter);
app.use('/media', (_req, res) => res.status(404).json({ error: 'Média introuvable.' }));

// API
app.use('/api', optionalUser, publicRoutes);
app.use('/api', accountRoutes);
app.use('/api', distroRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable.' }));

// Frontend React (build Vite) sur le même port
if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  app.use(
    express.static(DIST_DIR, {
      index: false,
      maxAge: '1h',
      setHeaders(res, filePath) {
        // Les fichiers /assets/* ont un hash dans leur nom : cache longue durée
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('text/plain')
      .send("SXTNN AUDIO : le frontend n'est pas encore construit.\nLancez « npm run build » puis « npm start » (ou « npm run dev » pour le développement).");
  });
}

// Gestion d'erreurs globale (JSON pour l'API)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error('[serveur] erreur :', err);
  if (res.headersSent) return;
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Requête JSON invalide.' });
  res.status(500).json({ error: 'Erreur serveur inattendue.' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`SXTNN AUDIO prêt sur le port ${PORT}`);
  console.log(`Données stockées dans : ${DATA_DIR}`);
});

// Gros envois (audio, backups) : on laisse jusqu'à 30 minutes au lieu des 5 minutes par défaut de Node
server.requestTimeout = 30 * 60 * 1000;
server.keepAliveTimeout = 65 * 1000;
server.headersTimeout = 70 * 1000;

// Arrêt propre (Railway envoie SIGTERM à chaque redéploiement)
function shutdown(signal) {
  console.log(`${signal} reçu, arrêt en cours...`);
  server.close(() => {
    try {
      db.close();
    } catch {
      /* déjà fermée */
    }
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
