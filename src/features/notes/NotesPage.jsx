import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

const RENKLER = {
  pink: { bg: '#ffebf0', text: 'var(--color-primary)' },
  mint: { bg: 'var(--color-mint-soft)', text: 'var(--color-mint-vibrant)' },
  yellow: { bg: 'var(--color-tertiary-fixed)', text: 'var(--color-brown-earth)' },
};

const KATEGORILER = [
  { deger: 'sevgi', etiket: 'Sevgi Notu' },
  { deger: 'plan', etiket: 'Plan' },
  { deger: 'surpriz', etiket: 'Sürpriz' },
];

const FILTRELER = [
  { deger: 'tumu', etiket: 'Tümü' },
  { deger: 'sevgi', etiket: 'Sevgi Notları' },
  { deger: 'plan', etiket: 'Planlar' },
  { deger: 'surpriz', etiket: 'Sürprizler' },
  { deger: 'pin', etiket: '📌 Pinlenenler' },
];

export default function NotesPage() {
  const { user } = useAuth();
  const { coupleId, uyeler, partner } = useCouple();

  const [notlar, setNotlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [filtre, setFiltre] = useState('tumu');

  const [yaziyor, setYaziyor] = useState(false);
  const [metin, setMetin] = useState('');
  const [renk, setRenk] = useState('pink');
  const [kategori, setKategori] = useState('sevgi');
  const [pinli, setPinli] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const isimler = {};
  uyeler.forEach((u) => { isimler[u.id] = u.display_name || 'İsimsiz'; });

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('notes')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Notlar yüklenemedi. Bağlantını kontrol et.');
        else setNotlar(data ?? []);
        setYukleniyor(false);
      });

    const kanal = supabase
      .channel(`notlar:${coupleId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notes', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setNotlar((e) => (e.some((n) => n.id === yeni.id) ? e : [yeni, ...e])))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notes', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setNotlar((e) => e.map((n) => (n.id === yeni.id ? yeni : n))))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notes', filter: `couple_id=eq.${coupleId}` },
        ({ old }) => setNotlar((e) => e.filter((n) => n.id !== old.id)))
      .subscribe();

    return () => { iptal = true; supabase.removeChannel(kanal); };
  }, [coupleId]);

  async function gonder() {
    const temiz = metin.trim();
    if (!temiz) return;

    setGonderiliyor(true);
    setHata(null);

    const { data, error } = await supabase
      .from('notes')
      .insert({ couple_id: coupleId, author_id: user.id, body: temiz, renk, kategori, pinli })
      .select()
      .single();

    setGonderiliyor(false);

    if (error) { setHata('Not kaydedilemedi. Tekrar dene.'); return; }

    setNotlar((e) => (e.some((n) => n.id === data.id) ? e : [data, ...e]));
    setMetin('');
    setPinli(false);
    setYaziyor(false);
  }

  async function sil(id) {
    setNotlar((e) => e.filter((n) => n.id !== id));
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) setHata('Not silinemedi.');
  }

  async function pinToggle(not) {
    const guncel = !not.pinli;
    setNotlar((e) => e.map((n) => (n.id === not.id ? { ...n, pinli: guncel } : n)));
    await supabase.from('notes').update({ pinli: guncel }).eq('id', not.id);
  }

  async function begenToggle(not) {
    const beğendimMi = not.begenenler.includes(user.id);
    const guncel = beğendimMi
      ? not.begenenler.filter((id) => id !== user.id)
      : [...not.begenenler, user.id];
    setNotlar((e) => e.map((n) => (n.id === not.id ? { ...n, begenenler: guncel } : n)));
    await supabase.from('notes').update({ begenenler: guncel }).eq('id', not.id);
  }

  const tarih = (iso) => new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

  const filtrelenmis = notlar
    .filter((n) => {
      if (filtre === 'tumu') return true;
      if (filtre === 'pin') return n.pinli;
      return n.kategori === filtre;
    })
    .sort((a, b) => (b.pinli === a.pinli ? 0 : b.pinli ? 1 : -1));

  return (
    <>
      <header className="space-y-1">
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">Notlar</p>
        <h1 className="text-headline-lg-mobile text-on-surface">Aşk Notlarımız 💌</h1>
        <p className="text-body-sm text-text-muted">
          {notlar.length > 0
            ? `${notlar.length} not · ${partner?.display_name || 'Partnerin'} ile ortak`
            : 'Buraya bıraktığınız her şey ikinizde de görünür.'}
        </p>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-space-md px-space-md">
        {FILTRELER.map((f) => (
          <button
            key={f.deger}
            onClick={() => setFiltre(f.deger)}
            className={
              'px-3.5 py-1.5 rounded-full text-label-tab whitespace-nowrap transition-all ' +
              (filtre === f.deger ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-card text-on-surface-variant')
            }
          >
            {f.etiket}
          </button>
        ))}
      </div>

      <button
        onClick={() => setYaziyor(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary hover:bg-primary-dark text-on-primary text-label-button shadow-md active:scale-[0.98] transition-all"
      >
        <span className="material-symbols-outlined text-[20px]">edit_note</span>
        Yeni Not Bırak
      </button>

      {hata && <div className="bg-surface-card rounded-xl p-space-md text-primary text-body-sm">{hata}</div>}

      {yukleniyor ? (
        <p className="text-body-sm text-text-muted">Yükleniyor…</p>
      ) : filtrelenmis.length === 0 ? (
        <div className="bg-surface-card rounded-xl p-space-2xl text-center">
          <h3 className="text-headline-sm text-on-surface">Pano boş</h3>
          <p className="text-body-sm text-text-muted mt-1">Yukarıdaki butondan ilk notu ekle.</p>
        </div>
      ) : (
        <div className="space-y-space-md">
          {filtrelenmis.map((n) => {
            const benim = n.author_id === user.id;
            const renkler = RENKLER[n.renk] ?? RENKLER.pink;
            const beğendimMi = n.begenenler?.includes(user.id);
            return (
              <article
                key={n.id}
                className="relative rounded-xl p-space-lg shadow-sm"
                style={{ background: renkler.bg }}
              >
                {n.pinli && (
                  <div className="absolute -top-2.5 left-6 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      push_pin
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between mb-space-sm pt-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-body-sm font-bold flex-shrink-0">
                      {(benim ? 'Sen' : isimler[n.author_id] || 'P')[0]}
                    </div>
                    <div>
                      <span className="text-body-sm font-bold text-on-surface block leading-tight">
                        {benim ? 'Sen' : isimler[n.author_id] || 'Partner'}
                      </span>
                      <span className="text-[11px] text-text-muted">{tarih(n.created_at)}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-card/70 text-[11px] font-bold uppercase" style={{ color: renkler.text }}>
                    {KATEGORILER.find((k) => k.deger === n.kategori)?.etiket ?? n.kategori}
                  </span>
                </div>

                <p className="text-body-base text-on-surface whitespace-pre-wrap">{n.body}</p>

                <div className="flex items-center justify-between mt-space-md pt-space-sm border-t border-hairline">
                  <button
                    onClick={() => begenToggle(n)}
                    className="flex items-center gap-1 text-primary text-label-tab"
                  >
                    <span className="material-symbols-outlined text-[18px]" style={beğendimMi ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                      favorite
                    </span>
                    {n.begenenler?.length ?? 0}
                  </button>

                  <div className="flex items-center gap-1">
                    <button onClick={() => pinToggle(n)} className="p-1.5 text-text-muted" aria-label="Pinle">
                      <span className="material-symbols-outlined text-[18px]" style={n.pinli ? { fontVariationSettings: "'FILL' 1", color: 'var(--color-primary)' } : undefined}>
                        push_pin
                      </span>
                    </button>
                    {benim && (
                      <button onClick={() => sil(n.id)} className="p-1.5 text-text-muted" aria-label="Sil">
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {yaziyor && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/40 backdrop-blur-sm"
          onClick={() => setYaziyor(false)}
        >
          <div
            className="w-full bg-surface-card rounded-t-3xl p-space-xl space-y-space-md max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-headline-md text-on-surface">Yeni not</h2>
              <button onClick={() => setYaziyor(false)} aria-label="Kapat" className="text-text-muted">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div>
              <label className="text-label-eyebrow text-text-muted uppercase block mb-1.5">Zemin Rengi</label>
              <div className="flex items-center gap-2">
                {Object.entries(RENKLER).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setRenk(k)}
                    className="w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: v.bg, boxShadow: renk === k ? `0 0 0 2px var(--color-primary)` : 'none' }}
                    aria-label={k}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-label-eyebrow text-text-muted uppercase block mb-1.5">Kategori</label>
              <div className="flex flex-wrap gap-2">
                {KATEGORILER.map((k) => (
                  <button
                    key={k.deger}
                    onClick={() => setKategori(k.deger)}
                    className={
                      'px-3.5 py-1.5 rounded-full text-label-tab ' +
                      (kategori === k.deger ? 'bg-primary text-on-primary' : 'bg-surface-soft text-on-surface-variant')
                    }
                  >
                    {k.etiket}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              autoFocus
              rows={4}
              value={metin}
              onChange={(e) => setMetin(e.target.value)}
              placeholder="Sena'ya/Burak'a sıcacık bir cümle bırak…"
              className="w-full p-space-md rounded-xl bg-surface-soft text-on-surface text-body-base placeholder:text-text-faint outline-none resize-none"
            />

            <label className="flex items-center gap-2 cursor-pointer select-none w-full">
              <input type="checkbox" checked={pinli} onChange={(e) => setPinli(e.target.checked)} className="accent-primary w-4 h-4 flex-shrink-0" />
              <span className="text-body-sm text-on-surface-variant min-w-0">Panonun en üstüne iğnele</span>
            </label>

            <button
              onClick={gonder}
              disabled={gonderiliyor || !metin.trim()}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary-dark disabled:opacity-50 text-on-primary text-label-button shadow-md transition-all"
            >
              {gonderiliyor ? 'Ekleniyor…' : 'Notu İğnele'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
