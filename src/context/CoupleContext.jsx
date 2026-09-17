import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const CoupleContext = createContext(null);

export function CoupleProvider({ children }) {
  const { user } = useAuth();

  const [coupleId, setCoupleId] = useState(null);
  const [uyeler, setUyeler]     = useState([]);   // [{ id, display_name }]
  const [odaIsmi, setOdaIsmi]   = useState(null); // couples.name
  const [baslangic, setBaslangic] = useState(null); // ilişki başlangıcı (yoksa oda kurulum tarihi)
  const [baslangicAyarliMi, setBaslangicAyarliMi] = useState(false); // gerçekten kullanıcı mı girdi
  const [partnerAktif, setPartnerAktif] = useState(false);
  const [partnerSayfa, setPartnerSayfa] = useState(null);
  const [loading, setLoading]   = useState(true);

  const kanalRef = useRef(null);

  /* ---------------- veriyi çek ---------------- */
  const yenile = useCallback(async () => {
    if (!user) {
      setCoupleId(null); setUyeler([]); setOdaIsmi(null);
      setBaslangic(null); setLoading(false);
      return;
    }

    setLoading(true);

    const { data: uyelik } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const cid = uyelik?.couple_id ?? null;
    setCoupleId(cid);

    if (!cid) {
      setUyeler([]); setOdaIsmi(null); setBaslangic(null);
      setLoading(false);
      return;
    }

    const { data: oda } = await supabase
      .from('couples')
      .select('name, started_at, created_at')
      .eq('id', cid)
      .maybeSingle();

    setOdaIsmi(oda?.name ?? null);
    setBaslangic(oda?.started_at ?? oda?.created_at ?? null);
    setBaslangicAyarliMi(!!oda?.started_at);

    const { data: satirlar } = await supabase
      .from('couple_members')
      .select('user_id, joined_at')
      .eq('couple_id', cid)
      .order('joined_at', { ascending: true });

    const idler = (satirlar ?? []).map((s) => s.user_id);

    const { data: profiller } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', idler);

    setUyeler(
      idler.map((id) => (profiller ?? []).find((p) => p.id === id)).filter(Boolean)
    );

    setLoading(false);
  }, [user]);

  useEffect(() => { yenile(); }, [yenile]);

  /* ---------------- oda bilgisi canlı senkron ---------------- */
  useEffect(() => {
    if (!coupleId) return;

    const kanal = supabase
      .channel(`couples:${coupleId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` },
        ({ new: yeni }) => {
          setOdaIsmi(yeni.name ?? null);
          setBaslangic(yeni.started_at ?? yeni.created_at ?? null);
          setBaslangicAyarliMi(!!yeni.started_at);
        })
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  /* ---------------- profil (isim/foto) canlı senkron ---------------- */
  useEffect(() => {
    if (!coupleId) return;

    const kanal = supabase
      .channel(`profiles:${coupleId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        ({ new: yeni }) => {
          setUyeler((e) => e.map((u) => (u.id === yeni.id
            ? { ...u, display_name: yeni.display_name, avatar_url: yeni.avatar_url }
            : u)));
        })
      .subscribe();

    return () => supabase.removeChannel(kanal);
  }, [coupleId]);

  /* ---------------- çevrimiçi durumu (presence) ---------------- */
  useEffect(() => {
    if (!coupleId || !user) return;

    const kanal = supabase.channel(`oda:${coupleId}`, {
      config: { presence: { key: user.id } },
    });

    const guncelle = () => {
      const durum = kanal.presenceState();
      const kimler = Object.keys(durum);
      setPartnerAktif(kimler.some((k) => k !== user.id));

      const partnerKaydi = Object.entries(durum).find(([kim]) => kim !== user.id);
      setPartnerSayfa(partnerKaydi?.[1]?.[0]?.sayfa ?? null);
    };

    kanal
      .on('presence', { event: 'sync' }, guncelle)
      .on('presence', { event: 'join' }, guncelle)
      .on('presence', { event: 'leave' }, guncelle)
      .subscribe(async (durum) => {
        if (durum === 'SUBSCRIBED') {
          await kanal.track({ girdi: new Date().toISOString() });
        }
      });

    kanalRef.current = kanal;

    return () => {
      supabase.removeChannel(kanal);
      kanalRef.current = null;
      setPartnerAktif(false);
      setPartnerSayfa(null);
    };
  }, [coupleId, user]);

  const sayfaBildir = useCallback((sayfa) => {
    kanalRef.current?.track({ girdi: new Date().toISOString(), sayfa });
  }, []);

  /* ---------------- yazma işlemleri ----------------
     .select().maybeSingle() ile: RLS satırı sessizce filtrelerse
     (0 satır güncellenirse) bunu da hata say, sessizce yutma. */
  async function coupleGuncelle(alanlar) {
    const { data, error } = await supabase
      .from('couples')
      .update(alanlar)
      .eq('id', coupleId)
      .select()
      .maybeSingle();

    if (error) { console.error('Oda güncellenemedi:', error); return error; }
    if (!data) {
      const hata = new Error('Oda güncellenemedi (satır bulunamadı veya izin yok).');
      console.error(hata.message);
      return hata;
    }
    return data;
  }

  async function odaIsmiKaydet(yeniIsim) {
    const temiz = (yeniIsim ?? '').trim();
    const sonuc = await coupleGuncelle({ name: temiz || null });
    if (sonuc instanceof Error) return sonuc;
    setOdaIsmi(sonuc.name ?? null);
    return null;
  }

  async function baslangicKaydet(tarih) {
    const sonuc = await coupleGuncelle({ started_at: tarih || null });
    if (sonuc instanceof Error) return sonuc;
    setBaslangic(sonuc.started_at ?? null);
    setBaslangicAyarliMi(!!sonuc.started_at);
    return null;
  }

  /* ---------------- türetilmiş değerler ---------------- */
  const isimler = uyeler.map((u) => u.display_name || 'İsimsiz');
  const odaAdi  = odaIsmi || isimler.join(' & ') || 'Odanız';
  const partner = uyeler.find((u) => u.id !== user?.id) ?? null;
  const ben     = uyeler.find((u) => u.id === user?.id) ?? null;

  const gunSayisi = baslangic
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(baslangic).getTime()) / 86400000)
      )
    : null;

  const value = {
    coupleId, uyeler, isimler, ben, partner,
    odaAdi, odaIsmi, odaIsmiKaydet,
    baslangic, baslangicAyarliMi, baslangicKaydet, gunSayisi,
    partnerAktif, partnerSayfa, sayfaBildir, loading, yenile,
  };

  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCouple() {
  const ctx = useContext(CoupleContext);
  if (!ctx) throw new Error('useCouple CoupleProvider içinde kullanılmalı');
  return ctx;
}