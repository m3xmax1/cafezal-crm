import {
  assertCassaRead, getDaily, getAnalisi, syncRange, runCassaSync,
  buildXlsxExport, buildCsvExport, getExportKey,
} from '../services/cassa.service.js';

export async function daily(req, res, next) {
  try {
    assertCassaRead(req.user);
    res.json(await getDaily({ from: req.query.from, to: req.query.to }));
  } catch (e) { next(e); }
}

export async function analisi(req, res, next) {
  try {
    assertCassaRead(req.user);
    res.json(await getAnalisi({ from: req.query.from || undefined }));
  } catch (e) { next(e); }
}

export async function sync(req, res, next) {
  try {
    assertCassaRead(req.user); // admin + finance possono aggiornare
    const { from, to, days } = req.body || {};
    const result = from && to ? await syncRange({ from, to }) : await runCassaSync({ days: Number(days) || 3 });
    res.json({ ok: true, ...result });
  } catch (e) { next(e); }
}

export async function exportXlsx(req, res, next) {
  try {
    assertCassaRead(req.user);
    const buf = await buildXlsxExport({ from: req.query.from || undefined });
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="cassa-cafezal-${today}.xlsx"`);
    res.send(buf);
  } catch (e) { next(e); }
}

/** CSV keyed per Google Sheets (IMPORTDATA non può mandare header di auth). */
export async function exportCsv(req, res, next) {
  try {
    const expected = await getExportKey();
    if (!expected || String(req.query.key || '') !== expected) {
      return res.status(404).json({ error: 'Not found' });
    }
    const csv = await buildCsvExport({ tipo: req.query.tipo === 'settimanale' ? 'settimanale' : 'giornaliero' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(csv);
  } catch (e) { return next(e); }
}

/** Config per la pagina (mostra la formula IMPORTDATA ad admin/finance). */
export async function cassaConfig(req, res, next) {
  try {
    assertCassaRead(req.user);
    res.json({ exportKey: await getExportKey() });
  } catch (e) { next(e); }
}
