-- DiFluid: livello di tostatura + numero lotto.
alter table caffe_difluid
  add column if not exists roast_level text,
  add column if not exists n_lotto     text;

notify pgrst, 'reload schema';
