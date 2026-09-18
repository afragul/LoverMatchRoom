import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useCouple } from '../../context/CoupleContext';

export default function ChatPage() {
  const { user } = useAuth();
  const { coupleId, partner } = useCouple();

  const [mesajlar, setMesajlar] = useState([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(null);
  const [metin, setMetin] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const dipRef = useRef(null);

  useEffect(() => {
    if (!coupleId) return;
    let iptal = false;

    supabase
      .from('messages')
      .select('*')
      .eq('couple_id', coupleId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (iptal) return;
        if (error) setHata('Mesajlar yüklenemedi. Bağlantını kontrol et.');
        else setMesajlar(data ?? []);
        setYukleniyor(false);
      });

    const kanal = supabase
      .channel(`mesajlar:${coupleId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` },
        ({ new: yeni }) => setMesajlar((e) => (e.some((m) => m.id === yeni.id) ? e : [...e, yeni])))
      .subscribe();

    return () => { iptal = true; supabase.removeChannel(kanal); };
  }, [coupleId]);

  // yeni mesaj gelince en alta kay
  useEffect(() => {
    dipRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mesajlar.length]);

  async function gonder() {
    const temiz = metin.trim();
    if (!temiz) return;

    setMetin('');
    setGonderiliyor(true);
    setHata(null);

    const { data, error } = await supabase
      .from('messages')
      .insert({ couple_id: coupleId, sender_id: user.id, body: temiz })
      .select()
      .single();

    setGonderiliyor(false);

    if (error) { setHata('Mesaj gönderilemedi. Tekrar dene.'); setMetin(temiz); return; }

    setMesajlar((e) => (e.some((m) => m.id === data.id) ? e : [...e, data]));
  }

  function tuslama(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      gonder();
    }
  }

  const saat = (iso) => new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-[calc(100dvh-13rem)]">
      <header className="space-y-1 mb-space-md flex-shrink-0">
        <p className="text-label-eyebrow text-primary uppercase tracking-widest">Sohbet</p>
        <h1 className="text-headline-lg-mobile text-on-surface">
          {partner?.display_name || 'Partnerin'} ile Sohbet 💬
        </h1>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-space-sm pr-1">
        {yukleniyor ? (
          <p className="text-body-sm text-text-muted">Yükleniyor…</p>
        ) : mesajlar.length === 0 ? (
          <div className="bg-surface-card rounded-xl p-space-2xl text-center">
            <h3 className="text-headline-sm text-on-surface">Henüz mesaj yok</h3>
            <p className="text-body-sm text-text-muted mt-1">Aşağıdan ilk mesajı gönder.</p>
          </div>
        ) : (
          mesajlar.map((m) => {
            const benim = m.sender_id === user.id;
            return (
              <div key={m.id} className={'flex ' + (benim ? 'justify-end' : 'justify-start')}>
                <div
                  className={
                    'max-w-[75%] rounded-2xl px-space-md py-2.5 shadow-sm ' +
                    (benim
                      ? 'bg-primary text-on-primary rounded-br-sm'
                      : 'bg-surface-card text-on-surface rounded-bl-sm')
                  }
                >
                  <p className="text-body-base whitespace-pre-wrap break-words">{m.body}</p>
                  <span
                    className={
                      'block text-[10px] mt-1 text-right ' +
                      (benim ? 'text-on-primary/70' : 'text-text-faint')
                    }
                  >
                    {saat(m.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={dipRef} />
      </div>

      {hata && <div className="bg-surface-card rounded-xl p-space-md text-primary text-body-sm mt-space-sm flex-shrink-0">{hata}</div>}

      <div className="flex items-end gap-2 mt-space-sm flex-shrink-0">
        <textarea
          rows={1}
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          onKeyDown={tuslama}
          placeholder="Bir mesaj yaz…"
          className="flex-1 max-h-28 p-space-md rounded-xl bg-surface-soft text-on-surface text-body-base placeholder:text-text-faint outline-none resize-none"
        />
        <button
          onClick={gonder}
          disabled={gonderiliyor || !metin.trim()}
          aria-label="Gönder"
          className="w-11 h-11 flex-shrink-0 grid place-items-center rounded-full bg-primary hover:bg-primary-dark disabled:opacity-50 text-on-primary shadow-md transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">send</span>
        </button>
      </div>
    </div>
  );
}
