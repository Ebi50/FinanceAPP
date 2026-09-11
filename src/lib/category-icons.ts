/**
 * Ordnet Kategorienamen den 3D-Glossy-Icons unter public/category-icons/ zu.
 * Kategorien tragen eine angehängte Ordnungsnummer (z. B. "Auto 5"), die sich
 * jederzeit ändern kann — deshalb wird sie vor dem Abgleich abgeschnitten.
 * Bricht wie die Einnahmen-Erkennung in categories-context bewusst nur bei
 * einer echten Umbenennung der Kategorie.
 */
const CATEGORY_ICON_FILES: Record<string, string> = {
  auto: '01_auto.png',
  einnahmen: '02_einnahmen.png',
  'freize./geschenke': '03_freizeit_geschenke.png',
  garten: '04_garten.png',
  haushalt: '05_haushalt.png',
  kinder: '06_kinder.png',
  kleidung: '07_kleidung.png',
  körperpflege: '08_koerperpflege.png',
  kv: '09_kv.png',
  lebensmittel: '10_lebensmittel.png',
  radsport: '11_radsport.png',
  'telefon/büro': '12_telefon_buero.png',
  'zeitschr./bücher': '13_zeitschriften_buecher.png',
};

export function getCategoryIconSrc(categoryName: string | undefined | null): string | null {
  if (!categoryName) return null;
  const key = categoryName.trim().replace(/\s+\d+$/, '').toLowerCase();
  const file = CATEGORY_ICON_FILES[key];
  return file ? `/category-icons/${file}` : null;
}
