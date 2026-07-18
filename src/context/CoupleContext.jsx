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
  const [baslangic, setBaslangic] = useState(null); // ilişki başlangıcı
  const [partnerAktif, setPartnerAktif] = useState(false);
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

    const { data: satirlar } = await supabase
      .from('couple_members')
      .select('user_id, joined_at')
      .eq('couple_id', cid)
      .order('joined_at', { ascending: true });

    const idler = (satirlar ?? []).map((s) => s.user_id);

    const { data: profiller } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', idler);

    setUyeler(
      idler.map((id) => (profiller ?? []).find((p) => p.id === id)).filter(Boolean)
    );

    setLoading(false);
  }, [user]);

  useEffect(() => { yenile(); }, [yenile]);

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
    };
  }, [coupleId, user]);

  /* ---------------- yazma işlemleri ---------------- */
  async function odaIsmiKaydet(yeniIsim) {
    const temiz = (yeniIsim ?? '').trim();
    const { error } = await supabase
      .from('couples')
      .update({ name: temiz || null })
      .eq('id', coupleId);
    if (!error) setOdaIsmi(temiz || null);
    return error;
  }

  async function baslangicKaydet(tarih) {
    const { error } = await supabase
      .from('couples')
      .update({ started_at: tarih || null })
      .eq('id', coupleId);
    if (!error) setBaslangic(tarih || null);
    return error;
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
    baslangic, baslangicKaydet, gunSayisi,
    partnerAktif, loading, yenile,
  };

  return <CoupleContext.Provider value={value}>{children}</CoupleContext.Provider>;
}

export function useCouple() {
  const ctx = useContext(CoupleContext);
  if (!ctx) throw new Error('useCouple CoupleProvider içinde kullanılmalı');
  return ctx;
}