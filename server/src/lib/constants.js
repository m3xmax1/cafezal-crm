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
  'laura@cafezal.it': 'Laura',
  'massimo@cafezal.com': 'Massimo',
  'm.rotunno@cafezal.it': 'Massimo',
  'gabriele@cafezal.com': 'Gabriele',
  'sales@cafezal.it': 'Gabriele',
};

// commerciale -> real inbox (used by the reminder + monthly report jobs).
export const COMMERCIALE_TO_EMAIL = {
  Laura: 'laura@cafezal.it', // placeholder finché Laura non fornisce l'indirizzo definitivo
  Massimo: 'm.rotunno@cafezal.it',
  Gabriele: 'sales@cafezal.it',
};

// Phases that are already finalized — excluded from "due soon" reminders.
export const CLOSED_FASI = ['Chiuso', 'K.O.'];

// Activity timeline entry types (manual log: calls, emails, meetings, notes).
export const ACTIVITY_TIPI = ['chiamata', 'email', 'meeting', 'nota', 'altro'];
