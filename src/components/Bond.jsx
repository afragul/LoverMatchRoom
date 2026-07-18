/* =====================================================================
   Bond — uygulamanın imza öğesi.
   İki avatar iç içe geçer; ikisi de çevrimiçiyse dış halka
   yavaşça nefes alır. Tek "cesur" görsel öğe bu, gerisi sakin.
   ===================================================================== */

function bashHarf(isim) {
  return (isim || '?').trim().charAt(0).toLocaleUpperCase('tr-TR');
}

// isimden sabit bir ton üret (aynı kişi hep aynı renkte görünsün)
function tonlar(isim) {
  const paletler = [
    ['#FDA6AB', '#D24558'],
    ['#C6E9C8', '#61A07D'],
    ['#FAC977', '#B4801F'],
  ];
  const kod = (isim || '?').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return paletler[kod % paletler.length];
}

export function Avatar({ isim, boyut = 44 }) {
  const [zemin, yazi] = tonlar(isim);
  return (
    <div
      style={{
        width: boyut,
        height: boyut,
        borderRadius: '50%',
        background: zemin,
        color: yazi,
        display: 'grid',
        placeItems: 'center',
        fontWeight: 800,
        fontSize: boyut * 0.4,
        border: '3px solid #fff',
        flexShrink: 0,
      }}
    >
      {bashHarf(isim)}
    </div>
  );
}

export function Bond({ isimler = [], boyut = 88, canli = false }) {
  const [a, b] = isimler;
  const ortu = boyut * 0.26;

  return (
    <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
      {/* nefes alan halka */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: boyut * 2 - ortu + 34,
          height: boyut + 34,
          borderRadius: 999,
          border: `1.5px solid ${canli ? 'var(--green)' : 'var(--hairline)'}`,
          opacity: canli ? 0.5 : 0.7,
          animation: canli ? 'nefes 3.6s ease-in-out infinite' : 'none',
        }}
      />

      <div style={{ display: 'flex', marginRight: -ortu }}>
        <Avatar isim={a} boyut={boyut} />
        <div style={{ marginLeft: -ortu }}>
          <Avatar isim={b} boyut={boyut} />
        </div>
      </div>

      <style>{`
        @keyframes nefes {
          0%, 100% { transform: scale(1);    opacity: 0.35; }
          50%      { transform: scale(1.04); opacity: 0.65; }
        }
      `}</style>
    </div>
  );
}