import express from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { requireArtist, requireUser } from '../auth.js';

const router = express.Router();

const INVITE_DAYS = 7;

/* ============================== Côté artiste (portail Distro) ============================== */

/** Liste des amis (pseudos uniquement) et des liens d'invitation encore valides. */
router.get('/distro/friends', requireArtist, (req, res) => {
  const friends = db
    .prepare(
      `SELECT u.id, u.username, u.avatar_url, f.created_at
       FROM friendships f JOIN users u ON u.id = f.user_id
       WHERE f.artist_id = ? ORDER BY f.created_at DESC`
    )
    .all(req.artistId);
  const invites = db
    .prepare(
      `SELECT token, created_at, expires_at FROM friend_invites
       WHERE artist_id = ? AND used_by IS NULL AND expires_at > datetime('now')
       ORDER BY created_at DESC`
    )
    .all(req.artistId);
  res.json({ friends, invites, invite_days: INVITE_DAYS });
});

/** Crée un lien d'invitation à usage unique (valable 7 jours). */
router.post('/distro/friends/invites', requireArtist, (req, res) => {
  // On évite d'accumuler des centaines de liens : 20 actifs maximum
  const active = db
    .prepare("SELECT COUNT(*) AS n FROM friend_invites WHERE artist_id = ? AND used_by IS NULL AND expires_at > datetime('now')")
    .get(req.artistId).n;
  if (active >= 20) return res.status(400).json({ error: 'Déjà 20 liens actifs : révoquez-en avant d\'en créer un nouveau.' });

  const token = crypto.randomBytes(18).toString('base64url');
  db.prepare(`INSERT INTO friend_invites (token, artist_id, expires_at) VALUES (?, ?, datetime('now', '+${INVITE_DAYS} days'))`).run(
    token,
    req.artistId
  );
  const row = db.prepare('SELECT token, created_at, expires_at FROM friend_invites WHERE token = ?').get(token);
  res.status(201).json({ invite: row, path: `/invite/${token}` });
});

router.delete('/distro/friends/invites/:token', requireArtist, (req, res) => {
  db.prepare('DELETE FROM friend_invites WHERE token = ? AND artist_id = ?').run(String(req.params.token), req.artistId);
  res.json({ ok: true });
});

router.delete('/distro/friends/:userId', requireArtist, (req, res) => {
  db.prepare('DELETE FROM friendships WHERE artist_id = ? AND user_id = ?').run(req.artistId, Number(req.params.userId));
  res.json({ ok: true });
});

/* ============================== Côté invité ============================== */

function inviteInfo(token) {
  return db
    .prepare(
      `SELECT i.token, i.used_by, i.expires_at, i.expires_at <= datetime('now') AS expired,
              a.id AS artist_id, a.name AS artist_name, a.avatar_url, a.is_verified
       FROM friend_invites i JOIN artists a ON a.id = i.artist_id WHERE i.token = ?`
    )
    .get(String(token));
}

/** Aperçu public du lien : qui invite ? (rien d'autre n'est révélé) */
router.get('/invites/:token', (req, res) => {
  const inv = inviteInfo(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Ce lien d\'invitation n\'existe pas.' });
  if (inv.used_by) return res.status(410).json({ error: 'Ce lien a déjà été utilisé.' });
  if (inv.expired) return res.status(410).json({ error: 'Ce lien a expiré. Demandez-en un nouveau.' });
  res.json({
    artist: { id: inv.artist_id, name: inv.artist_name, avatar_url: inv.avatar_url, is_verified: !!inv.is_verified },
  });
});

/** Accepter l'invitation (compte connecté requis). */
router.post('/invites/:token/accept', requireUser, (req, res) => {
  const inv = inviteInfo(req.params.token);
  if (!inv) return res.status(404).json({ error: 'Ce lien d\'invitation n\'existe pas.' });

  const already = db.prepare('SELECT 1 FROM friendships WHERE artist_id = ? AND user_id = ?').get(inv.artist_id, req.userId);
  if (already) return res.json({ ok: true, already: true, artist: { id: inv.artist_id, name: inv.artist_name } });

  if (inv.used_by) return res.status(410).json({ error: 'Ce lien a déjà été utilisé.' });
  if (inv.expired) return res.status(410).json({ error: 'Ce lien a expiré. Demandez-en un nouveau.' });

  db.transaction(() => {
    db.prepare('INSERT OR IGNORE INTO friendships (artist_id, user_id) VALUES (?, ?)').run(inv.artist_id, req.userId);
    db.prepare("UPDATE friend_invites SET used_by = ?, used_at = datetime('now') WHERE token = ?").run(req.userId, inv.token);
  })();
  res.json({ ok: true, already: false, artist: { id: inv.artist_id, name: inv.artist_name } });
});

export default router;
