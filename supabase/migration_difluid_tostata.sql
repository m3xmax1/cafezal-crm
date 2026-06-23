-- DiFluid — sezione "tostata": Omni color (chicco intero / macinato), micron
-- macinatura, dose bevanda, ratio, TDS. (roast_level già presente, spostato qui in UI.)
alter table caffe_difluid
  add column if not exists omni_chicco   numeric,
  add column if not exists omni_macinato numeric,
  add column if not exists micron        numeric,
  add column if not exists dose_bevanda  numeric,
  add column if not exists ratio         text,
  add column if not exists tds           numeric;

notify pgrst, 'reload schema';
