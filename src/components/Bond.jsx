/* =====================================================================
   Bond — uygulamanın imza öğesi. İki avatar iç içe geçer.
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

export function Avatar({ isim, boyut = 44, aktif, fotoUrl }) {
  const [zemin, yazi] = tonlar(isim);
  const noktaBoyut = Math.max(10, boyut * 0.22);

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
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
          overflow: 'hidden',
        }}
      >
        {fotoUrl ? (
          <img src={fotoUrl} alt={isim || 'Avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          bashHarf(isim)
        )}
      </div>

      {aktif !== undefined && (
        <span
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: noktaBoyut,
            height: noktaBoyut,
            borderRadius: '50%',
            background: aktif ? 'var(--green)' : 'var(--text-faint)',
            border: '2px solid #fff',
          }}
        />
      )}
    </div>
  );
}

export function Bond({ isimler = [], fotoUrlleri = [], boyut = 88, partnerAktif }) {
  const [a, b] = isimler;
  const [fotoA, fotoB] = fotoUrlleri;
  const ortu = boyut * 0.26;

  return (
    <div style={{ display: 'flex', marginRight: -ortu }}>
      <Avatar isim={a} boyut={boyut} fotoUrl={fotoA} />
      <div style={{ marginLeft: -ortu }}>
        <Avatar isim={b} boyut={boyut} aktif={partnerAktif} fotoUrl={fotoB} />
      </div>
    </div>
  );
}