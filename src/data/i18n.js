export const LANGS = [
  { id: 'en', name: 'English', dir: 'ltr' },
  { id: 'tr', name: 'Türkçe', dir: 'ltr' },
  { id: 'fr', name: 'Français', dir: 'ltr' },
  { id: 'ar', name: 'العربية', dir: 'rtl' },
]

const T = {
  // Header
  corridorPlanner: { en:'CORRIDOR PLANNER', tr:'KORİDOR PLANLAYICI', fr:'PLANIFICATEUR DE CORRIDOR', ar:'مخطط الممر' },
  sharedView: { en:'SHARED VIEW', tr:'PAYLAŞILAN GÖRÜNÜM', fr:'VUE PARTAGÉE', ar:'عرض مشترك' },
  // Search
  searchEvents: { en:'Search events...', tr:'Olayları ara...', fr:'Rechercher...', ar:'بحث...' },
  noEvents: { en:'No events', tr:'Olay yok', fr:'Aucun événement', ar:'لا توجد أحداث' },
  // Tabs
  map: { en:'MAP', tr:'HARİTA', fr:'CARTE', ar:'خريطة' },
  flow: { en:'FLOW', tr:'AKIŞ', fr:'FLUX', ar:'تدفق' },
  overview: { en:'Overview', tr:'Genel Bakış', fr:'Aperçu', ar:'نظرة عامة' },
  incidents: { en:'Incidents', tr:'Olaylar', fr:'Incidents', ar:'حوادث' },
  ai: { en:'AI', tr:'AI', fr:'IA', ar:'ذكاء' },
  notebook: { en:'Notebook', tr:'Notlar', fr:'Notes', ar:'ملاحظات' },
  // Layers
  noAccess: { en:'No-Access', tr:'Erişim Yok', fr:'Interdit', ar:'محظور' },
  risks: { en:'Risks', tr:'Riskler', fr:'Risques', ar:'مخاطر' },
  corridor: { en:'Corridor', tr:'Koridor', fr:'Corridor', ar:'ممر' },
  // Briefs
  addBrief: { en:'Add Brief', tr:'Brifing Ekle', fr:'Ajouter', ar:'إضافة' },
  analyzeMap: { en:'🤖 Analyze & Map', tr:'🤖 Analiz & Harita', fr:'🤖 Analyser', ar:'🤖 تحليل' },
  analyzing: { en:'Analyzing...', tr:'Analiz ediliyor...', fr:'Analyse...', ar:'جاري التحليل...' },
  briefs: { en:'Briefs', tr:'Brifinglar', fr:'Briefs', ar:'ملخصات' },
  noBriefs: { en:'No active briefs.', tr:'Aktif brifing yok.', fr:'Aucun brief.', ar:'لا توجد ملخصات.' },
  archive: { en:'archive', tr:'arşivle', fr:'archiver', ar:'أرشيف' },
  archived: { en:'Archived', tr:'Arşivlenen', fr:'Archivés', ar:'مؤرشف' },
  progress: { en:'Progress Timeline', tr:'İlerleme Zaman Çizelgesi', fr:'Chronologie', ar:'الجدول الزمني' },
  // Settings
  settings: { en:'Settings', tr:'Ayarlar', fr:'Paramètres', ar:'الإعدادات' },
  theme: { en:'Theme', tr:'Tema', fr:'Thème', ar:'السمة' },
  light: { en:'Light', tr:'Açık', fr:'Clair', ar:'فاتح' },
  dark: { en:'Dark', tr:'Koyu', fr:'Sombre', ar:'داكن' },
  fontSize: { en:'Font Size', tr:'Yazı Boyutu', fr:'Taille', ar:'حجم الخط' },
  mapAnims: { en:'Map Animations', tr:'Harita Animasyonları', fr:'Animations', ar:'رسوم متحركة' },
  baseLayer: { en:'Base Layer', tr:'Temel Katman', fr:'Couche de base', ar:'طبقة أساسية' },
  apiKey: { en:'API Key', tr:'API Anahtarı', fr:'Clé API', ar:'مفتاح API' },
  model: { en:'Model', tr:'Model', fr:'Modèle', ar:'نموذج' },
  connected: { en:'Connected', tr:'Bağlandı', fr:'Connecté', ar:'متصل' },
  notConfigured: { en:'Not configured', tr:'Yapılandırılmadı', fr:'Non configuré', ar:'غير مكون' },
  language: { en:'Language', tr:'Dil', fr:'Langue', ar:'اللغة' },
  // Actions
  share: { en:'Share', tr:'Paylaş', fr:'Partager', ar:'مشاركة' },
  shareEvent: { en:'Share Event', tr:'Olayı Paylaş', fr:'Partager', ar:'مشاركة الحدث' },
  shareDesc: { en:'Anyone with this link can view a read-only version.', tr:'Bu bağlantıya sahip herkes salt okunur görüntüleyebilir.', fr:'Toute personne ayant ce lien peut voir en lecture seule.', ar:'أي شخص لديه هذا الرابط يمكنه المشاهدة.' },
  copy: { en:'Copy', tr:'Kopyala', fr:'Copier', ar:'نسخ' },
  copied: { en:'Copied!', tr:'Kopyalandı!', fr:'Copié!', ar:'تم النسخ!' },
  deleteEvent: { en:'Delete Event', tr:'Olayı Sil', fr:'Supprimer', ar:'حذف الحدث' },
  // Incident form
  reportIncident: { en:'Report Incident', tr:'Olay Bildir', fr:'Signaler', ar:'إبلاغ' },
  incTitle: { en:'Title', tr:'Başlık', fr:'Titre', ar:'العنوان' },
  incDesc: { en:'Description', tr:'Açıklama', fr:'Description', ar:'الوصف' },
  incType: { en:'Type', tr:'Tür', fr:'Type', ar:'النوع' },
  incSeverity: { en:'Severity', tr:'Şiddet', fr:'Gravité', ar:'الخطورة' },
  incActor: { en:'Actor', tr:'Aktör', fr:'Acteur', ar:'الفاعل' },
  incOrg: { en:'Organization', tr:'Kuruluş', fr:'Organisation', ar:'المنظمة' },
  clickMap: { en:'📍 Click map to set location', tr:'📍 Konum için haritaya tıklayın', fr:'📍 Cliquer sur la carte', ar:'📍 انقر على الخريطة' },
  addIncident: { en:'Add Incident', tr:'Olay Ekle', fr:'Ajouter', ar:'إضافة' },
  cancel: { en:'Cancel', tr:'İptal', fr:'Annuler', ar:'إلغاء' },
  // Notes
  noNotes: { en:'No notes yet.', tr:'Henüz not yok.', fr:'Aucune note.', ar:'لا توجد ملاحظات.' },
  addNote: { en:'Add a note... @Lankien', tr:'Not ekle... @Lankien', fr:'Ajouter une note...', ar:'أضف ملاحظة...' },
  mentionHint: { en:'Use @incidentId or @keyword to link incidents', tr:'@olay veya @anahtar ile bağlantı oluşturun', fr:'Utilisez @incident pour lier', ar:'استخدم @ للربط بالحوادث' },
  // Misc
  timeline: { en:'TIMELINE', tr:'ZAMAN ÇİZELGESİ', fr:'CHRONOLOGIE', ar:'الجدول الزمني' },
  noIncidents: { en:'No incidents', tr:'Olay yok', fr:'Aucun incident', ar:'لا حوادث' },
  thinking: { en:'Thinking...', tr:'Düşünüyor...', fr:'Réflexion...', ar:'جاري التفكير...' },
  fieldNotes: { en:'Field Notes', tr:'Saha Notları', fr:'Notes de terrain', ar:'ملاحظات ميدانية' },
  print: { en:'Print Map', tr:'Haritayı Yazdır', fr:'Imprimer', ar:'طباعة' },
  infra: { en:'Infrastructure', tr:'Altyapı', fr:'Infrastructure', ar:'البنية التحتية' },
  hospitals: { en:'Hospitals', tr:'Hastaneler', fr:'Hôpitaux', ar:'مستشفيات' },
  waterPoints: { en:'Water', tr:'Su', fr:'Eau', ar:'مياه' },
  roads: { en:'Roads', tr:'Yollar', fr:'Routes', ar:'طرق' },
}

export function t(key, lang = 'en') {
  return T[key]?.[lang] || T[key]?.en || key
}
