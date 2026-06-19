// Shared domain constants (kept in sync with client/src/lib/constants.js)

export const COMMERCIALI = ['Laura', 'Massimo', 'Gabriele'];

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

// Login email -> commerciale enum value.
// Both the seeded login accounts (@cafezal.com) and the real-address aliases
// (@cafezal.it) resolve to the same commercial, so either can be used to log in.
export const EMAIL_TO_COMMERCIALE = {
  'laura@cafezal.com': 'Laura',
  'l.magnago@cafezal.it': 'Laura',
  'massimo@cafezal.com': 'Massimo',
  'm.rotunno@cafezal.it': 'Massimo',
  'gabriele@cafezal.com': 'Gabriele',
  'sales@cafezal.it': 'Gabriele',
};

// commerciale -> real inbox (used by the reminder + monthly report jobs).
export const COMMERCIALE_TO_EMAIL = {
  Laura: 'l.magnago@cafezal.it',
  Massimo: 'm.rotunno@cafezal.it',
  Gabriele: 'sales@cafezal.it',
};

// Phases that are already finalized — excluded from "due soon" reminders.
export const CLOSED_FASI = ['Chiuso', 'K.O.'];

// ─── Torrefazione / Retail roles ───
export const TORREFAZIONE_EMAILS = ['torrefazione@cafezal.it'];

// Store login email → store name (Navigli / Gae Aulenti: TBD, no login yet)
export const STORE_EMAIL_TO_NEGOZIO = {
  'coffeehub@cafezal.it': 'Premuda',
  'solferino@cafezal.it': 'Solferino',
  'magenta@cafezal.it': 'Magenta',
  'sangregorio@cafezal.it': 'San Gregorio',
  'bicocca@cafezal.it': 'Bicocca',
};

// Activity timeline entry types (manual log: calls, emails, meetings, notes).
export const ACTIVITY_TIPI = ['chiamata', 'whatsapp', 'instagram', 'email', 'meeting', 'nota', 'altro'];

// Coffee sample outcomes.
export const SAMPLE_ESITI = ['in_attesa', 'convertito', 'non_convertito'];

// Win probability per phase → weighted pipeline / forecast (Pipedrive-style).
export const FASE_PROBABILITA = {
  Lead: 0.1,
  Contattato: 0.25,
  'In trattativa': 0.5,
  Proposta: 0.75,
  Chiuso: 1,
  'K.O.': 0,
};
