// Shared domain constants (kept in sync with client/src/lib/constants.js)

export const COMMERCIALI = ['Laura', 'Massimo', 'Gabriele'];

export const FASI = ['Lead', 'Contattato', 'In trattativa', 'Proposta', 'Chiuso', 'K.O.'];

export const SENSIBILITY = ['low', 'mid', 'high'];

// Login email -> commerciale enum value
export const EMAIL_TO_COMMERCIALE = {
  'laura@cafezal.com': 'Laura',
  'massimo@cafezal.com': 'Massimo',
  'gabriele@cafezal.com': 'Gabriele',
};

// commerciale -> email (used by the reminder job)
export const COMMERCIALE_TO_EMAIL = {
  Laura: 'laura@cafezal.com',
  Massimo: 'massimo@cafezal.com',
  Gabriele: 'gabriele@cafezal.com',
};

// Phases that are already finalized — excluded from "due soon" reminders.
export const CLOSED_FASI = ['Chiuso', 'K.O.'];
