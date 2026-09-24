/* ============================================================
   Rusça Öğren — v5
   Yeni:
     - DeepL için proxy desteği (opsiyonel)
     - Wiktionary ile alternatif anlamlar
     - Cümle çevirisi (Context-aware translation)
     - Kitap kütüphanesi: IndexedDB + kaldığı yerden devam
     - Sayfa/scroll konumu kaydetme
   ============================================================ */

/* ============================================================
   1) YARDIMCILAR
   ============================================================ */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const el = h => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstElementChild; };
const shuffle = a => { const r = [...a]; for (let i = r.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [r[i],r[j]]=[r[j],r[i]]; } return r; };
const pick = a => a[Math.floor(Math.random()*a.length)];
const norm = s => (s||'').toLowerCase().trim().replace(/ё/g,'е');
const cap  = s => s.charAt(0).toUpperCase() + s.slice(1);

function toast(msg) {
  let t = $('.toast');
  if (!t) { t = el('<div class="toast"></div>'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ============================================================
   2) ÇEVİRİ AYARLARI
   Kullanıcı tercihine göre DeepL proxy veya MyMemory kullan
   ============================================================ */
const TRANS_KEY = 'rusca-trans-v5';
const TRANS_SETTINGS_KEY = 'rusca-trans-settings';
let TRANS_CACHE = {};
let TRANS_SETTINGS = { engine: 'mymemory', deeplProxyUrl: '' };

function loadTransCache() {
  try { TRANS_CACHE = JSON.parse(localStorage.getItem(TRANS_KEY) || '{}'); } catch (e) { TRANS_CACHE = {}; }
}
function saveTransCache() {
  try { localStorage.setItem(TRANS_KEY, JSON.stringify(TRANS_CACHE)); } catch (e) {}
}
function loadTransSettings() {
  try { TRANS_SETTINGS = { ...TRANS_SETTINGS, ...JSON.parse(localStorage.getItem(TRANS_SETTINGS_KEY) || '{}') }; } catch (e) {}
}
function saveTransSettings() {
  try { localStorage.setItem(TRANS_SETTINGS_KEY, JSON.stringify(TRANS_SETTINGS)); } catch (e) {}
}

/* ---------- Ana çeviri fonksiyonu ---------- */
async function translateText(text, langpair = 'ru|tr') {
  const key = norm(text) + '|' + langpair;
  if (TRANS_CACHE[key]) return TRANS_CACHE[key];

  let tr = null;

  // 1. DeepL proxy (kullanıcı ayarladıysa)
  if (TRANS_SETTINGS.engine === 'deepl' && TRANS_SETTINGS.deeplProxyUrl) {
    tr = await tryDeepLProxy(text, langpair);
  }

  // 2. MyMemory (varsayılan + yedek)
  if (!tr) tr = await tryMyMemory(text, langpair);

  // 3. Wiktionary (kelime bazlıysa)
  if (!tr && !text.includes(' ')) tr = await tryWiktionary(text);

  if (tr) {
    TRANS_CACHE[key] = tr;
    saveTransCache();
  }
  return tr;
}

async function tryDeepLProxy(text, langpair) {
  // Kullanıcının kendi proxy'si: /translate?text=...&target_lang=...
  // Örnek proxy: https://github.com/DeepL/deepl-api-nodejs-proxy[reference:5]
  try {
    const url = TRANS_SETTINGS.deeplProxyUrl.replace(/\/$/, '')
      + '/translate?text=' + encodeURIComponent(text)
      + '&source_lang=' + langpair.split('|')[0].toUpperCase()
      + '&target_lang=' + langpair.split('|')[1].toUpperCase();
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.translations?.[0]?.text || null;
  } catch (e) { return null; }
}

async function tryMyMemory(text, langpair) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    let tr = (data?.responseData?.translatedText || '').trim();
    if (!tr || /^MYMEMORY WARNING/i.test(tr) || norm(tr) === norm(text)) return null;
    if (tr.length > 2 && tr === tr.toUpperCase()) {
      tr = tr.charAt(0).toUpperCase() + tr.slice(1).toLowerCase();
    }
    return tr;
  } catch (e) { return null; }
}

async function tryWiktionary(word) {
  try {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    const ru = data?.ru;
    if (!ru || !ru.length) return null;
    const defs = ru.flatMap(p => (p.definitions || []).map(d => d.definition))
                   .filter(x => x && !x.includes('[['));
    if (!defs.length) return null;
    return '≈ ' + defs[0].replace(/<[^>]+>/g, '').slice(0, 120);
  } catch (e) { return null; }
}

/* ---------- Wiktionary'den alternatif anlamlar ---------- */
async function fetchAlternativeMeanings(word) {
  try {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    const ru = data?.ru;
    if (!ru || !ru.length) return [];

    const meanings = [];
    for (const pos of ru) {
      const posLabel = pos.partOfSpeech || '';
      for (const def of (pos.definitions || [])) {
        const text = (def.definition || '').replace(/<[^>]+>/g, '').trim();
        if (text && text.length < 200 && !text.includes('[[')) {
          meanings.push({ pos: posLabel, text });
          if (meanings.length >= 6) break;
        }
      }
      if (meanings.length >= 6) break;
    }
    return meanings;
  } catch (e) { return []; }
}

/* ============================================================
   3) SES — Google Translate TTS
   ============================================================ */
const AUDIO_CACHE = new Map();
function googleTtsUrl(text) {
  return 'https://translate.google.com/translate_tts?ie=UTF-8&q='
    + encodeURIComponent(text) + '&tl=ru&client=tw-ob';
}
function speak(text) {
  if (!text) return;
  const url = googleTtsUrl(text);
  try {
    let audio = AUDIO_CACHE.get(url);
    if (!audio) { audio = new Audio(url); audio.preload = 'auto'; AUDIO_CACHE.set(url, audio); }
    if (AUDIO_CACHE.size > 80) {
      const firstKey = AUDIO_CACHE.keys().next().value;
      AUDIO_CACHE.delete(firstKey);
    }
    audio.currentTime = 0;
    audio.play().catch(() => fallbackSpeak(text));
  } catch (e) { fallbackSpeak(text); }
}
function fallbackSpeak(text) {
  if (!('speechSynthesis' in window)) { toast('Ses çalınamadı'); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU'; u.rate = .9;
    const v = speechSynthesis.getVoices().find(x => x.lang.toLowerCase().startsWith('ru'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { toast('Ses çalınamadı'); }
}

/* ============================================================
   4) ALFABE
   ============================================================ */
const ALPHABET = [
  { up:'А', low:'а', pr:'a',   ex:'арбуз',   tr:'karpuz' },
  { up:'Б', low:'б', pr:'b',   ex:'банан',   tr:'muz' },
  { up:'В', low:'в', pr:'v',   ex:'вода',    tr:'su' },
  { up:'Г', low:'г', pr:'g',   ex:'город',   tr:'şehir' },
  { up:'Д', low:'д', pr:'d',   ex:'дом',     tr:'ev' },
  { up:'Е', low:'е', pr:'ye',  ex:'еда',     tr:'yemek' },
  { up:'Ё', low:'ё', pr:'yo',  ex:'ёлка',    tr:'çam ağacı' },
  { up:'Ж', low:'ж', pr:'j',   ex:'жук',     tr:'böcek' },
  { up:'З', low:'з', pr:'z',   ex:'зима',    tr:'kış' },
  { up:'И', low:'и', pr:'i',   ex:'игла',    tr:'iğne' },
  { up:'Й', low:'й', pr:'y',   ex:'йогурт',  tr:'yoğurt' },
  { up:'К', low:'к', pr:'k',   ex:'кот',     tr:'kedi' },
  { up:'Л', low:'л', pr:'l',   ex:'лампа',   tr:'lamba' },
  { up:'М', low:'м', pr:'m',   ex:'мама',    tr:'anne' },
  { up:'Н', low:'н', pr:'n',   ex:'нос',     tr:'burun' },
  { up:'О', low:'о', pr:'o',   ex:'окно',    tr:'pencere' },
  { up:'П', low:'п', pr:'p',   ex:'папа',    tr:'baba' },
  { up:'Р', low:'р', pr:'r',   ex:'рука',    tr:'el' },
  { up:'С', low:'с', pr:'s',   ex:'солнце',  tr:'güneş' },
  { up:'Т', low:'т', pr:'t',   ex:'торт',    tr:'pasta' },
  { up:'У', low:'у', pr:'u',   ex:'утка',    tr:'ördek' },
  { up:'Ф', low:'ф', pr:'f',   ex:'флаг',    tr:'bayrak' },
  { up:'Х', low:'х', pr:'h',   ex:'хлеб',    tr:'ekmek' },
  { up:'Ц', low:'ц', pr:'ts',  ex:'цветок',  tr:'çiçek' },
  { up:'Ч', low:'ч', pr:'ç',   ex:'час',     tr:'saat' },
  { up:'Ш', low:'ш', pr:'ş',   ex:'шар',     tr:'balon' },
  { up:'Щ', low:'щ', pr:'şç',  ex:'щука',    tr:'turna balığı' },
  { up:'Ъ', low:'ъ', pr:'—',   ex:'объект',  tr:'(sert işaret)' },
  { up:'Ы', low:'ы', pr:'ı',   ex:'сын',     tr:'oğul' },
  { up:'Ь', low:'ь', pr:'’',   ex:'дверь',   tr:'(yumuşak işaret)' },
  { up:'Э', low:'э', pr:'e',   ex:'этаж',    tr:'kat' },
  { up:'Ю', low:'ю', pr:'yu',  ex:'юбка',    tr:'etek' },
  { up:'Я', low:'я', pr:'ya',  ex:'яблоко',  tr:'elma' }
];

/* ============================================================
   5) SÖZLÜK (temel lemma)
   ============================================================ */
const DICT = [
  { ru:'привет', tr:'merhaba', pos:'int' },
  { ru:'здравствуйте', tr:'merhaba (resmi)', pos:'int' },
  { ru:'спасибо', tr:'teşekkürler', pos:'int' },
  { ru:'пожалуйста', tr:'lütfen / bir şey değil', pos:'int' },
  { ru:'да', tr:'evet', pos:'int' },
  { ru:'нет', tr:'hayır', pos:'int' },
  { ru:'извините', tr:'affedersiniz', pos:'int' },
  { ru:'хорошо', tr:'iyi / tamam', pos:'adv' },
  { ru:'плохо', tr:'kötü', pos:'adv' },

  { ru:'стол', tr:'masa', pos:'noun', gender:'m', anim:false },
  { ru:'дом', tr:'ev', pos:'noun', gender:'m', anim:false },
  { ru:'город', tr:'şehir', pos:'noun', gender:'m', anim:false },
  { ru:'язык', tr:'dil', pos:'noun', gender:'m', anim:false },
  { ru:'вопрос', tr:'soru', pos:'noun', gender:'m', anim:false },
  { ru:'ответ', tr:'cevap', pos:'noun', gender:'m', anim:false },
  { ru:'урок', tr:'ders', pos:'noun', gender:'m', anim:false },
  { ru:'день', tr:'gün', pos:'noun', gender:'m', anim:false, soft:true },
  { ru:'год', tr:'yıl', pos:'noun', gender:'m', anim:false },
  { ru:'час', tr:'saat', pos:'noun', gender:'m', anim:false },
  { ru:'мир', tr:'dünya / barış', pos:'noun', gender:'m', anim:false },
  { ru:'путь', tr:'yol', pos:'noun', gender:'m', anim:false, soft:true, irr:true },
  { ru:'друг', tr:'arkadaş', pos:'noun', gender:'m', anim:true, irr:true },
  { ru:'брат', tr:'erkek kardeş', pos:'noun', gender:'m', anim:true, irr:true },
  { ru:'сын', tr:'oğul', pos:'noun', gender:'m', anim:true, irr:true },
  { ru:'отец', tr:'baba', pos:'noun', gender:'m', anim:true, irr:true },
  { ru:'человек', tr:'insan', pos:'noun', gender:'m', anim:true, irr:true },
  { ru:'ребёнок', tr:'çocuk', pos:'noun', gender:'m', anim:true, irr:true },
  { ru:'студент', tr:'öğrenci', pos:'noun', gender:'m', anim:true },
  { ru:'учитель', tr:'öğretmen', pos:'noun', gender:'m', anim:true, soft:true },
  { ru:'писатель', tr:'yazar', pos:'noun', gender:'m', anim:true, soft:true },
  { ru:'кот', tr:'kedi', pos:'noun', gender:'m', anim:true },
  { ru:'словарь', tr:'sözlük', pos:'noun', gender:'m', anim:false, soft:true },
  { ru:'музей', tr:'müze', pos:'noun', gender:'m', anim:false, soft:true },
  { ru:'медведь', tr:'ayı', pos:'noun', gender:'m', anim:true, soft:true },
  { ru:'конь', tr:'at', pos:'noun', gender:'m', anim:true, soft:true },
  { ru:'гость', tr:'misafir', pos:'noun', gender:'m', anim:true, soft:true },

  { ru:'книга', tr:'kitap', pos:'noun', gender:'f' },
  { ru:'мама', tr:'anne', pos:'noun', gender:'f', anim:true },
  { ru:'папа', tr:'baba', pos:'noun', gender:'m', anim:true },
  { ru:'девочка', tr:'kız çocuğu', pos:'noun', gender:'f', anim:true },
  { ru:'девушка', tr:'genç kız', pos:'noun', gender:'f', anim:true },
  { ru:'кошка', tr:'dişi kedi', pos:'noun', gender:'f', anim:true },
  { ru:'сестра', tr:'kız kardeş', pos:'noun', gender:'f', anim:true, irr:true },
  { ru:'дочь', tr:'kız evlat', pos:'noun', gender:'f', anim:true, soft:true, irr:true },
  { ru:'мать', tr:'anne', pos:'noun', gender:'f', anim:true, soft:true, irr:true },
  { ru:'страна', tr:'ülke', pos:'noun', gender:'f' },
  { ru:'вода', tr:'su', pos:'noun', gender:'f' },
  { ru:'рука', tr:'el', pos:'noun', gender:'f', irr:true },
  { ru:'нога', tr:'bacak', pos:'noun', gender:'f', irr:true },
  { ru:'голова', tr:'baş', pos:'noun', gender:'f', irr:true },
  { ru:'работа', tr:'iş', pos:'noun', gender:'f' },
  { ru:'школа', tr:'okul', pos:'noun', gender:'f' },
  { ru:'комната', tr:'oda', pos:'noun', gender:'f' },
  { ru:'неделя', tr:'hafta', pos:'noun', gender:'f', soft:true },
  { ru:'деревня', tr:'köy', pos:'noun', gender:'f', soft:true },
  { ru:'семья', tr:'aile', pos:'noun', gender:'f', soft:true },
  { ru:'земля', tr:'toprak', pos:'noun', gender:'f', soft:true },
  { ru:'тетрадь', tr:'defter', pos:'noun', gender:'f', soft:true },
  { ru:'ночь', tr:'gece', pos:'noun', gender:'f', soft:true },
  { ru:'дверь', tr:'kapı', pos:'noun', gender:'f', soft:true },
  { ru:'жизнь', tr:'hayat', pos:'noun', gender:'f', soft:true },
  { ru:'площадь', tr:'meydan', pos:'noun', gender:'f', soft:true },
  { ru:'мышь', tr:'fare', pos:'noun', gender:'f', anim:true, soft:true },

  { ru:'окно', tr:'pencere', pos:'noun', gender:'n' },
  { ru:'письмо', tr:'mektup', pos:'noun', gender:'n' },
  { ru:'слово', tr:'kelime', pos:'noun', gender:'n' },
  { ru:'дело', tr:'iş / mesele', pos:'noun', gender:'n' },
  { ru:'место', tr:'yer', pos:'noun', gender:'n' },
  { ru:'лицо', tr:'yüz', pos:'noun', gender:'n' },
  { ru:'сердце', tr:'kalp', pos:'noun', gender:'n', soft:true },
  { ru:'здание', tr:'bina', pos:'noun', gender:'n', soft:true },
  { ru:'знание', tr:'bilgi', pos:'noun', gender:'n', soft:true },
  { ru:'море', tr:'deniz', pos:'noun', gender:'n', soft:true },
  { ru:'время', tr:'zaman', pos:'noun', gender:'n', soft:true, irr:true },
  { ru:'имя', tr:'isim', pos:'noun', gender:'n', soft:true, irr:true },
  { ru:'утро', tr:'sabah', pos:'noun', gender:'n' },
  { ru:'вечер', tr:'akşam', pos:'noun', gender:'m' },

  { ru:'новый', tr:'yeni', pos:'adj', type:'hard' },
  { ru:'старый', tr:'eski', pos:'adj', type:'hard' },
  { ru:'большой', tr:'büyük', pos:'adj', type:'stressed' },
  { ru:'маленький', tr:'küçük', pos:'adj', type:'soft' },
  { ru:'хороший', tr:'iyi', pos:'adj', type:'soft' },
  { ru:'плохой', tr:'kötü', pos:'adj', type:'stressed' },
  { ru:'красивый', tr:'güzel', pos:'adj', type:'hard' },
  { ru:'интересный', tr:'ilginç', pos:'adj', type:'hard' },
  { ru:'важный', tr:'önemli', pos:'adj', type:'hard' },
  { ru:'трудный', tr:'zor', pos:'adj', type:'hard' },
  { ru:'молодой', tr:'genç', pos:'adj', type:'stressed' },
  { ru:'русский', tr:'Rus', pos:'adj', type:'soft' },
  { ru:'белый', tr:'beyaz', pos:'adj', type:'hard' },
  { ru:'чёрный', tr:'siyah', pos:'adj', type:'hard' },
  { ru:'холодный', tr:'soğuk', pos:'adj', type:'hard' },
  { ru:'тёплый', tr:'ılık', pos:'adj', type:'hard' },
  { ru:'добрый', tr:'iyi kalpli', pos:'adj', type:'hard' },
  { ru:'синий', tr:'mavi', pos:'adj', type:'soft' },

  { ru:'быть', tr:'olmak', pos:'verb', conj:1, irr:true },
  { ru:'читать', tr:'okumak', pos:'verb', conj:1 },
  { ru:'писать', tr:'yazmak', pos:'verb', conj:1, irr:true },
  { ru:'знать', tr:'bilmek', pos:'verb', conj:1 },
  { ru:'делать', tr:'yapmak', pos:'verb', conj:1 },
  { ru:'думать', tr:'düşünmek', pos:'verb', conj:1 },
  { ru:'работать', tr:'çalışmak', pos:'verb', conj:1 },
  { ru:'гулять', tr:'gezmek', pos:'verb', conj:1 },
  { ru:'играть', tr:'oynamak', pos:'verb', conj:1 },
  { ru:'понимать', tr:'anlamak', pos:'verb', conj:1 },
  { ru:'говорить', tr:'konuşmak', pos:'verb', conj:2 },
  { ru:'любить', tr:'sevmek', pos:'verb', conj:2 },
  { ru:'видеть', tr:'görmek', pos:'verb', conj:2 },
  { ru:'смотреть', tr:'izlemek', pos:'verb', conj:2 },
  { ru:'помнить', tr:'hatırlamak', pos:'verb', conj:2 },
  { ru:'учить', tr:'öğrenmek', pos:'verb', conj:2 },
  { ru:'строить', tr:'inşa etmek', pos:'verb', conj:2 },
  { ru:'готовить', tr:'hazırlamak', pos:'verb', conj:2 },
  { ru:'звонить', tr:'telefon etmek', pos:'verb', conj:2 },
  { ru:'идти', tr:'gitmek', pos:'verb', conj:1, irr:true },
  { ru:'есть', tr:'yemek / var', pos:'verb', conj:1, irr:true },
  { ru:'пить', tr:'içmek', pos:'verb', conj:1, irr:true },
  { ru:'жить', tr:'yaşamak', pos:'verb', conj:1, irr:true },
  { ru:'хотеть', tr:'istemek', pos:'verb', conj:1, irr:true },
  { ru:'мочь', tr:'-ebilmek', pos:'verb', conj:1, irr:true }
];

/* ============================================================
   6) İSTİSNALAR
   ============================================================ */
const NOUN_IRR = {
  'друг':   { pl:{ nom:'друзья', gen:'друзей', dat:'друзьям', acc:'друзей', ins:'друзьями', pre:'друзьях' } },
  'брат':   { pl:{ nom:'братья', gen:'братьев', dat:'братьям', acc:'братьев', ins:'братьями', pre:'братьях' } },
  'сын':    { pl:{ nom:'сыновья', gen:'сыновей', dat:'сыновьям', acc:'сыновей', ins:'сыновьями', pre:'сыновьях' } },
  'человек':{ sg:{ nom:'человек', gen:'человека', dat:'человеку', acc:'человека', ins:'человеком', pre:'человеке' },
              pl:{ nom:'люди', gen:'людей', dat:'людям', acc:'людей', ins:'людьми', pre:'людях' } },
  'ребёнок':{ sg:{ nom:'ребёнок', gen:'ребёнка', dat:'ребёнку', acc:'ребёнка', ins:'ребёнком', pre:'ребёнке' },
              pl:{ nom:'дети', gen:'детей', dat:'детям', acc:'детей', ins:'детьми', pre:'детях' } },
  'сестра': { pl:{ nom:'сёстры', gen:'сестёр', dat:'сёстрам', acc:'сестёр', ins:'сёстрами', pre:'сёстрах' } },
  'дочь':   { pl:{ nom:'дочери', gen:'дочерей', dat:'дочерям', acc:'дочерей', ins:'дочерьми', pre:'дочерях' } },
  'мать':   { pl:{ nom:'матери', gen:'матерей', dat:'матерям', acc:'матерей', ins:'матерями', pre:'матерях' } },
  'время':  { sg:{ nom:'время', gen:'времени', dat:'времени', acc:'время', ins:'временем', pre:'времени' },
              pl:{ nom:'времена', gen:'времён', dat:'временам', acc:'времена', ins:'временами', pre:'временах' } },
  'имя':    { sg:{ nom:'имя', gen:'имени', dat:'имени', acc:'имя', ins:'именем', pre:'имени' },
              pl:{ nom:'имена', gen:'имён', dat:'именам', acc:'имена', ins:'именами', pre:'именах' } },
  'рука':   { sg:{ nom:'рука', gen:'руки', dat:'руке', acc:'руку', ins:'рукой', pre:'руке' },
              pl:{ nom:'руки', gen:'рук', dat:'рукам', acc:'руки', ins:'руками', pre:'руках' } },
  'нога':   { sg:{ nom:'нога', gen:'ноги', dat:'ноге', acc:'ногу', ins:'ногой', pre:'ноге' },
              pl:{ nom:'ноги', gen:'ног', dat:'ногам', acc:'ноги', ins:'ногами', pre:'ногах' } },
  'голова': { pl:{ nom:'головы', gen:'голов', dat:'головам', acc:'головы', ins:'головами', pre:'головах' } },
  'письмо': { pl:{ gen:'писем' } },
  'окно':   { pl:{ gen:'окон' } },
  'слово':  { pl:{ gen:'слов' } },
  'дело':   { pl:{ gen:'дел' } },
  'место':  { pl:{ gen:'мест' } },
  'лицо':   { pl:{ gen:'лиц' } },
  'сердце': { pl:{ gen:'сердец' } },
  'здание': { pl:{ gen:'зданий' } },
  'знание': { pl:{ gen:'знаний' } },
  'море':   { pl:{ gen:'морей' } },
  'путь':   { sg:{ nom:'путь', gen:'пути', dat:'пути', acc:'путь', ins:'путём', pre:'пути' },
              pl:{ nom:'пути', gen:'путей', dat:'путям', acc:'пути', ins:'путями', pre:'путях' } },
  'отец':   { sg:{ nom:'отец', gen:'отца', dat:'отцу', acc:'отца', ins:'отцом', pre:'отце' } }
};

const VERB_IRR = {
  'быть':   { pr:['есть','есть','есть','есть','есть','есть'], pa:{m:'был',f:'была',n:'было',pl:'были'} },
  'идти':   { pr:['иду','идёшь','идёт','идём','идёте','идут'], pa:{m:'шёл',f:'шла',n:'шло',pl:'шли'} },
  'есть':   { pr:['ем','ешь','ест','едим','едите','едят'], pa:{m:'ел',f:'ела',n:'ело',pl:'ели'} },
  'пить':   { pr:['пью','пьёшь','пьёт','пьём','пьёте','пьют'], pa:{m:'пил',f:'пила',n:'пило',pl:'пили'} },
  'жить':   { pr:['живу','живёшь','живёт','живём','живёте','живут'], pa:{m:'жил',f:'жила',n:'жило',pl:'жили'} },
  'хотеть': { pr:['хочу','хочешь','хочет','хотим','хотите','хотят'], pa:{m:'хотел',f:'хотела',n:'хотело',pl:'хотели'} },
  'мочь':   { pr:['могу','можешь','может','можем','можете','могут'], pa:{m:'мог',f:'могла',n:'могло',pl:'могли'} },
  'писать': { pr:['пишу','пишешь','пишет','пишем','пишете','пишут'], pa:{m:'писал',f:'писала',n:'писало',pl:'писали'} }
};

/* ============================================================
   7) MORFOLOJİ
   ============================================================ */
function guessGender(nom) {
  const w = norm(nom);
  if (w.endsWith('а') || w.endsWith('я')) return 'f';
  if (w.endsWith('о') || w.endsWith('е')) return 'n';
  if (w.endsWith('мя')) return 'n';
  if (w.endsWith('ь')) {
    if (/[ое]сть$/.test(w) || /[жчшщ]ь$/.test(w) || /нь$/.test(w)) return 'f';
    return 'm';
  }
  return 'm';
}
function isAfterWriteRule(stem) { return /[кгхжчшщ]$/.test(stem); }
function nounStem(nom, gender) {
  const w = norm(nom);
  if (gender === 'f' && /[ая]$/.test(w)) return w.slice(0, -1);
  if (gender === 'n' && /[ое]$/.test(w)) return w.slice(0, -1);
  if (gender === 'n' && w.endsWith('мя')) return w.slice(0, -2);
  if (w.endsWith('ь') || w.endsWith('й')) return w.slice(0, -1);
  return w;
}

function declineNoun(nom, gender, anim) {
  const key = norm(nom);
  const ov = NOUN_IRR[key] || {};
  const w = norm(nom);
  const g = gender || guessGender(w);
  const an = !!anim;
  const st = nounStem(w, g);

  let sg = { nom: w };
  if (ov.sg) { sg = { ...sg, ...ov.sg }; }
  else if (g === 'm') {
    const isSoft = key.endsWith('ь') || key.endsWith('й');
    if (isSoft) {
      sg.gen = st + 'я'; sg.dat = st + 'ю';
      sg.acc = an ? st + 'я' : w;
      sg.ins = st + (key.endsWith('й') ? 'ем' : 'ём');
      sg.pre = st + 'е';
    } else {
      sg.gen = st + 'а'; sg.dat = st + 'у';
      sg.acc = an ? st + 'а' : w;
      sg.ins = st + 'ом'; sg.pre = st + 'е';
    }
    if (key.endsWith('ий')) {
      sg.gen = st + 'ия'; sg.dat = st + 'ию';
      sg.acc = an ? st + 'ия' : w;
      sg.ins = st + 'ием'; sg.pre = st + 'ии';
    }
  } else if (g === 'f') {
    if (key.endsWith('а')) {
      const isZhi = /[кгхжчшщ]а$/.test(w);
      sg.gen = st + (isZhi ? 'и' : 'ы');
      sg.dat = st + 'е'; sg.acc = st + 'у';
      sg.ins = st + (/[жчшщ]а$/.test(w) ? 'ей' : 'ой');
      sg.pre = st + 'е';
    } else if (key.endsWith('я')) {
      sg.gen = st + 'и'; sg.dat = st + 'е'; sg.acc = st + 'ю';
      sg.ins = st + 'ей'; sg.pre = st + 'е';
    } else if (key.endsWith('ь')) {
      sg.gen = st + 'и'; sg.dat = st + 'и'; sg.acc = w;
      sg.ins = st + 'ью'; sg.pre = st + 'и';
    }
  } else if (g === 'n') {
    if (key.endsWith('о')) {
      sg.gen = st + 'а'; sg.dat = st + 'у'; sg.acc = w;
      sg.ins = st + 'ом'; sg.pre = st + 'е';
    } else if (key.endsWith('е')) {
      sg.gen = st + 'я'; sg.dat = st + 'ю'; sg.acc = w;
      sg.ins = st + 'ем'; sg.pre = st + 'е';
    }
  }

  let pl = { nom: w };
  if (ov.pl) { pl = { ...ov.pl, nom: ov.pl.nom || w }; }
  else if (g === 'm') {
    const isSoft = key.endsWith('ь') || key.endsWith('й');
    if (isSoft) {
      pl.nom = st + 'и'; pl.gen = st + 'ей'; pl.dat = st + 'ям';
      pl.acc = an ? pl.gen : pl.nom; pl.ins = st + 'ями'; pl.pre = st + 'ях';
    } else {
      const isZhi = isAfterWriteRule(st);
      pl.nom = st + (isZhi ? 'и' : 'ы');
      pl.gen = st + 'ов'; pl.dat = st + 'ам';
      pl.acc = an ? pl.gen : pl.nom; pl.ins = st + 'ами'; pl.pre = st + 'ах';
    }
  } else if (g === 'f') {
    if (key.endsWith('а')) {
      const isZhi = /[кгхжчшщ]а$/.test(w);
      pl.nom = st + (isZhi ? 'и' : 'ы');
      pl.gen = st; pl.dat = st + 'ам'; pl.acc = pl.nom;
      pl.ins = st + 'ами'; pl.pre = st + 'ах';
    } else if (key.endsWith('я')) {
      pl.nom = st + 'и'; pl.gen = st + 'ь'; pl.dat = st + 'ям';
      pl.acc = pl.nom; pl.ins = st + 'ями'; pl.pre = st + 'ях';
    } else if (key.endsWith('ь')) {
      pl.nom = st + 'и'; pl.gen = st + 'ей'; pl.dat = st + 'ям';
      pl.acc = pl.nom; pl.ins = st + 'ями'; pl.pre = st + 'ях';
    }
  } else if (g === 'n') {
    if (key.endsWith('о')) {
      pl.nom = st + 'а'; pl.gen = st; pl.dat = st + 'ам';
      pl.acc = pl.nom; pl.ins = st + 'ами'; pl.pre = st + 'ах';
    } else if (key.endsWith('е')) {
      pl.nom = st + 'я'; pl.gen = st + 'ей'; pl.dat = st + 'ям';
      pl.acc = pl.nom; pl.ins = st + 'ями'; pl.pre = st + 'ях';
    }
  }
  return { sg, pl };
}

function conjugateVerb(inf, conj) {
  const key = norm(inf);
  const irr = VERB_IRR[key];
  if (irr) return { pr: irr.pr, pa: irr.pa };

  const c = conj || (key.endsWith('ить') ? 2 : 1);
  const fullStem = key.replace(/ть$/, '');
  let pr;

  if (key.endsWith('ать')) {
    const root = key.slice(0, -3);
    pr = [root+'аю', root+'аешь', root+'ает', root+'аем', root+'аете', root+'ают'];
  } else if (key.endsWith('ять')) {
    const root = key.slice(0, -3);
    pr = [root+'яю', root+'яешь', root+'яет', root+'яем', root+'яете', root+'яют'];
  } else if (key.endsWith('ить')) {
    const root = key.slice(0, -3);
    pr = [root+'ю', root+'ишь', root+'ит', root+'им', root+'ите', root+'ят'];
  } else if (key.endsWith('еть')) {
    const root = key.slice(0, -3);
    pr = [root+'ю', root+'ешь', root+'ет', root+'ем', root+'ете', root+'ют'];
  } else {
    const st = key.replace(/ть$/, '');
    pr = c === 2
      ? [st+'ю', st+'ишь', st+'ит', st+'им', st+'ите', st+'ят']
      : [st+'ю', st+'ешь', st+'ет', st+'ем', st+'ете', st+'ют'];
  }
  const pa = { m: fullStem + 'л', f: fullStem + 'ла', n: fullStem + 'ло', pl: fullStem + 'ли' };
  return { pr, pa };
}

function declineAdj(nom, type) {
  const key = norm(nom);
  let st = key;
  if (key.endsWith('ий')) st = key.slice(0, -2);
  else if (key.endsWith('ый')) st = key.slice(0, -2);
  else if (key.endsWith('ой')) st = key.slice(0, -2);
  return {
    nom: { m:key, f:st+'ая', n:st+'ое', p:st+'ые' },
    gen: { m:st+'ого', f:st+'ой', n:st+'ого', p:st+'ых' },
    dat: { m:st+'ому', f:st+'ой', n:st+'ому', p:st+'ым' },
    acc: { m:key, f:st+'ую', n:st+'ое', p:st+'ые' },
    ins: { m:st+'ым', f:st+'ой', n:st+'ым', p:st+'ыми' },
    pre: { m:st+'ом', f:st+'ой', n:st+'ом', p:st+'ых' }
  };
}

/* ============================================================
   8) FORM İNDEKSİ
   ============================================================ */
const FORM_INDEX = {};
function buildFormIndex() {
  for (const e of DICT) {
    if (e.pos === 'noun') {
      const forms = declineNoun(e.ru, e.gender, e.anim);
      for (const num of ['sg', 'pl']) {
        for (const c of ['nom', 'gen', 'dat', 'acc', 'ins', 'pre']) {
          const f = forms[num][c];
          if (!f) continue;
          const k = norm(f);
          if (!FORM_INDEX[k]) FORM_INDEX[k] = [];
          FORM_INDEX[k].push({ lemma: e.ru, tr: e.tr, pos: 'noun', gender: e.gender, anim: e.anim, case: c, number: num });
        }
      }
    } else if (e.pos === 'verb') {
      const { pr, pa } = conjugateVerb(e.ru, e.conj);
      pr.forEach((f, i) => {
        const k = norm(f);
        if (!FORM_INDEX[k]) FORM_INDEX[k] = [];
        FORM_INDEX[k].push({ lemma: e.ru, tr: e.tr, pos: 'verb', tense: 'pres', person: i, number: i === 3 ? 'pl' : 'sg' });
      });
      ['m', 'f', 'n', 'pl'].forEach(g => {
        const f = pa[g];
        if (!f) return;
        const k = norm(f);
        if (!FORM_INDEX[k]) FORM_INDEX[k] = [];
        FORM_INDEX[k].push({ lemma: e.ru, tr: e.tr, pos: 'verb', tense: 'past', gender: g, number: g === 'pl' ? 'pl' : 'sg' });
      });
    } else if (e.pos === 'adj') {
      const T = declineAdj(e.ru, e.type);
      for (const c of ['nom', 'gen', 'dat', 'acc', 'ins', 'pre']) {
        for (const [g, form] of Object.entries(T[c])) {
          const k = norm(form);
          if (!FORM_INDEX[k]) FORM_INDEX[k] = [];
          FORM_INDEX[k].push({ lemma: e.ru, tr: e.tr, pos: 'adj', case: c, number: g === 'p' ? 'pl' : 'sg', gender: g === 'p' ? '—' : g });
        }
      }
    }
  }
}

/* ============================================================
   9) KELİME ANALİZCİSİ
   ============================================================ */
const CASE_TR = { nom:'Nominative (yalın)', gen:'Genitive (tamlayan)', dat:'Dative (yönelme)', acc:'Accusative (belirtme)', ins:'Instrumental (araç)', pre:'Prepositional (bulunma)' };
const CASE_SHORT = { nom:'Nom', gen:'Gen', dat:'Dat', acc:'Acc', ins:'Ins', pre:'Pre' };
const NUM_TR = { sg:'tekil', pl:'çoğul' };
const G_TR = { m:'eril', f:'dişil', n:'nötr', '—':'—' };

function analyzeWord(raw) {
  const word = norm((raw || '').replace(/[^\u0400-\u04FF]/g, ''));
  if (!word) return null;

  const direct = DICT.find(e => norm(e.ru) === word);
  if (direct) {
    let allForms = null;
    if (direct.pos === 'noun') allForms = declineNoun(direct.ru, direct.gender, direct.anim);
    else if (direct.pos === 'verb') allForms = conjugateVerb(direct.ru, direct.conj);
    else if (direct.pos === 'adj') allForms = declineAdj(direct.ru, direct.type);
    return {
      word, lemma: direct.ru, tr: direct.tr, pos: direct.pos,
      gender: direct.gender, anim: direct.anim,
      case: 'nom', number: 'sg',
      confidence: 'high', allForms
    };
  }

  if (FORM_INDEX[word]) {
    const hit = FORM_INDEX[word][0];
    const lemmaEntry = DICT.find(e => norm(e.ru) === norm(hit.lemma));
    let allForms = null;
    if (lemmaEntry) {
      if (lemmaEntry.pos === 'noun') allForms = declineNoun(lemmaEntry.ru, lemmaEntry.gender, lemmaEntry.anim);
      else if (lemmaEntry.pos === 'verb') allForms = conjugateVerb(lemmaEntry.ru, lemmaEntry.conj);
      else if (lemmaEntry.pos === 'adj') allForms = declineAdj(lemmaEntry.ru, lemmaEntry.type);
    }
    return {
      word, lemma: hit.lemma, tr: hit.tr, pos: hit.pos,
      gender: hit.gender, anim: hit.anim,
      case: hit.case, number: hit.number,
      tense: hit.tense, person: hit.person,
      confidence: 'high', allForms
    };
  }

  return heuristicAnalyze(word);
}

function heuristicAnalyze(word) {
  const endings = [
    { e:'ами', c:'ins', n:'pl', g:'—' }, { e:'ями', c:'ins', n:'pl', g:'—' },
    { e:'ах', c:'pre', n:'pl', g:'—' },  { e:'ях', c:'pre', n:'pl', g:'—' },
    { e:'ам', c:'dat', n:'pl', g:'—' },  { e:'ям', c:'dat', n:'pl', g:'—' },
    { e:'ов', c:'gen', n:'pl', g:'m' },  { e:'ев', c:'gen', n:'pl', g:'m' },
    { e:'ей', c:'gen', n:'pl', g:'—' },
    { e:'ого', c:'gen', n:'sg', g:'m', pos:'adj' }, { e:'его', c:'gen', n:'sg', g:'m', pos:'adj' },
    { e:'ому', c:'dat', n:'sg', g:'m', pos:'adj' }, { e:'ему', c:'dat', n:'sg', g:'m', pos:'adj' },
    { e:'ыми', c:'ins', n:'pl', g:'—', pos:'adj' }, { e:'ими', c:'ins', n:'pl', g:'—', pos:'adj' },
    { e:'ый', c:'nom', n:'sg', g:'m', pos:'adj' }, { e:'ий', c:'nom', n:'sg', g:'m', pos:'adj' }, { e:'ой', c:'nom', n:'sg', g:'m', pos:'adj' },
    { e:'ая', c:'nom', n:'sg', g:'f', pos:'adj' }, { e:'яя', c:'nom', n:'sg', g:'f', pos:'adj' },
    { e:'ое', c:'nom', n:'sg', g:'n', pos:'adj' }, { e:'ее', c:'nom', n:'sg', g:'n', pos:'adj' },
    { e:'ые', c:'nom', n:'pl', g:'—', pos:'adj' }, { e:'ие', c:'nom', n:'pl', g:'—', pos:'adj' },
    { e:'ой', c:'ins', n:'sg', g:'f' }, { e:'ей', c:'ins', n:'sg', g:'f' },
    { e:'ом', c:'ins', n:'sg', g:'m' }, { e:'ем', c:'ins', n:'sg', g:'m' },
    { e:'а', c:'gen', n:'sg', g:'m' }, { e:'я', c:'gen', n:'sg', g:'m' },
    { e:'у', c:'dat', n:'sg', g:'m' }, { e:'ю', c:'dat', n:'sg', g:'m' },
    { e:'е', c:'pre', n:'sg', g:'m' },
    { e:'ы', c:'nom', n:'pl', g:'—' }, { e:'и', c:'nom', n:'pl', g:'—' },
    { e:'ла', c:'—', n:'sg', g:'f', pos:'verb', tense:'past' },
    { e:'ло', c:'—', n:'sg', g:'n', pos:'verb', tense:'past' },
    { e:'ли', c:'—', n:'pl', g:'—', pos:'verb', tense:'past' },
    { e:'л',  c:'—', n:'sg', g:'m', pos:'verb', tense:'past' },
    { e:'ть', c:'—', n:'sg', g:'—', pos:'verb', tense:'inf' }
  ];
  for (const en of endings) {
    if (word.endsWith(en.e) && word.length > en.e.length + 1) {
      const stem = word.slice(0, -en.e.length);
      const candidate = DICT.find(d => norm(d.ru) === stem);
      return {
        word,
        lemma: candidate ? candidate.ru : stem,
        tr: candidate ? candidate.tr : null,
        pos: en.pos || 'noun',
        gender: en.g, case: en.c, number: en.n, tense: en.tense,
        confidence: candidate ? 'medium' : 'low',
        allForms: null
      };
    }
  }
  return { word, lemma: word, tr: null, pos: '?', case: '—', number: '—', confidence: 'low', allForms: null };
}

/* ============================================================
   10) KİTAP DEPOSU — IndexedDB + İLERLEME
   ============================================================ */
const DB_NAME = 'rusca-books';
const DB_STORE = 'books';
const PROGRESS_STORE = 'progress';
let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const store = db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains(PROGRESS_STORE)) {
        db.createObjectStore(PROGRESS_STORE, { keyPath: 'bookId' });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = e => reject(e.target.error);
  });
}

async function saveBook(book) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const req = tx.objectStore(DB_STORE).add(book);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function listBooks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function getBook(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBook(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([DB_STORE, PROGRESS_STORE], 'readwrite');
    tx.objectStore(DB_STORE).delete(id);
    tx.objectStore(PROGRESS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function saveProgress(bookId, scrollTop) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE, 'readwrite');
    const req = tx.objectStore(PROGRESS_STORE).put({ bookId, scrollTop, updated: Date.now() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getProgress(bookId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROGRESS_STORE, 'readonly');
    const req = tx.objectStore(PROGRESS_STORE).get(bookId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ============================================================
   11) EPUB / PDF AYRIŞTIRICI
   ============================================================ */
async function parseEpub(file) {
  if (typeof JSZip === 'undefined') throw new Error('JSZip yüklenemedi (internet gerekli)');
  const zip = await JSZip.loadAsync(file);
  const parser = new DOMParser();
  let opfPath = null;
  const container = zip.file('META-INF/container.xml');
  if (container) {
    const c = parser.parseFromString(await container.async('string'), 'application/xml');
    opfPath = c.querySelector('rootfile')?.getAttribute('full-path');
  }
  if (!opfPath) opfPath = Object.keys(zip.files).find(k => k.toLowerCase().endsWith('.opf'));
  if (!opfPath) throw new Error('EPUB yapısı okunamadı');
  const basePath = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfStr = await zip.file(opfPath).async('string');
  const opf = parser.parseFromString(opfStr, 'application/xml');
  const manifest = {};
  opf.querySelectorAll('manifest > item').forEach(it => { manifest[it.getAttribute('id')] = it.getAttribute('href'); });
  const spine = [...opf.querySelectorAll('spine > itemref')].map(r => manifest[r.getAttribute('idref')]).filter(Boolean);
  let out = '';
  for (const href of spine) {
    const p = decodeURIComponent(basePath + href).replace(/^\.\//, '');
    const f = zip.file(p) || zip.file(p.replace(/^\//, ''));
    if (!f) continue;
    const html = await f.async('string');
    const doc = parser.parseFromString(html, 'text/html');
    doc.querySelectorAll('script,style').forEach(x => x.remove());
    out += '\n\n' + (doc.body?.textContent || '');
  }
  return out;
}

async function parsePdf(file) {
  if (typeof pdfjsLib === 'undefined') throw new Error('pdf.js yüklenemedi (internet gerekli)');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let out = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const c = await page.getTextContent();
    out += c.items.map(it => it.str).join(' ') + '\n\n';
  }
  return out;
}

/* ============================================================
   12) KÜTÜPHANE — kelimeler
   ============================================================ */
const LIB_KEY = 'rusca-library-v1';
let LIBRARY = [];
function loadLibrary() { try { LIBRARY = JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch (e) { LIBRARY = []; } }
function saveLibrary() { try { localStorage.setItem(LIB_KEY, JSON.stringify(LIBRARY)); } catch (e) {} }
function addToLibrary(entry) {
  const key = norm(entry.lemma || entry.word);
  if (LIBRARY.some(x => norm(x.lemma || x.word) === key)) { toast('Zaten kütüphanede'); return false; }
  LIBRARY.unshift({
    word: entry.word, lemma: entry.lemma || entry.word,
    tr: entry.tr || '', pos: entry.pos || '?',
    case: entry.case, number: entry.number,
    added: Date.now()
  });
  saveLibrary();
  toast('Kütüphaneye eklendi: ' + (entry.lemma || entry.word));
  return true;
}
function removeFromLibrary(idx) { LIBRARY.splice(idx, 1); saveLibrary(); }

/* ============================================================
   13) İSTATİSTİK
   ============================================================ */
const STATS_KEY = 'rusca-stats-v1';
function loadStats() { try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); } catch (e) { return {}; } }
function saveStats(s) { try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) {} }
function bumpStats(ok) {
  const s = loadStats();
  s.correct = s.correct || 0; s.wrong = s.wrong || 0;
  if (ok) s.correct++; else s.wrong++;
  s.total = s.correct + s.wrong;
  saveStats(s);
}

/* ============================================================
   14) ANA SAYFA
   ============================================================ */
async function renderHome() {
  const s = loadStats();
  let bookCount = 0;
  try { bookCount = (await listBooks()).length; } catch (e) {}

  $('#page-home').innerHTML = `
    <div class="hero">
      <h1>Rusçayı Türkçe konuşanlar için öğren</h1>
      <p>Kural tabanlı morfoloji, EPUB/PDF okuyucu, cümle çevirisi, alternatif anlamlar, kitaplık ve flash kartlar.</p>
      <div class="hero-actions">
        <button class="primary" data-go="reader">Kitap yükle</button>
        <button class="ghost" data-go="library">Kütüphanem</button>
      </div>
    </div>
    <div class="features">
      <button class="feature" data-go="alphabet"><div class="icon">Аа</div><h3>Alfabe</h3><p>33 Kiril harfi, telaffuzu, örnekleri</p></button>
      <button class="feature" data-go="grammar"><div class="icon">📐</div><h3>Gramer</h3><p>Hâller, cinsiyet, fiil çekimi, sıfat uyumu</p></button>
      <button class="feature" data-go="reader"><div class="icon">📖</div><h3>Okuyucu</h3><p>EPUB/PDF yükle, kalıcı sakla, kelimeye tıkla</p></button>
      <button class="feature" data-go="library"><div class="icon">📚</div><h3>Kütüphanem</h3><p>${bookCount} kitap · ${LIBRARY.length} kelime</p></button>
      <button class="feature" data-go="practice"><div class="icon">🎯</div><h3>Pratik</h3><p>Sonsuz soru + flash kartlar</p></button>
    </div>
    <h2>İlerlemen</h2>
    <div class="progress-panel">
      <div class="stat"><div class="label">Doğru</div><div class="value">${s.correct || 0}</div></div>
      <div class="stat"><div class="label">Yanlış</div><div class="value">${s.wrong || 0}</div></div>
      <div class="stat"><div class="label">Başarı</div><div class="value">${s.total ? Math.round(s.correct / s.total * 100) + '%' : '—'}</div></div>
      <div class="stat"><div class="label">Kütüphane</div><div class="value">${LIBRARY.length}</div></div>
    </div>
    <div class="card" style="margin-top:20px">
      <h3>💡 Nasıl kullanılır?</h3>
      <ul style="margin:8px 0 0 20px; padding:0; font-size:14px; line-height:1.9">
        <li><b>Okuyucu</b>'dan EPUB/PDF yükle → kitap otomatik kaydedilir</li>
        <li>Kaldığın yerden devam etmek için <b>Kütüphanem → Kitaplarım</b>'dan aç</li>
        <li>Kelimeye <b>tıkla</b> → pencere açık kalır: sözlük + çeviri + alternatif anlamlar + çekim tablosu + ses</li>
        <li><b>📖 Cümle</b> butonu ile cümlenin tam çevirisini gör</li>
        <li>Beğendiğin kelimeyi <b>"+ Ekle"</b> ile kaydet</li>
      </ul>
    </div>
  `;
  $$('#page-home [data-go]').forEach(b => b.onclick = () => goTo(b.dataset.go));
}

/* ============================================================
   15) ALFABE
   ============================================================ */
function renderAlphabet() {
  $('#page-alphabet').innerHTML = `
    <div class="page-head"><h1>Kiril Alfabesi</h1><p>33 harf. Harfe tıkla → telaffuzu dinle.</p></div>
    <div class="alphabet-grid">
      ${ALPHABET.map((l, i) => `
        <button class="letter-card" data-i="${i}">
          <div class="big">${l.up}</div>
          <div class="small">${l.low}</div>
          <div class="pr">${l.pr}</div>
          <div class="ex"><span class="ru">${l.ex}</span><br>${l.tr}</div>
        </button>
      `).join('')}
    </div>
  `;
  $$('#page-alphabet .letter-card').forEach(c => {
    c.onclick = () => { const l = ALPHABET[+c.dataset.i]; speak(l.ex); toast(`${l.up}${l.low} — ${l.ex} (${l.tr})`); };
  });
}

/* ============================================================
   16) GRAMER
   ============================================================ */
const GRAMMAR = {
  'Cinsiyet': { body: `
    <div class="card">
      <h3>Kurallar</h3>
      <table class="data">
        <tr><th>Cinsiyet</th><th>Son harf</th><th>Örnek</th></tr>
        <tr><td>Eril</td><td>ünsüz, -й, bazı -ь</td><td><span class="ru">стол, музей, словарь</span></td></tr>
        <tr><td>Dişil</td><td>-а, -я, bazı -ь</td><td><span class="ru">книга, неделя, тетрадь</span></td></tr>
        <tr><td>Nötr</td><td>-о, -е, -мя</td><td><span class="ru">окно, море, время</span></td></tr>
      </table>
      <div class="callout"><b>İpucu:</b> -ость, -сть, -нь, -жь, -чь, -шь, -щь → <b>dişil</b>.</div>
    </div>` },
  'Çoğul': { body: `
    <div class="card">
      <h3>Çoğul</h3>
      <table class="data">
        <tr><th>Tekil</th><th>Çoğul</th><th>Kural</th></tr>
        <tr><td class="ru">стол</td><td class="ru">столы</td><td>Eril sert → -ы</td></tr>
        <tr><td class="ru">словарь</td><td class="ru">словари</td><td>Eril yumuşak → -и</td></tr>
        <tr><td class="ru">книга</td><td class="ru">книги</td><td>Dişil -а → -и (г sonrası)</td></tr>
        <tr><td class="ru">окно</td><td class="ru">окна</td><td>Nötr -о → -а</td></tr>
      </table>
      <div class="callout warn"><b>Yazım:</b> к/г/х/ж/ч/ш/щ sonrası -ы değil -и.</div>
    </div>` },
  'Hâller': { body: `
    <div class="card">
      <h3>6 Hâl</h3>
      <table class="data">
        <tr><th>#</th><th>Hâl</th><th>Soru</th><th>Türkçe</th></tr>
        <tr><td>1</td><td class="ru">Именительный</td><td>Кто? Что?</td><td>Yalın</td></tr>
        <tr><td>2</td><td class="ru">Родительный</td><td>Кого? Чего?</td><td>-in / -den</td></tr>
        <tr><td>3</td><td class="ru">Дательный</td><td>Кому? Чему?</td><td>-e</td></tr>
        <tr><td>4</td><td class="ru">Винительный</td><td>Кого? Что?</td><td>-i</td></tr>
        <tr><td>5</td><td class="ru">Творительный</td><td>Кем? Чем?</td><td>-ile</td></tr>
        <tr><td>6</td><td class="ru">Предложный</td><td>О ком? Где?</td><td>-de / hakkında</td></tr>
      </table>
    </div>
    <div class="card">
      <h3>Ekler (tekil)</h3>
      <table class="data">
        <tr><th>Hâl</th><th>Eril</th><th>Dişil</th><th>Nötr</th></tr>
        <tr><td>Nom</td><td class="ru">-∅/-й/-ь</td><td class="ru">-а/-я</td><td class="ru">-о/-е</td></tr>
        <tr><td>Gen</td><td class="ru">-а/-я</td><td class="ru">-ы/-и</td><td class="ru">-а/-я</td></tr>
        <tr><td>Dat</td><td class="ru">-у/-ю</td><td class="ru">-е</td><td class="ru">-у/-ю</td></tr>
        <tr><td>Acc</td><td class="ru">canlı: Gen · cansız: Nom</td><td class="ru">-у/-ю</td><td class="ru">= Nom</td></tr>
        <tr><td>Ins</td><td class="ru">-ом/-ем</td><td class="ru">-ой/-ей</td><td class="ru">-ом/-ем</td></tr>
        <tr><td>Pre</td><td class="ru">-е</td><td class="ru">-е</td><td class="ru">-е</td></tr>
      </table>
    </div>` },
  'Fiiller': { body: `
    <div class="card">
      <h3>Şimdiki Zaman</h3>
      <table class="data">
        <tr><th>Kişi</th><th>читать</th><th>говорить</th></tr>
        <tr><td>я</td><td class="ru">читаю</td><td class="ru">говорю</td></tr>
        <tr><td>ты</td><td class="ru">читаешь</td><td class="ru">говоришь</td></tr>
        <tr><td>он/она</td><td class="ru">читает</td><td class="ru">говорит</td></tr>
        <tr><td>мы</td><td class="ru">читаем</td><td class="ru">говорим</td></tr>
        <tr><td>вы</td><td class="ru">читаете</td><td class="ru">говорите</td></tr>
        <tr><td>они</td><td class="ru">читают</td><td class="ru">говорят</td></tr>
      </table>
    </div>
    <div class="card">
      <h3>Geçmiş Zaman</h3>
      <table class="data">
        <tr><th>Özne</th><th>читать</th></tr>
        <tr><td>он</td><td class="ru">читал</td></tr>
        <tr><td>она</td><td class="ru">читала</td></tr>
        <tr><td>оно</td><td class="ru">читало</td></tr>
        <tr><td>они</td><td class="ru">читали</td></tr>
      </table>
    </div>` },
  'Sıfatlar': { body: `
    <div class="card">
      <h3>Nominative Ekler</h3>
      <table class="data">
        <tr><th>Cinsiyet</th><th>Ek</th><th>Örnek</th></tr>
        <tr><td>Eril</td><td class="ru">-ый / -ий / -ой</td><td class="ru">новый</td></tr>
        <tr><td>Dişil</td><td class="ru">-ая / -яя</td><td class="ru">новая</td></tr>
        <tr><td>Nötr</td><td class="ru">-ое / -ее</td><td class="ru">новое</td></tr>
        <tr><td>Çoğul</td><td class="ru">-ые / -ие</td><td class="ru">новые</td></tr>
      </table>
    </div>` },
  'Zamirler': { body: `
    <div class="card">
      <h3>Kişi Zamirleri</h3>
      <table class="data">
        <tr><th>Hâl</th><th>я</th><th>ты</th><th>он/она</th><th>мы</th><th>вы</th><th>они</th></tr>
        <tr><td>Nom</td><td class="ru">я</td><td class="ru">ты</td><td class="ru">он/она</td><td class="ru">мы</td><td class="ru">вы</td><td class="ru">они</td></tr>
        <tr><td>Gen</td><td class="ru">меня</td><td class="ru">тебя</td><td class="ru">его/её</td><td class="ru">нас</td><td class="ru">вас</td><td class="ru">их</td></tr>
        <tr><td>Dat</td><td class="ru">мне</td><td class="ru">тебе</td><td class="ru">ему/ей</td><td class="ru">нам</td><td class="ru">вам</td><td class="ru">им</td></tr>
        <tr><td>Acc</td><td class="ru">меня</td><td class="ru">тебя</td><td class="ru">его/её</td><td class="ru">нас</td><td class="ru">вас</td><td class="ru">их</td></tr>
        <tr><td>Ins</td><td class="ru">мной</td><td class="ru">тобой</td><td class="ru">им/ей</td><td class="ru">нами</td><td class="ru">вами</td><td class="ru">ими</td></tr>
        <tr><td>Pre</td><td class="ru">мне</td><td class="ru">тебе</td><td class="ru">нём/ней</td><td class="ru">нас</td><td class="ru">вас</td><td class="ru">них</td></tr>
      </table>
    </div>` }
};
let currentGrammarTab = Object.keys(GRAMMAR)[0];
function renderGrammar() {
  $('#page-grammar').innerHTML = `
    <div class="page-head"><h1>Gramer</h1><p>Kurallar ve tablolar Türkçe açıklamalarla.</p></div>
    <div class="grammar-tabs">
      ${Object.keys(GRAMMAR).map(k => `<button data-t="${k}" class="${k === currentGrammarTab ? 'active' : ''}">${k}</button>`).join('')}
    </div>
    <div id="grammarBody">${GRAMMAR[currentGrammarTab].body}</div>
  `;
  $$('#page-grammar .grammar-tabs button').forEach(b => {
    b.onclick = () => {
      currentGrammarTab = b.dataset.t;
      $$('#page-grammar .grammar-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      $('#grammarBody').innerHTML = GRAMMAR[currentGrammarTab].body;
    };
  });
}

/* ============================================================
   17) OKUYUCU
   ============================================================ */
let currentBook = null;
let saveProgressTimer = null;

function renderReader() {
  $('#page-reader').innerHTML = `
    <div class="page-head">
      <h1>Okuyucu — EPUB / PDF</h1>
      <p>Kitap yükle → otomatik kaydedilir. Kaldığın yerden devam etmek için Kütüphanem'den aç. Kelimeye <b>tıkla</b> → pencere açık kalır.</p>
    </div>
    <div class="dropzone" id="dz">
      <div class="dz-icon">📚</div>
      <h3>EPUB veya PDF dosyanı bırak</h3>
      <p>ya da tıkla · kitap bu cihazda kalıcı olarak saklanır</p>
      <input type="file" id="fileInput" accept=".epub,.pdf,application/epub+zip,application/pdf" hidden>
    </div>
    <div id="readerArea"></div>
  `;
  const dz = $('#dz'), input = $('#fileInput');
  dz.onclick = () => input.click();
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  input.onchange = e => { if (e.target.files[0]) handleFile(e.target.files[0]); };
}

async function handleFile(file) {
  const name = file.name.toLowerCase();
  $('#readerArea').innerHTML = '<div class="card"><p>⏳ ' + file.name + ' işleniyor…</p></div>';
  try {
    let text;
    if (name.endsWith('.epub')) text = await parseEpub(file);
    else if (name.endsWith('.pdf')) text = await parsePdf(file);
    else text = await file.text();
    if (!text.trim()) throw new Error('Dosyadan metin çıkarılamadı');

    const book = {
      name: file.name,
      size: file.size,
      text,
      wordCount: (text.match(/[А-Яа-яЁё]+/g) || []).length,
      added: Date.now()
    };
    try {
      const id = await saveBook(book);
      book.id = id;
      toast('Kitap kaydedildi: ' + file.name);
    } catch (e) {
      console.warn('Kayıt hatası:', e);
      toast('Kitap açıldı ama kaydedilemedi');
    }

    currentBook = book;
    await showReader();
  } catch (err) {
    console.error(err);
    $('#readerArea').innerHTML = `<div class="card"><p style="color:var(--accent)">❌ Hata: ${err.message}</p></div>`;
  }
}

async function openSavedBook(id) {
  const book = await getBook(id);
  if (!book) { toast('Kitap bulunamadı'); return; }
  currentBook = book;
  goTo('reader');
  setTimeout(async () => { await showReader(); }, 60);
}

async function showReader() {
  if (!currentBook) return;
  const { name, text, wordCount } = currentBook;
  const wc = wordCount || (text.match(/[А-Яа-яЁё]+/g) || []).length;

  // Cümle bazında tokenize: cümle sonlarını koru
  const tokens = text.split(/(\s+)/);
  const html = tokens.map(tok => {
    if (!tok.trim()) return tok;
    const m = tok.match(/^([^\p{L}]*)([\p{L}Ёё-]+)([^\p{L}]*)$/u);
    if (!m) return tok;
    const word = m[2];
    return m[1] + `<span class="w" data-w="${word}">${word}</span>` + m[3];
  }).join('');

  $('#readerArea').innerHTML = `
    <div class="book-info">
      <div class="bk">
        <div class="bk-title">📖 ${name}</div>
        <div class="bk-meta">${text.length.toLocaleString('tr-TR')} karakter · ~${wc.toLocaleString('tr-TR')} Rusça kelime · Kaldığın yerden devam eder</div>
      </div>
      <button class="btn ghost small" id="closeBook">Kapat</button>
    </div>
    <div class="reader-text" id="readerText">${html}</div>
  `;
  $('#closeBook').onclick = () => {
    if (saveProgressTimer) clearTimeout(saveProgressTimer);
    saveProgressNow();
    currentBook = null;
    $('#readerArea').innerHTML = '';
    $('#dz').style.display = '';
    hidePopover();
  };
  $('#dz').style.display = 'none';

  bindReaderEvents();

  // Kaydedilmiş konuma dön
  if (currentBook.id) {
    const prog = await getProgress(currentBook.id);
    if (prog && prog.scrollTop) {
      setTimeout(() => {
        const rt = $('#readerText');
        if (rt) rt.scrollTop = prog.scrollTop;
      }, 80);
    }
  }
}

function saveProgressNow() {
  if (!currentBook || !currentBook.id) return;
  const rt = $('#readerText');
  if (!rt) return;
  saveProgress(currentBook.id, rt.scrollTop).catch(() => {});
}

function scheduleSaveProgress() {
  if (saveProgressTimer) clearTimeout(saveProgressTimer);
  saveProgressTimer = setTimeout(saveProgressNow, 800);
}

/* ============================================================
   18) POPOVER — kelime + cümle + alternatif anlamlar
   ============================================================ */
const popover = $('#popover');
let popState = { word: null, targetEl: null, analysis: null, loading: false, open: false, sentence: '', meanings: [] };

function bindReaderEvents() {
  const rt = $('#readerText');
  if (!rt) return;

  rt.addEventListener('mouseover', e => {
    const w = e.target.closest('.w');
    if (!w) return;
    if (popState.targetEl === w) return;
    showPopover(w);
  });

  rt.addEventListener('click', e => {
    const w = e.target.closest('.w');
    if (!w) return;
    e.stopPropagation();
    if (popState.targetEl === w && popState.open) return;
    showPopover(w);
  });

  rt.addEventListener('scroll', () => {
    if (popState.open && popState.targetEl) positionPopover(popState.targetEl);
    scheduleSaveProgress();
  });
}

function getSentenceFromContext(wEl) {
  // En yakın paragrafı bul
  let parent = wEl.parentElement;
  while (parent && parent.childNodes.length === 1 && parent.parentElement) {
    parent = parent.parentElement;
  }
  // parent içindeki tüm text node'larını birleştir
  const text = parent?.textContent || '';
  // Kelimenin etrafındaki cümleyi bul
  const idx = text.indexOf(wEl.dataset.w);
  if (idx === -1) return text.slice(0, 200);

  // Önce/sonra noktalama işareti ara
  let start = idx, end = idx + wEl.dataset.w.length;
  const sentenceEnders = /[.!?…]/;
  while (start > 0 && !sentenceEnders.test(text[start - 1])) start--;
  while (end < text.length && !sentenceEnders.test(text[end])) end++;
  if (end < text.length) end++;

  return text.slice(start, end).trim().slice(0, 300);
}

async function showPopover(wEl) {
  const raw = wEl.dataset.w;
  const analysis = analyzeWord(raw);
  if (!analysis) return;

  $$('.reader-text .w.active').forEach(x => x.classList.remove('active'));
  wEl.classList.add('active');

  const cached = TRANS_CACHE[norm(analysis.word)];
  if (!analysis.tr && cached) analysis.tr = cached;

  popState.word = analysis.word;
  popState.targetEl = wEl;
  popState.analysis = analysis;
  popState.open = true;
  popState.meanings = [];
  popState.sentence = getSentenceFromContext(wEl);

  renderPopover();
  popover.classList.add('show');
  positionPopover(wEl);

  // Paralel: çeviri + alternatif anlamlar
  if (!analysis.tr) fetchTranslationAsync(analysis.word);
  fetchAlternativeMeanings(analysis.word).then(list => {
    if (!popState.open || popState.word !== analysis.word) return;
    popState.meanings = list;
    renderPopover();
    positionPopover(popState.targetEl);
  });
}

async function fetchTranslationAsync(word) {
  if (popState.loading) return;
  popState.loading = true;
  const trEl = popover.querySelector('.p-tr');
  if (trEl) trEl.innerHTML = '<span class="p-loading">⏳ Çeviri aranıyor…</span>';

  const tr = await translateText(word, 'ru|tr');
  popState.loading = false;

  if (!popState.open || popState.word !== word) return;

  if (tr) {
    popState.analysis.tr = tr;
    const lemmaEntry = DICT.find(e => norm(e.ru) === norm(popState.analysis.lemma));
    if (lemmaEntry && !lemmaEntry.tr) lemmaEntry.tr = tr;
    renderPopover();
    positionPopover(popState.targetEl);
  } else {
    const el = popover.querySelector('.p-tr');
    if (el) el.innerHTML = '<span class="p-err">Çeviri alınamadı (internet?)</span>';
  }
}

async function fetchSentenceTranslation() {
  if (!popState.sentence) return;
  const el = popover.querySelector('#sentenceTrans');
  if (!el) return;
  el.innerHTML = '⏳ Çeviri aranıyor…';
  const tr = await translateText(popState.sentence, 'ru|tr');
  if (el) el.innerHTML = tr ? '📖 ' + tr : 'Çeviri alınamadı';
}

function renderPopover() {
  const a = popState.analysis;
  if (!a) return;

  const caseTxt = a.case && a.case !== '—' ? CASE_TR[a.case] : '—';
  const numTxt = a.number ? NUM_TR[a.number] : '';
  const genderTxt = a.gender && a.gender !== '—' ? G_TR[a.gender] : '';
  const inLib = LIBRARY.some(x => norm(x.lemma || x.word) === norm(a.lemma || a.word));

  let detail = '';
  if (a.allForms && a.pos === 'noun') {
    const { sg, pl } = a.allForms;
    detail = `
      <div class="p-detail">
        <b>Çekim tablosu:</b>
        <ul>
          <li>Gen: <span class="ru">${sg.gen || '—'}</span> / <span class="ru">${pl.gen || '—'}</span></li>
          <li>Dat: <span class="ru">${sg.dat || '—'}</span> / <span class="ru">${pl.dat || '—'}</span></li>
          <li>Acc: <span class="ru">${sg.acc || '—'}</span> / <span class="ru">${pl.acc || '—'}</span></li>
          <li>Ins: <span class="ru">${sg.ins || '—'}</span> / <span class="ru">${pl.ins || '—'}</span></li>
          <li>Pre: <span class="ru">${sg.pre || '—'}</span> / <span class="ru">${pl.pre || '—'}</span></li>
        </ul>
      </div>`;
  } else if (a.allForms && a.pos === 'verb') {
    detail = `
      <div class="p-detail">
        <b>Şimdiki:</b> <span class="ru">${a.allForms.pr.join(', ')}</span><br>
        <b>Geçmiş:</b> <span class="ru">${a.allForms.pa.m}, ${a.allForms.pa.f}, ${a.allForms.pa.n}, ${a.allForms.pa.pl}</span>
      </div>`;
  } else if (a.allForms && a.pos === 'adj') {
    const n = a.allForms.nom;
    detail = `
      <div class="p-detail">
        <b>Nominative:</b><br>
        eril: <span class="ru">${n.m}</span> · dişil: <span class="ru">${n.f}</span><br>
        nötr: <span class="ru">${n.n}</span> · çoğul: <span class="ru">${n.p}</span>
      </div>`;
  }

  // Alternatif anlamlar bölümü
  let altHTML = '';
  if (popState.meanings.length) {
    altHTML = `
      <div class="p-detail" style="margin-top:8px">
        <b>📚 Diğer anlamlar / kullanımlar:</b>
        <ul style="margin-top:4px">
          ${popState.meanings.slice(0, 5).map(m => `
            <li><span style="color:#9ca3af;font-size:11.5px">[${m.pos}]</span> ${m.text}</li>
          `).join('')}
        </ul>
      </div>`;
  }

  const confTag = a.confidence === 'low' ? '<span class="tag low">tahmini</span>'
                : a.confidence === 'medium' ? '<span class="tag mid">kısmi</span>' : '';
  const hasTr = !!a.tr;

  popover.innerHTML = `
    <button class="p-close" id="pClose" title="Kapat">✕</button>
    <div class="p-word">${a.word}</div>
    ${a.lemma && norm(a.lemma) !== norm(a.word) ? `<div class="p-lemma">kök: <span class="ru">${a.lemma}</span></div>` : ''}
    <div class="p-tr">${hasTr ? a.tr : '<span class="p-loading">⏳ Çeviri aranıyor…</span>'}</div>
    <div class="p-tags">
      ${a.pos && a.pos !== '?' ? `<span class="tag pos">${a.pos === 'noun' ? 'isim' : a.pos === 'verb' ? 'fiil' : a.pos === 'adj' ? 'sıfat' : a.pos}</span>` : ''}
      ${caseTxt !== '—' ? `<span class="tag">${CASE_SHORT[a.case]}</span>` : ''}
      ${numTxt ? `<span class="tag">${numTxt}</span>` : ''}
      ${genderTxt ? `<span class="tag">${genderTxt}</span>` : ''}
      ${confTag}
    </div>
    <div class="p-actions">
      <button data-act="speak">🔊 Dinle</button>
      <button data-act="add" class="${inLib ? 'added' : ''}" ${inLib ? 'disabled' : ''}>${inLib ? '✓ Eklendi' : '+ Ekle'}</button>
      ${!hasTr ? '<button data-act="translate" class="translate">🌐 Çevir</button>' : ''}
    </div>
    ${popState.sentence ? `
      <div class="p-sentence" style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)">
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">CÜMLE</div>
        <div style="font-family:Georgia,serif;font-size:14px;color:#e5e7eb;margin-bottom:6px">${popState.sentence}</div>
        <button class="btn small ghost" id="sentenceBtn" style="font-size:11.5px;padding:5px 10px;background:#1e3a6b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-family:inherit">📖 Cümleyi Çevir</button>
        <div id="sentenceTrans" style="margin-top:8px;font-size:13px;color:#93c5fd"></div>
      </div>
    ` : ''}
    ${detail}
    ${altHTML}
  `;

  popover.querySelector('#pClose')?.addEventListener('click', e => { e.stopPropagation(); hidePopover(); });
  popover.querySelector('[data-act="speak"]')?.addEventListener('click', e => { e.stopPropagation(); speak(a.word); });
  const addBtn = popover.querySelector('[data-act="add"]');
  addBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (inLib) return;
    addToLibrary(a);
    addBtn.textContent = '✓ Eklendi';
    addBtn.classList.add('added');
    addBtn.disabled = true;
    popState.targetEl?.classList.add('saved');
  });
  popover.querySelector('[data-act="translate"]')?.addEventListener('click', e => {
    e.stopPropagation();
    fetchTranslationAsync(a.word);
  });
  popover.querySelector('#sentenceBtn')?.addEventListener('click', e => {
    e.stopPropagation();
    fetchSentenceTranslation();
  });
}

function positionPopover(target) {
  if (!target) return;
  const r = target.getBoundingClientRect();
  const pw = popover.offsetWidth;
  const ph = popover.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  let top  = r.top - ph - 8;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (top < 8) top = r.bottom + 8;
  if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
  popover.style.left = left + 'px';
  popover.style.top  = top + 'px';
}

function hidePopover() {
  popover.classList.remove('show');
  popState.open = false;
  popState.word = null;
  popState.targetEl = null;
  popState.meanings = [];
  popState.sentence = '';
  $$('.reader-text .w.active').forEach(x => x.classList.remove('active'));
}

document.addEventListener('click', e => {
  if (e.target.closest('#popover')) return;
  if (e.target.closest('.reader-text .w')) return;
  if (!popState.open) return;
  hidePopover();
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePopover(); });

/* ============================================================
   19) KÜTÜPHANE — Kitaplar + Kelimeler
   ============================================================ */
let libTab = 'books';

async function renderLibrary() {
  const page = $('#page-library');
  page.innerHTML = `
    <div class="page-head">
      <h1>Kütüphanem</h1>
      <p>Kaydettiğin kitaplar ve eklediğin kelimeler. Kaldığın yerden devam et.</p>
    </div>
    <div class="cat-tabs" style="margin-bottom:16px">
      <button data-tab="books" class="${libTab === 'books' ? 'active' : ''}">📚 Kitaplarım</button>
      <button data-tab="words" class="${libTab === 'words' ? 'active' : ''}">📝 Kelimelerim</button>
    </div>
    <div id="libBody"></div>
  `;

  page.querySelectorAll('.cat-tabs button').forEach(b => {
    b.onclick = () => {
      libTab = b.dataset.tab;
      page.querySelectorAll('.cat-tabs button').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderLibTab();
    };
  });

  renderLibTab();
}

async function renderLibTab() {
  const body = $('#libBody');
  if (!body) return;
  if (libTab === 'books') await renderBooksTab(body);
  else renderWordsTab(body);
}

async function renderBooksTab(body) {
  let books = [];
  try { books = await listBooks(); } catch (e) { console.warn(e); }

  if (!books.length) {
    body.innerHTML = `
      <div class="lib-empty">
        Henüz kitap eklemedin.<br>
        <b>Okuyucu</b> sekmesinden EPUB/PDF yükle → otomatik olarak buraya kaydedilir.
        <div style="margin-top:16px"><button class="btn" onclick="goTo('reader')">📖 Okuyucuya git</button></div>
      </div>`;
    return;
  }

  books.sort((a, b) => (b.added || 0) - (a.added || 0));

  // İlerleme bilgisini de yükle
  const progresses = await Promise.all(books.map(async b => {
    try { return await getProgress(b.id); } catch (e) { return null; }
  }));

  body.innerHTML = `
    <div class="lib-toolbar">
      <input type="text" id="bookSearch" placeholder="Kitap adında ara…">
      <button class="btn ghost" id="clearBooks">🗑️ Tümünü Sil</button>
    </div>
    <div class="lib-grid" id="booksGrid">
      ${books.map((b, i) => {
        const prog = progresses[i];
        const pct = prog && prog.scrollTop ? Math.min(Math.round(prog.scrollTop / 10), 100) : 0;
        return `
        <div class="lib-item">
          <div class="li-actions">
            <button data-act="open" data-id="${b.id}" title="Devam et">📖</button>
            <button data-act="del" data-id="${b.id}" title="Sil">🗑️</button>
          </div>
          <div class="li-ru" style="font-family:inherit;padding-right:70px">${b.name}</div>
          <div class="li-meta">~${(b.wordCount || 0).toLocaleString('tr-TR')} kelime · ${formatDate(b.added)}</div>
          ${prog && prog.scrollTop ? `
            <div style="margin-top:8px;height:4px;background:var(--surface-2);border-radius:4px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:var(--primary-2);border-radius:4px"></div>
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px">📖 Okumaya devam et</div>
          ` : '<div style="font-size:11px;color:var(--muted);margin-top:6px">Henüz açılmadı</div>'}
        </div>`;
      }).join('')}
    </div>
  `;

  $('#bookSearch').oninput = e => {
    const q = e.target.value.toLowerCase();
    const filtered = books.filter(b => b.name.toLowerCase().includes(q));
    $('#booksGrid').innerHTML = filtered.length ? filtered.map(b => `
      <div class="lib-item">
        <div class="li-actions">
          <button data-act="open" data-id="${b.id}" title="Aç">📖</button>
          <button data-act="del" data-id="${b.id}" title="Sil">🗑️</button>
        </div>
        <div class="li-ru" style="font-family:inherit;padding-right:70px">${b.name}</div>
        <div class="li-meta">~${(b.wordCount || 0).toLocaleString('tr-TR')} kelime · ${formatDate(b.added)}</div>
      </div>
    `).join('') : '<div class="lib-empty">Eşleşme yok.</div>';
    bindBookActions();
  };

  $('#clearBooks').onclick = async () => {
    if (!confirm('Tüm kitaplar silinsin mi?')) return;
    const all = await listBooks();
    for (const b of all) await deleteBook(b.id);
    toast('Tüm kitaplar silindi');
    renderBooksTab(body);
  };

  bindBookActions();
}

function bindBookActions() {
  $$('#booksGrid [data-act]').forEach(b => {
    const id = +b.dataset.id;
    if (b.dataset.act === 'open') b.onclick = () => openSavedBook(id);
    if (b.dataset.act === 'del')  b.onclick = async () => {
      if (!confirm('Bu kitap silinsin mi?')) return;
      await deleteBook(id);
      toast('Kitap silindi');
      renderLibTab();
    };
  });
}

function renderWordsTab(body) {
  if (!LIBRARY.length) {
    body.innerHTML = `
      <div class="lib-empty">
        Henüz kelime eklemedin.<br>
        <b>Okuyucu</b>'dan bir kitap açıp kelimelerin üzerine gel → <b>+ Ekle</b> ile kaydet.
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="lib-toolbar">
      <input type="text" id="libSearch" placeholder="Kelimelerde ara…">
      <button class="btn" id="startFlash">🎴 Flash Kart Pratiği</button>
      <button class="btn ghost" id="clearLib">🗑️ Tümünü Sil</button>
    </div>
    <div id="wordsGrid">${renderLibGrid(LIBRARY)}</div>
  `;

  $('#libSearch').oninput = e => {
    const q = norm(e.target.value);
    const filtered = q ? LIBRARY.filter(x => norm(x.lemma).includes(q) || norm(x.tr).includes(q)) : LIBRARY;
    $('#wordsGrid').innerHTML = filtered.length ? renderLibGrid(filtered) : '<div class="lib-empty">Eşleşme yok.</div>';
    bindLibActions();
  };

  $('#startFlash').onclick = () => { if (!LIBRARY.length) { toast('Kütüphane boş'); return; } goTo('practice', 'flash'); };
  $('#clearLib').onclick = () => {
    if (!confirm('Tüm kelimeler silinsin mi?')) return;
    LIBRARY = []; saveLibrary(); renderWordsTab(body);
  };

  bindLibActions();
}

function renderLibGrid(list) {
  return `<div class="lib-grid">${list.map((x, i) => `
    <div class="lib-item">
      <div class="li-actions">
        <button data-act="speak" data-i="${i}" title="Dinle">🔊</button>
        <button data-act="del" data-i="${i}" title="Sil">🗑️</button>
      </div>
      <div class="li-ru">${x.lemma}</div>
      <div class="li-tr">${x.tr || '<em style="color:var(--muted)">çeviri yok</em>'}</div>
      <div class="li-meta">${x.pos || ''} ${x.case ? '· ' + CASE_SHORT[x.case] : ''} ${x.number ? '· ' + NUM_TR[x.number] : ''}</div>
    </div>
  `).join('')}</div>`;
}

function bindLibActions() {
  $$('#wordsGrid [data-act]').forEach(b => {
    const i = +b.dataset.i;
    if (b.dataset.act === 'speak') b.onclick = () => speak(LIBRARY[i].lemma);
    if (b.dataset.act === 'del')   b.onclick = () => { removeFromLibrary(i); renderLibTab(); };
  });
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ============================================================
   20) PRATİK
   ============================================================ */
const PRACTICE = { mode: 'infinite', q: null, answered: false, correct: 0, wrong: 0, streak: 0, total: 0 };

function renderPractice(initialMode) {
  if (initialMode) PRACTICE.mode = initialMode;
  if (!PRACTICE.mode) PRACTICE.mode = 'infinite';
  const hasLib = LIBRARY.length > 0;
  $('#page-practice').innerHTML = `
    <div class="page-head"><h1>Pratik</h1><p>Sonsuz kurallı sorular veya kütüphanenden flash kartlar.</p></div>
    <div class="modes">
      <button class="mode-btn ${PRACTICE.mode === 'infinite' ? 'selected' : ''}" data-mode="infinite">
        <div class="mt">♾️ Sonsuz Pratik</div>
        <div class="md">Morfoloji kurallarıyla üretilen rastgele sorular</div>
      </button>
      <button class="mode-btn ${PRACTICE.mode === 'flash' ? 'selected' : ''}" data-mode="flash" ${hasLib ? '' : 'disabled'}>
        <div class="mt">🎴 Flash Kartlar</div>
        <div class="md">${hasLib ? LIBRARY.length + ' kelime · kütüphanenden' : 'Önce kütüphanene kelime ekle'}</div>
      </button>
    </div>
    <div class="quiz-hud">
      <div class="sc">Doğru: <b id="scOK">0</b></div>
      <div class="sc">Yanlış: <b id="scNO">0</b></div>
      <div class="sc">Seri: <b id="scST">🔥 0</b></div>
      <div class="quiz-bar"><div id="scBar" style="width:0%"></div></div>
    </div>
    <div id="quizArea"></div>
  `;
  $$('#page-practice .mode-btn').forEach(b => {
    b.onclick = () => {
      if (b.disabled) return;
      PRACTICE.mode = b.dataset.mode;
      PRACTICE.correct = 0; PRACTICE.wrong = 0; PRACTICE.streak = 0; PRACTICE.total = 0;
      $$('#page-practice .mode-btn').forEach(x => x.classList.remove('selected'));
      b.classList.add('selected');
      updateQuizHUD();
      nextQuestion();
    };
  });
  updateQuizHUD();
  nextQuestion();
}

function updateQuizHUD() {
  const ok = $('#scOK'), no = $('#scNO'), st = $('#scST'), bar = $('#scBar');
  if (!ok) return;
  ok.textContent = PRACTICE.correct;
  no.textContent = PRACTICE.wrong;
  st.textContent = '🔥 ' + PRACTICE.streak;
  bar.style.width = (PRACTICE.total ? Math.min(PRACTICE.total * 4, 100) : 0) + '%';
}

function nextQuestion() {
  PRACTICE.answered = false;
  PRACTICE.total++;
  updateQuizHUD();

  let q;
  if (PRACTICE.mode === 'flash') q = makeFlashQuestion();
  else q = makeInfiniteQuestion();

  if (!q) { $('#quizArea').innerHTML = '<div class="card"><p>Soru üretilemedi.</p></div>'; return; }
  PRACTICE.q = q;

  const area = $('#quizArea');
  area.innerHTML = `
    <div class="quiz-card">
      <div class="quiz-prompt">
        <div class="q-label">${q.label}</div>
        <div class="q-target">${q.target}</div>
        ${q.sub ? `<div class="q-sub">${q.sub}</div>` : ''}
      </div>
      ${q.type === 'choice' ? `
        <div class="quiz-options">${q.choices.map(c => `<button class="opt-btn" data-v="${c.replace(/"/g, '&quot;')}">${c}</button>`).join('')}</div>
      ` : `
        <div class="quiz-input">
          <input type="text" id="qInput" autocomplete="off" spellcheck="false" placeholder="Rusça yaz…">
          <button class="btn" id="qCheck">Kontrol Et</button>
        </div>
        <div class="keyboard" id="qKb"></div>
      `}
      <div class="quiz-fb" id="qFb"></div>
    </div>
  `;
  if (q.type === 'choice') {
    area.querySelectorAll('.opt-btn').forEach(b => b.onclick = () => handleChoice(b, q));
  } else {
    const inp = $('#qInput');
    inp.focus();
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleText(q); });
    $('#qCheck').onclick = () => handleText(q);
    buildQuizKb();
  }
}

function buildQuizKb() {
  const rows = ['а б в г д е ё ж з и й', 'к л м н о п р с т у ф', 'х ц ч ш щ ъ ы ь э ю я'];
  const kb = $('#qKb'); if (!kb) return;
  kb.innerHTML = '';
  rows.forEach(r => r.split(' ').forEach(ch => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = ch;
    b.onclick = () => { const i = $('#qInput'); i.value += ch; i.focus(); };
    kb.appendChild(b);
  }));
}

const PRACTICE_VERBS = ['читать','говорить','знать','работать','думать','смотреть','видеть','любить','учить','гулять'];
const PRACTICE_NOUNS = DICT.filter(e => e.pos === 'noun');

function makeInfiniteQuestion() {
  const kinds = ['case', 'verb-pres', 'verb-past', 'adj-agree', 'translate-ru', 'translate-tr'];
  const kind = pick(kinds);
  if (kind === 'case') {
    const noun = pick(PRACTICE_NOUNS);
    const c = pick(['gen', 'dat', 'acc', 'ins', 'pre']);
    const forms = declineNoun(noun.ru, noun.gender, noun.anim);
    const answer = forms.sg[c];
    if (!answer) return makeInfiniteQuestion();
    return { type: 'text', label: `"${noun.tr}" — ${CASE_TR[c]} (tekil)`, target: noun.ru, answer, checkFn: v => norm(v) === norm(answer) };
  }
  if (kind === 'verb-pres') {
    const inf = pick(PRACTICE_VERBS);
    const { pr } = conjugateVerb(inf, null);
    const i = Math.floor(Math.random() * 6);
    const pronouns = ['я','ты','он/она','мы','вы','они'];
    const answer = pr[i];
    if (!answer) return makeInfiniteQuestion();
    return { type: 'text', label: `Fiili çekimle (${pronouns[i]})`, target: inf, answer, checkFn: v => norm(v) === norm(answer) };
  }
  if (kind === 'verb-past') {
    const inf = pick(PRACTICE_VERBS);
    const { pa } = conjugateVerb(inf, null);
    const g = pick(['m', 'f', 'n', 'pl']);
    const lbl = { m:'он', f:'она', n:'оно', pl:'они' }[g];
    return { type: 'text', label: `Geçmiş zaman — ${lbl}`, target: inf, answer: pa[g], checkFn: v => norm(v) === norm(pa[g]) };
  }
  if (kind === 'adj-agree') {
    const adj = pick(DICT.filter(e => e.pos === 'adj'));
    const noun = pick(PRACTICE_NOUNS);
    const forms = declineAdj(adj.ru, adj.type);
    const g = noun.gender;
    const correct = forms.nom[g];
    if (!correct) return makeInfiniteQuestion();
    return { type: 'text', label: `"${adj.tr}" + "${noun.ru}" — Nominative uyum`, target: `${adj.ru} + ${noun.ru}`, answer: `${correct} ${noun.ru}`, checkFn: v => norm(v) === norm(correct + ' ' + noun.ru) };
  }
  if (kind === 'translate-ru') {
    const e = pick(DICT.filter(x => x.pos === 'noun' || x.pos === 'verb' || x.pos === 'adj'));
    const wrongs = shuffle(DICT.filter(x => x.tr && x.tr !== e.tr)).slice(0, 3).map(x => x.tr);
    return { type: 'choice', label: 'Türkçe anlamı nedir?', target: e.ru, choices: shuffle([e.tr, ...wrongs]), answer: e.tr };
  }
  if (kind === 'translate-tr') {
    const e = pick(DICT.filter(x => x.pos === 'noun' || x.pos === 'verb' || x.pos === 'adj'));
    const wrongs = shuffle(DICT.filter(x => x.ru !== e.ru)).slice(0, 3).map(x => x.ru);
    return { type: 'choice', label: 'Rusçası nedir?', target: e.tr, choices: shuffle([e.ru, ...wrongs]), answer: e.ru };
  }
  return null;
}

function makeFlashQuestion() {
  if (!LIBRARY.length) return null;
  const e = pick(LIBRARY);
  const dir = Math.random() < .5 ? 'ru2tr' : 'tr2ru';
  if (dir === 'ru2tr') {
    const wrongs = shuffle(LIBRARY.filter(x => x.tr && x.tr !== e.tr)).slice(0, 3).map(x => x.tr);
    if (wrongs.length < 3) return { type: 'text', label: 'Türkçesi nedir?', target: e.lemma, answer: e.tr || '—', checkFn: v => norm(v) === norm(e.tr) };
    return { type: 'choice', label: 'Türkçesi nedir?', target: e.lemma, choices: shuffle([e.tr, ...wrongs]), answer: e.tr };
  } else {
    return { type: 'text', label: 'Rusçası nedir?', target: e.tr || '—', answer: e.lemma, checkFn: v => norm(v) === norm(e.lemma) };
  }
}

function handleChoice(btn, q) {
  if (PRACTICE.answered) return;
  PRACTICE.answered = true;
  const ok = btn.dataset.v === q.answer;
  btn.closest('.quiz-options').querySelectorAll('.opt-btn').forEach(b => {
    b.disabled = true;
    if (b.dataset.v === q.answer) b.classList.add('correct');
  });
  if (!ok) btn.classList.add('wrong');
  result(ok, btn.dataset.v, q.answer);
}

function handleText(q) {
  if (PRACTICE.answered) return;
  const inp = $('#qInput'); const v = inp.value;
  if (!v.trim()) { inp.focus(); return; }
  PRACTICE.answered = true;
  const ok = q.checkFn ? q.checkFn(v) : norm(v) === norm(q.answer);
  inp.disabled = true;
  inp.classList.add(ok ? 'correct' : 'wrong');
  $('#qCheck').disabled = true;
  result(ok, v.trim(), q.answer);
}

function result(ok, userAns, correctAns) {
  if (ok) { PRACTICE.correct++; PRACTICE.streak++; }
  else { PRACTICE.wrong++; PRACTICE.streak = 0; }
  bumpStats(ok);
  updateQuizHUD();

  const fb = $('#qFb');
  if (ok) {
    fb.className = 'quiz-fb ok show';
    fb.innerHTML = `<h4 style="margin:0 0 6px">✅ Doğru!</h4><div class="fb-word ru">${correctAns}</div><button class="next" id="qNext">Sonraki →</button>`;
  } else {
    fb.className = 'quiz-fb no show';
    fb.innerHTML = `<h4 style="margin:0 0 6px">❌ Yanlış</h4><div style="font-size:13px;color:var(--muted)">Doğru:</div><div class="fb-word ru">${correctAns}</div><div style="font-size:12.5px;color:var(--muted);margin-top:4px">Senin: ${userAns}</div><button class="next" id="qNext">Sonraki →</button>`;
  }
  $('#qNext').onclick = () => nextQuestion();
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ============================================================
   21) ÇEVİRİ AYARLARI (Ayarlar penceresi)
   ============================================================ */
function openTransSettings() {
  const modal = el(`
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:grid;place-items:center;padding:20px">
      <div style="background:#fff;border-radius:16px;padding:24px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <h3 style="margin:0 0 12px">⚙️ Çeviri Motoru</h3>
        <p style="font-size:13.5px;color:var(--muted);margin-bottom:16px">
          DeepL daha doğru çeviri yapar ancak tarayıcıdan doğrudan çağrılamaz. Bir proxy kurman gerekir.
        </p>
        <div style="margin-bottom:14px">
          <label style="display:flex;gap:10px;align-items:center;padding:10px;border:2px solid var(--line);border-radius:10px;cursor:pointer;margin-bottom:8px">
            <input type="radio" name="engine" value="mymemory" ${TRANS_SETTINGS.engine==='mymemory'?'checked':''}>
            <div><b>MyMemory</b><div style="font-size:12px;color:var(--muted)">Ücretsiz, hemen çalışır, orta kalite</div></div>
          </label>
          <label style="display:flex;gap:10px;align-items:center;padding:10px;border:2px solid var(--line);border-radius:10px;cursor:pointer">
            <input type="radio" name="engine" value="deepl" ${TRANS_SETTINGS.engine==='deepl'?'checked':''}>
            <div><b>DeepL (proxy üzerinden)</b><div style="font-size:12px;color:var(--muted)">Yüksek kalite, proxy URL gerekir</div></div>
          </label>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">DeepL Proxy URL</label>
          <input type="text" id="deeplProxyInput" value="${TRANS_SETTINGS.deeplProxyUrl || ''}" placeholder="http://localhost:8000" style="width:100%;padding:10px 12px;border:1.5px solid var(--line);border-radius:9px;font-family:inherit;font-size:14px">
          <div style="font-size:11.5px;color:var(--muted);margin-top:4px">
            Örnek: <a href="https://github.com/DeepL/deepl-api-nodejs-proxy" target="_blank" style="color:var(--primary)">DeepL/deepl-api-nodejs-proxy</a>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn ghost" id="cancelBtn">İptal</button>
          <button class="btn" id="saveBtn">Kaydet</button>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(modal);

  modal.querySelector('#cancelBtn').onclick = () => modal.remove();
  modal.querySelector('#saveBtn').onclick = () => {
    const engine = modal.querySelector('input[name="engine"]:checked').value;
    const proxy = modal.querySelector('#deeplProxyInput').value.trim();
    TRANS_SETTINGS.engine = engine;
    TRANS_SETTINGS.deeplProxyUrl = proxy;
    saveTransSettings();
    TRANS_CACHE = {}; // Çeviri önbelleğini temizle (motor değişti)
    saveTransCache();
    toast('Kaydedildi: ' + (engine === 'deepl' ? 'DeepL proxy' : 'MyMemory'));
    modal.remove();
  };
}

/* ============================================================
   22) NAVİGASYON + BAŞLAT
   ============================================================ */
const PAGES = ['home', 'alphabet', 'grammar', 'reader', 'library', 'practice'];

function goTo(page, extra) {
  if (!PAGES.includes(page)) page = 'home';
  $$('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  $$('.main-nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#mainNav')?.classList.remove('open');
  hidePopover();

  if (page === 'home')     renderHome();
  if (page === 'alphabet') renderAlphabet();
  if (page === 'grammar')  renderGrammar();
  if (page === 'reader')   renderReader();
  if (page === 'library')  renderLibrary();
  if (page === 'practice') renderPractice(extra);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.goTo = goTo;
window.openTransSettings = openTransSettings;

function init() {
  loadLibrary();
  loadTransCache();
  loadTransSettings();
  buildFormIndex();
  openDB().catch(e => console.warn('IndexedDB yok:', e));

  $$('.main-nav button').forEach(b => b.onclick = () => goTo(b.dataset.page));
  $('#navToggle').onclick = () => $('#mainNav').classList.toggle('open');

  goTo('home');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();