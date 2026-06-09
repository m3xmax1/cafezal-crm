// Shared domain constants (kept in sync with server/src/lib/constants.js)

export const COMMERCIALI = ['Laura', 'Massimo', 'Gabriele'];

export const FASI = ['Lead', 'Contattato', 'In trattativa', 'Proposta', 'Chiuso', 'K.O.'];

export const SENSIBILITY = ['low', 'mid', 'high'];

export const EMAIL_TO_COMMERCIALE = {
  'laura@cafezal.com': 'Laura',
  'massimo@cafezal.com': 'Massimo',
  'gabriele@cafezal.com': 'Gabriele',
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
