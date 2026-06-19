// Shared domain constants (kept in sync with server/src/lib/constants.js)

export const COMMERCIALI = ['Laura', 'Massimo', 'Gabriele'];

// Account manager dei clienti attivi: commerciali + Torrefazione (clienti gestiti
// direttamente dalla torrefazione, solo come etichetta organizzativa).
export const ACCOUNT_MANAGERS = [...COMMERCIALI, 'Torrefazione'];

// Motivi del mancato rinnovo (feedback check alla scadenza contratto).
export const MOTIVI_MANCATO_RINNOVO = ['Prezzo', 'Servizio/qualità', 'Chiusura attività', 'Concorrenza', 'Cambio fornitore', 'Altro'];

export const FASI = ['Lead', 'Contattato', 'In trattativa', 'Proposta', 'Chiuso', 'K.O.'];

export const SENSIBILITY = ['low', 'mid', 'high'];

export const CATEGORIE = [
  'Hotel',
  'Caffè/Bakery IT',
  'Caffè/Bakery Estero',
  'Ristoranti',
  'Agenzie',
  'Startup',
  'Corporate',
  'Moda/Design',
  'Meta Lead',
];

// Badge colours per category (tag visualization on cards/filters)
export const CATEGORIA_BADGE = {
  Hotel: 'bg-amber-100 text-amber-800',
  'Caffè/Bakery IT': 'bg-orange-100 text-orange-800',
  'Caffè/Bakery Estero': 'bg-yellow-100 text-yellow-800',
  Ristoranti: 'bg-red-100 text-red-800',
  Agenzie: 'bg-blue-100 text-blue-800',
  Startup: 'bg-violet-100 text-violet-800',
  Corporate: 'bg-slate-200 text-slate-700',
  'Moda/Design': 'bg-fuchsia-100 text-fuchsia-800',
  'Meta Lead': 'bg-cyan-100 text-cyan-800',
};

export const EMAIL_TO_COMMERCIALE = {
  'laura@cafezal.com': 'Laura',
  'massimo@cafezal.com': 'Massimo',
  'gabriele@cafezal.com': 'Gabriele',
};

// Torrefazione / store roles (mirror del server) — fallback istantaneo dall'email.
export const TORREFAZIONE_EMAILS = ['torrefazione@cafezal.it'];
export const STORE_EMAIL_TO_NEGOZIO = {
  'coffeehub@cafezal.it': 'Premuda',
  'solferino@cafezal.it': 'Solferino',
  'magenta@cafezal.it': 'Magenta',
  'sangregorio@cafezal.it': 'San Gregorio',
  'bicocca@cafezal.it': 'Bicocca',
};

// Kanban column styling per phase
export const FASE_COLORS = {
  Lead: 'bg-slate-50 border-slate-200',
  Contattato: 'bg-blue-50 border-blue-200',
  'In trattativa': 'bg-amber-50 border-amber-200',
  Proposta: 'bg-violet-50 border-violet-200',
  Chiuso: 'bg-green-50 border-green-200',
  'K.O.': 'bg-red-50 border-red-200',
};

export const FASE_HEADER = {
  Lead: 'text-slate-700',
  Contattato: 'text-blue-700',
  'In trattativa': 'text-amber-700',
  Proposta: 'text-violet-700',
  Chiuso: 'text-green-700',
  'K.O.': 'text-red-700',
};

export const SENS_BADGE = {
  low: 'bg-green-100 text-green-800',
  mid: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
};

// Sensibility dot color (compact indicator on cards)
export const SENS_DOT = {
  low: 'bg-emerald-500',
  mid: 'bg-amber-500',
  high: 'bg-rose-500',
};

// Solid accent colour per phase (column header dot + count)
export const FASE_ACCENT = {
  Lead: 'bg-slate-400',
  Contattato: 'bg-blue-500',
  'In trattativa': 'bg-amber-500',
  Proposta: 'bg-violet-500',
  Chiuso: 'bg-emerald-500',
  'K.O.': 'bg-rose-500',
};

export const CLOSED_FASI = ['Chiuso', 'K.O.'];

// Win probability per phase → weighted pipeline / forecast.
export const FASE_PROBABILITA = {
  Lead: 0.1,
  Contattato: 0.25,
  'In trattativa': 0.5,
  Proposta: 0.75,
  Chiuso: 1,
  'K.O.': 0,
};

// Suggested close reasons (free text still allowed via datalist).
export const MOTIVI_VINTO = ['Prezzo competitivo', 'Qualità prodotto', 'Relazione/fiducia', 'Campione convincente'];
export const MOTIVI_PERSO = ['Prezzo troppo alto', 'Scelto un concorrente', 'Non interessato', 'Budget assente', 'Tempistiche', 'Nessuna risposta'];

export function fmtEuro(n) {
  return `€ ${(Number(n) || 0).toLocaleString('it-IT')}`;
}

// Whole days since a timestamp (for "stale lead" detection). null if unknown.
export function daysSince(tsStr) {
  if (!tsStr) return null;
  const d = new Date(tsStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// Activity timeline types
export const ACTIVITY_TIPI = ['chiamata', 'whatsapp', 'instagram', 'email', 'meeting', 'nota', 'altro'];

// ─── Eventi ───
export const EVENTO_TIPI = ['Fiera', 'Take over', 'Catering estero'];
export const EVENTO_STATUS = ['contattato', 'trattativa', 'firmato', 'organizzazione', 'eseguita'];
export const EVENTO_STATUS_META = {
  contattato: { label: 'Contattato', dot: 'bg-blue-500', badge: 'bg-blue-100 text-blue-800' },
  trattativa: { label: 'Trattativa', dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-800' },
  firmato: { label: 'Firmato', dot: 'bg-violet-500', badge: 'bg-violet-100 text-violet-800' },
  organizzazione: { label: 'Organizzazione', dot: 'bg-cyan-500', badge: 'bg-cyan-100 text-cyan-800' },
  eseguita: { label: 'Evento eseguito', dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
};
export const PERMESSI_STATUS = ['da_chiedere', 'richiesti', 'inviati'];
export const PERMESSI_META = {
  da_chiedere: { label: 'Da chiedere', badge: 'bg-rose-100 text-rose-700' },
  richiesti: { label: 'Richiesti', badge: 'bg-amber-100 text-amber-800' },
  inviati: { label: 'Inviati', badge: 'bg-emerald-100 text-emerald-800' },
};

// Coffee sample outcomes
export const SAMPLE_ESITI = ['in_attesa', 'convertito', 'non_convertito'];
export const SAMPLE_ESITO_META = {
  in_attesa: { label: 'In attesa', badge: 'bg-amber-100 text-amber-800' },
  convertito: { label: 'Convertito', badge: 'bg-emerald-100 text-emerald-800' },
  non_convertito: { label: 'Non convertito', badge: 'bg-rose-100 text-rose-800' },
};

// Reorder cadence options (won clients)
export const CADENZA_OPZIONI = [
  { v: '', label: 'Nessuna' },
  { v: 30, label: 'Ogni 30 giorni' },
  { v: 60, label: 'Ogni 60 giorni' },
  { v: 90, label: 'Ogni 90 giorni' },
  { v: 180, label: 'Ogni 6 mesi' },
];
export const ACTIVITY_TIPO_META = {
  chiamata: { label: 'Chiamata', badge: 'bg-blue-100 text-blue-800', icon: '📞' },
  whatsapp: { label: 'WhatsApp', badge: 'bg-green-100 text-green-800', icon: '💬' },
  instagram: { label: 'Instagram', badge: 'bg-pink-100 text-pink-800', icon: '📷' },
  email: { label: 'Email', badge: 'bg-violet-100 text-violet-800', icon: '✉️' },
  meeting: { label: 'Meeting', badge: 'bg-emerald-100 text-emerald-800', icon: '🤝' },
  nota: { label: 'Nota', badge: 'bg-slate-100 text-slate-700', icon: '📝' },
  altro: { label: 'Altro', badge: 'bg-amber-100 text-amber-800', icon: '•' },
};

/** Local date YYYY-MM-DD (today). */
export function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/** Format YYYY-MM-DD → DD/MM/YYYY for display. */
export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).split('-');
  return d ? `${d}/${m}/${y}` : dateStr;
}

/** Add n days to a YYYY-MM-DD date (local), returns YYYY-MM-DD. */
export function addDaysISO(iso, n) {
  const base = iso || todayISO();
  const [y, m, d] = String(base).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

/** Follow-up status relative to today (drives colour + label). */
export function followupStatus(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((target - today) / 86400000);
  if (days < 0)
    return { days, key: 'overdue', label: days === -1 ? 'Ieri' : `${Math.abs(days)}g fa`, dot: 'bg-rose-500', text: 'text-rose-600' };
  if (days === 0) return { days, key: 'today', label: 'Oggi', dot: 'bg-amber-500', text: 'text-amber-600' };
  if (days === 1) return { days, key: 'soon', label: 'Domani', dot: 'bg-blue-500', text: 'text-blue-600' };
  if (days <= 7) return { days, key: 'soon', label: `Tra ${days}g`, dot: 'bg-blue-500', text: 'text-blue-600' };
  return { days, key: 'future', label: `Tra ${days}g`, dot: 'bg-slate-400', text: 'text-slate-500' };
}
