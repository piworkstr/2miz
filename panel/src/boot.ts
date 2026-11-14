// Firebase ayarı barındırmanın kendi adresinden okunur; depoda anahtar tutulmaz.
(async () => {
  try {
    const res = await fetch('/__/firebase/init.json');
    if (!res.ok) throw new Error(String(res.status));
    (globalThis as { __FB?: unknown }).__FB = await res.json();
    await import('./app');
  } catch (e) {
    const root = document.getElementById('root');
    if (root) root.innerHTML = '<p class="boot">Panel açılamadı. Bağlantıyı kontrol edip sayfayı yenileyin.</p>';
    console.error(e);
  }
})();
