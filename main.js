/* ============================================================
   Rusça Öğren — Ana Uygulama
   Bölümler:
     1) Yardımcılar
     2) Alfabe
     3) Sözlük (temel kelimeler)
     4) İstisnalar (düzensiz formlar)
     5) Morfoloji motoru (isim/fiil/sıfat)
     6) Form indeksi (otomatik oluşturulur)
     7) Kelime analizcisi
     8) Ses (Web Speech)
     9) EPUB/PDF ayrıştırıcı
     10) Kütüphane (localStorage)
     11) Flash kart & Sonsuz pratik
     12) Görünümler (Home, Alfabe, Gramer, Okuyucu, Kütüphane, Pratik)
     13) Navigasyon + başlat
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
const uniq = a => [...new Set(a)];

function toast(msg) {
  let t = $('.toast');
  if (!t) { t = el('<div class="toast"></div>'); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
}

function isCyrillic(w) { return /[а-яё]/i.test(w); }

/* ============================================================
   2) ALFABE
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
   3) SÖZLÜK — temel kelimeler (lemmalar)
   pos: 'noun' | 'verb' | 'adj' | 'adv' | 'int' | 'pron'
   ============================================================ */
const DICT = [
  // İfadeler
  { ru:'привет', tr:'merhaba', pos:'int' },
  { ru:'здравствуйте', tr:'merhaba (resmi)', pos:'int' },
  { ru:'спасибо', tr:'teşekkürler', pos:'int' },
  { ru:'пожалуйста', tr:'lütfen / bir şey değil', pos:'int' },
  { ru:'да', tr:'evet', pos:'int' },
  { ru:'нет', tr:'hayır', pos:'int' },
  { ru:'извините', tr:'affedersiniz', pos:'int' },
  { ru:'хорошо', tr:'iyi / tamam', pos:'adv' },
  { ru:'плохо', tr:'kötü', pos:'adv' },

  // İsimler — eril
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
  { ru:'стол', tr:'masa', pos:'noun', gender:'m', anim:false },
  { ru:'словарь', tr:'sözlük', pos:'noun', gender:'m', anim:false, soft:true },
  { ru:'музей', tr:'müze', pos:'noun', gender:'m', anim:false, soft:true },
  { ru:'медведь', tr:'ayı', pos:'noun', gender:'m', anim:true, soft:true },
  { ru:'конь', tr:'at', pos:'noun', gender:'m', anim:true, soft:true },
  { ru:'гость', tr:'misafir', pos:'noun', gender:'m', anim:true, soft:true },

  // İsimler — dişil
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

  // İsimler — nötr
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

  // Sıfatlar
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

  // Fiiller
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
   4) İSTİSNALAR — düzensiz çekimler
   ============================================================ */
const NOUN_IRR = {
  // İsim → tüm hâller
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
  'дерево': { pl:{ nom:'деревья', gen:'деревьев', dat:'деревьям', acc:'деревья', ins:'деревьями', pre:'деревьях' } },
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
  'быть':  { pr:['есть','есть','есть','есть','есть','есть'], pa:{m:'был',f:'была',n:'было',pl:'были'} },
  'идти':  { pr:['иду','идёшь','идёт','идём','идёте','идут'], pa:{m:'шёл',f:'шла',n:'шло',pl:'шли'} },
  'есть':  { pr:['ем','ешь','ест','едим','едите','едят'], pa:{m:'ел',f:'ела',n:'ело',pl:'ели'} },
  'пить':  { pr:['пью','пьёшь','пьёт','пьём','пьёте','пьют'], pa:{m:'пил',f:'пила',n:'пило',pl:'пили'} },
  'жить':  { pr:['живу','живёшь','живёт','живём','живёте','живут'], pa:{m:'жил',f:'жила',n:'жило',pl:'жили'} },
  'хотеть':{ pr:['хочу','хочешь','хочет','хотим','хотите','хотят'], pa:{m:'хотел',f:'хотела',n:'хотело',pl:'хотели'} },
  'мочь':  { pr:['могу','можешь','может','можем','можете','могут'], pa:{m:'мог',f:'могла',n:'могло',pl:'могли'} },
  'писать':{ pr:['пишу','пишешь','пишет','пишем','пишете','пишут'], pa:{m:'писал',f:'писала',n:'писало',pl:'писали'} }
};

/* ============================================================
   5) MORFOLOJİ MOTORU
   ============================================================ */

/* ---- 5.1 İsim ---- */

// Cinsiyet tahmini (sözlükte yoksa)
function guessGender(nom) {
  const w = norm(nom);
  if (w.endsWith('а') || w.endsWith('я')) return 'f';
  if (w.endsWith('о') || w.endsWith('е')) return 'n';
  if (w.endsWith('мя')) return 'n';
  if (w.endsWith('ь')) {
    // -ость/-есть/-сть/-нь/-чь/-шь/-жь/-щь → dişil
    if (/[ое]сть$/.test(w) || /[жчшщ]ь$/.test(w) || /нь$/.test(w)) return 'f';
    return 'm'; // varsayılan
  }
  return 'm';
}

function isAfterWriteRule(stem) {
  return /[кгхжчшщ]$/.test(stem);
}

// İsim gövdesini al (Nominative'den)
function nounStem(nom, gender) {
  const w = norm(nom);
  if (gender === 'f' && /[ая]$/.test(w)) return w.slice(0, -1);
  if (gender === 'n' && /[ое]$/.test(w)) return w.slice(0, -1);
  if (gender === 'n' && w.endsWith('мя')) return w.slice(0, -2);
  if (w.endsWith('ь') || w.endsWith('й')) return w.slice(0, -1);
  return w;
}

// İsim çekimi — tüm formlar
function declineNoun(nom, gender, anim) {
  const key = norm(nom);
  const ov = NOUN_IRR[key] || {};
  const w = norm(nom);
  const g = gender || guessGender(w);
  const an = !!anim;
  const soft = /[яеёюьй]$/.test(w) || key.endsWith('ь');
  const st = nounStem(w, g);

  // Tekil
  let sg = { nom: w };
  if (ov.sg) {
    sg = { ...sg, ...ov.sg };
  } else if (g === 'm') {
    // Eril
    const isSoft = key.endsWith('ь') || key.endsWith('й');
    if (isSoft) {
      sg.gen = st + 'я';
      sg.dat = st + 'ю';
      sg.acc = an ? st + 'я' : w;
      sg.ins = st + (key.endsWith('й') ? 'ем' : 'ём');
      sg.pre = st + 'е';
    } else {
      sg.gen = st + 'а';
      sg.dat = st + 'у';
      sg.acc = an ? st + 'а' : w;
      sg.ins = st + 'ом';
      sg.pre = st + 'е';
    }
    // -ий sonu
    if (key.endsWith('ий')) {
      sg.gen = st + 'ия';
      sg.dat = st + 'ию';
      sg.acc = an ? st + 'ия' : w;
      sg.ins = st + 'ием';
      sg.pre = st + 'ии';
    }
  } else if (g === 'f') {
    if (key.endsWith('а')) {
      const isZhi = /[кгхжчшщ]а$/.test(w);
      sg.gen = st + (isZhi ? 'и' : 'ы');
      sg.dat = st + 'е';
      sg.acc = st + 'у';
      sg.ins = st + (/[жчшщ]а$/.test(w) ? 'ей' : 'ой');
      sg.pre = st + 'е';
    } else if (key.endsWith('я')) {
      sg.gen = st + 'и';
      sg.dat = st + 'е';
      sg.acc = st + 'ю';
      sg.ins = st + 'ей';
      sg.pre = st + 'е';
    } else if (key.endsWith('ь')) {
      sg.gen = st + 'и';
      sg.dat = st + 'и';
      sg.acc = w;
      sg.ins = st + 'ью';
      sg.pre = st + 'и';
    }
  } else if (g === 'n') {
    if (key.endsWith('о')) {
      sg.gen = st + 'а';
      sg.dat = st + 'у';
      sg.acc = w;
      sg.ins = st + 'ом';
      sg.pre = st + 'е';
    } else if (key.endsWith('е')) {
      sg.gen = st + 'я';
      sg.dat = st + 'ю';
      sg.acc = w;
      sg.ins = st + 'ем';
      sg.pre = st + 'е';
    }
  }

  // Çoğul
  let pl = { nom: w };
  if (ov.pl) {
    pl = { ...ov.pl, nom: ov.pl.nom || w };
  } else if (g === 'm') {
    const isSoft = key.endsWith('ь') || key.endsWith('й');
    if (isSoft) {
      pl.nom = st + 'и';
      pl.gen = st + 'ей';
      pl.dat = st + 'ям';
      pl.acc = an ? pl.gen : pl.nom;
      pl.ins = st + 'ями';
      pl.pre = st + 'ях';
    } else {
      const isZhi = isAfterWriteRule(st);
      pl.nom = st + (isZhi ? 'и' : 'ы');
      pl.gen = st + 'ов';
      pl.dat = st + 'ам';
      pl.acc = an ? pl.gen : pl.nom;
      pl.ins = st + 'ами';
      pl.pre = st + 'ах';
    }
  } else if (g === 'f') {
    if (key.endsWith('а')) {
      const isZhi = /[кгхжчшщ]а$/.test(w);
      pl.nom = st + (isZhi ? 'и' : 'ы');
      // Fleeting vowel: -ка → -ек, -ца → -ец gibi kurallar
      pl.gen = st;
      pl.dat = st + 'ам';
      pl.acc = pl.nom;
      pl.ins = st + 'ами';
      pl.pre = st + 'ах';
    } else if (key.endsWith('я')) {
      pl.nom = st + 'и';
      pl.gen = st + 'ь';
      pl.dat = st + 'ям';
      pl.acc = pl.nom;
      pl.ins = st + 'ями';
      pl.pre = st + 'ях';
    } else if (key.endsWith('ь')) {
      pl.nom = st + 'и';
      pl.gen = st + 'ей';
      pl.dat = st + 'ям';
      pl.acc = pl.nom;
      pl.ins = st + 'ями';
      pl.pre = st + 'ях';
    }
  } else if (g === 'n') {
    if (key.endsWith('о')) {
      pl.nom = st + 'а';
      pl.gen = st; // örn. окно → окон (istisna sözlüğü)
      pl.dat = st + 'ам';
      pl.acc = pl.nom;
      pl.ins = st + 'ами';
      pl.pre = st + 'ах';
    } else if (key.endsWith('е')) {
      pl.nom = st + 'я';
      pl.gen = st + 'ей';
      pl.dat = st + 'ям';
      pl.acc = pl.nom;
      pl.ins = st + 'ями';
      pl.pre = st + 'ях';
    }
  }

  return { sg, pl };
}

/* ---- 5.2 Fiil ---- */
function conjugateVerb(inf, conj) {
  const key = norm(inf);
  const irr = VERB_IRR[key];
  if (irr) return { pr: irr.pr, pa: irr.pa };

  const c = conj || (key.endsWith('ить') ? 2 : 1);
  const st = key.replace(/ть$/, '').replace(/ить$/, '').replace(/ать$/, '');
  const fullStem = key.replace(/ть$/, '');

  let pr, pa;

  if (c === 2) {
    pr = [st + 'ю', st + 'ишь', st + 'ит', st + 'им', st + 'ите', st + 'ят'];
  } else {
    pr = [st + 'ю', st + 'ешь', st + 'ет', st + 'ем', st + 'ете', st + 'ют'];
  }

  // -ать ile biten: kök + ю
  if (key.endsWith('ать')) {
    const root = key.slice(0, -3);
    pr = [root + 'аю', root + 'аешь', root + 'ает', root + 'аем', root + 'аете', root + 'ают'];
  } else if (key.endsWith('ять')) {
    const root = key.slice(0, -3);
    pr = [root + 'яю', root + 'яешь', root + 'яет', root + 'яем', root + 'яете', root + 'яют'];
  } else if (key.endsWith('ить')) {
    const root = key.slice(0, -3);
    pr = [root + 'ю', root + 'ишь', root + 'ит', root + 'им', root + 'ите', root + 'ят'];
  } else if (key.endsWith('еть')) {
    const root = key.slice(0, -3);
    pr = [root + 'ю', root + 'ешь', root + 'ет', root + 'ем', root + 'ете', root + 'ют'];
  }

  pa = { m: fullStem + 'л', f: fullStem + 'ла', n: fullStem + 'ло', pl: fullStem + 'ли' };

  return { pr, pa };
}

/* ---- 5.3 Sıfat ---- */
function declineAdj(nom, type) {
  const key = norm(nom);
  let st = key;
  if (key.endsWith('ий')) st = key.slice(0, -2);
  else if (key.endsWith('ый')) st = key.slice(0, -2);
  else if (key.endsWith('ой')) st = key.slice(0, -2);

  const T = {
    nom: { m:key,        f:st + 'ая',  n:st + 'ое',  p:st + 'ые' },
    gen: { m:st + 'ого', f:st + 'ой',  n:st + 'ого', p:st + 'ых' },
    dat: { m:st + 'ому', f:st + 'ой',  n:st + 'ому', p:st + 'ым' },
    acc: { m:key,        f:st + 'ую',  n:st + 'ое',  p:st + 'ые' },
    ins: { m:st + 'ым',  f:st + 'ой',  n:st + 'ым',  p:st + 'ыми' },
    pre: { m:st + 'ом',  f:st + 'ой',  n:st + 'ом',  p:st + 'ых' }
  };
  return T;
}

/* ============================================================
   6) FORM İNDEKSİ — tüm sözlük kelimelerinin formlarını indexle
   ============================================================ */
const FORM_INDEX = {}; // form → [ { lemma, tr, pos, gender?, case?, number?, ... } ]

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
        FORM_INDEX[k].push({ lemma: e.ru, tr: e.tr, pos: 'verb', tense: 'pres', person: i, number: i === 3 ? 'pl' : 'sg', case: '—' });
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
   7) KELİME ANALİZCİSİ
   ============================================================ */
const CASE_TR = { nom:'Nominative (yalın)', gen:'Genitive (tamlayan)', dat:'Dative (yönelme)', acc:'Accusative (belirtme)', ins:'Instrumental (araç)', pre:'Prepositional (bulunma)' };
const CASE_SHORT = { nom:'Nom', gen:'Gen', dat:'Dat', acc:'Acc', ins:'Ins', pre:'Pre' };
const NUM_TR = { sg:'tekil', pl:'çoğul' };
const G_TR = { m:'eril', f:'dişil', n:'nötr', '—':'—' };
const PERSON_TR = ['1. tekil', '2. tekil', '3. tekil', '1. çoğul', '2. çoğul', '3. çoğul'];

function analyzeWord(raw) {
  const word = norm((raw || '').replace(/[^\u0400-\u04FF]/g, ''));
  if (!word) return null;

  // 1. Doğrudan sözlük eşleşmesi (lemma)
  const direct = DICT.find(e => norm(e.ru) === word);
  if (direct) {
    return {
      word, lemma: direct.ru, tr: direct.tr, pos: direct.pos,
      gender: direct.gender, anim: direct.anim,
      case: 'nom', number: 'sg',
      confidence: 'high',
      allForms: direct.pos === 'noun' ? declineNoun(direct.ru, direct.gender, direct.anim) :
                direct.pos === 'verb' ? conjugateVerb(direct.ru, direct.conj) :
                direct.pos === 'adj' ? declineAdj(direct.ru, direct.type) : null
    };
  }

  // 2. Form indeksi
  if (FORM_INDEX[word]) {
    const hit = FORM_INDEX[word][0];
    const lemmaEntry = DICT.find(e => norm(e.ru) === norm(hit.lemma));
    return {
      word, lemma: hit.lemma, tr: hit.tr, pos: hit.pos,
      gender: hit.gender, anim: hit.anim,
      case: hit.case, number: hit.number,
      tense: hit.tense, person: hit.person,
      confidence: 'high',
      allForms: lemmaEntry && lemmaEntry.pos === 'noun' ? declineNoun(lemmaEntry.ru, lemmaEntry.gender, lemmaEntry.anim) :
                lemmaEntry && lemmaEntry.pos === 'verb' ? conjugateVerb(lemmaEntry.ru, lemmaEntry.conj) : null
    };
  }

  // 3. Sezgisel analiz
  return heuristicAnalyze(word);
}

function heuristicAnalyze(word) {
  // Son ekleri sırayla dene: en uzundan kısaya
  const endings = [
    { e:'ами',  c:'ins', n:'pl', g:'—' }, { e:'ями', c:'ins', n:'pl', g:'—' },
    { e:'ах',   c:'pre', n:'pl', g:'—' }, { e:'ях',  c:'pre', n:'pl', g:'—' },
    { e:'ам',   c:'dat', n:'pl', g:'—' }, { e:'ям',  c:'dat', n:'pl', g:'—' },
    { e:'ов',   c:'gen', n:'pl', g:'m' }, { e:'ев',  c:'gen', n:'pl', g:'m' },
    { e:'ей',   c:'gen', n:'pl', g:'—' },
    { e:'ого',  c:'gen', n:'sg', g:'m', pos:'adj' },
    { e:'его',  c:'gen', n:'sg', g:'m', pos:'adj' },
    { e:'ому',  c:'dat', n:'sg', g:'m', pos:'adj' },
    { e:'ему',  c:'dat', n:'sg', g:'m', pos:'adj' },
    { e:'ыми',  c:'ins', n:'pl', g:'—', pos:'adj' },
    { e:'ими',  c:'ins', n:'pl', g:'—', pos:'adj' },
    { e:'ый',   c:'nom', n:'sg', g:'m', pos:'adj' },
    { e:'ий',   c:'nom', n:'sg', g:'m', pos:'adj' },
    { e:'ой',   c:'nom', n:'sg', g:'m', pos:'adj' },
    { e:'ая',   c:'nom', n:'sg', g:'f', pos:'adj' },
    { e:'яя',   c:'nom', n:'sg', g:'f', pos:'adj' },
    { e:'ое',   c:'nom', n:'sg', g:'n', pos:'adj' },
    { e:'ее',   c:'nom', n:'sg', g:'n', pos:'adj' },
    { e:'ые',   c:'nom', n:'pl', g:'—', pos:'adj' },
    { e:'ие',   c:'nom', n:'pl', g:'—', pos:'adj' },
    { e:'ой',   c:'ins', n:'sg', g:'f' },
    { e:'ей',   c:'ins', n:'sg', g:'f' },
    { e:'ом',   c:'ins', n:'sg', g:'m' },
    { e:'ем',   c:'ins', n:'sg', g:'m' },
    { e:'а',    c:'gen', n:'sg', g:'m' },
    { e:'я',    c:'gen', n:'sg', g:'m' },
    { e:'у',    c:'dat', n:'sg', g:'m' },
    { e:'ю',    c:'dat', n:'sg', g:'m' },
    { e:'е',    c:'pre', n:'sg', g:'m' },
    { e:'ы',    c:'nom', n:'pl', g:'—' },
    { e:'и',    c:'nom', n:'pl', g:'—' },
    { e:'ла',   c:'—',   n:'sg', g:'f', pos:'verb', tense:'past' },
    { e:'ло',   c:'—',   n:'sg', g:'n', pos:'verb', tense:'past' },
    { e:'ли',   c:'—',   n:'pl', g:'—', pos:'verb', tense:'past' },
    { e:'л',    c:'—',   n:'sg', g:'m', pos:'verb', tense:'past' },
    { e:'ть',   c:'—',   n:'sg', g:'—', pos:'verb', tense:'inf' }
  ];

  for (const en of endings) {
    if (word.endsWith(en.e) && word.length > en.e.length + 1) {
      const stem = word.slice(0, -en.e.length);
      // Bilinen lemma mı?
      const candidate = DICT.find(d => norm(d.ru) === stem);
      return {
        word,
        lemma: candidate ? candidate.ru : stem,
        tr: candidate ? candidate.tr : null,
        pos: en.pos || 'noun',
        gender: en.g,
        case: en.c,
        number: en.n,
        tense: en.tense,
        confidence: candidate ? 'medium' : 'low',
        allForms: null
      };
    }
  }

  // Hiç eşleşme yok
  return {
    word, lemma: word, tr: null, pos: '?',
    case: '—', number: '—',
    confidence: 'low',
    allForms: null
  };
}

/* ============================================================
   8) SES
   ============================================================ */
let ruVoice = null;
if ('speechSynthesis' in window) {
  const load = () => {
    const v = speechSynthesis.getVoices();
    ruVoice = v.find(x => x.lang.toLowerCase().startsWith('ru')) || null;
  };
  load();
  speechSynthesis.onvoiceschanged = load;
}
function speak(text) {
  if (!('speechSynthesis' in window)) { toast('Tarayıcı sesi desteklemiyor'); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ru-RU'; u.rate = .85;
    if (ruVoice) u.voice = ruVoice;
    speechSynthesis.speak(u);
  } catch (e) { toast('Ses çalınamadı'); }
}

/* ============================================================
   9) EPUB / PDF AYRIŞTIRICI
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
  if (!opfPath) {
    opfPath = Object.keys(zip.files).find(k => k.toLowerCase().endsWith('.opf'));
  }
  if (!opfPath) throw new Error('EPUB yapısı okunamadı');

  const basePath = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfStr = await zip.file(opfPath).async('string');
  const opf = parser.parseFromString(opfStr, 'application/xml');

  const manifest = {};
  opf.querySelectorAll('manifest > item').forEach(it => {
    manifest[it.getAttribute('id')] = it.getAttribute('href');
  });
  const spine = [...opf.querySelectorAll('spine > itemref')]
    .map(r => manifest[r.getAttribute('idref')]).filter(Boolean);

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
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
   10) KÜTÜPHANE
   ============================================================ */
const LIB_KEY = 'rusca-library-v1';
let LIBRARY = [];

function loadLibrary() {
  try { LIBRARY = JSON.parse(localStorage.getItem(LIB_KEY) || '[]'); } catch (e) { LIBRARY = []; }
}
function saveLibrary() {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(LIBRARY)); } catch (e) {}
}
function addToLibrary(entry) {
  const key = norm(entry.lemma || entry.word);
  if (LIBRARY.some(x => norm(x.lemma || x.word) === key)) {
    toast('Bu kelime zaten kütüphanede');
    return false;
  }
  LIBRARY.unshift({
    word: entry.word,
    lemma: entry.lemma || entry.word,
    tr: entry.tr || '',
    pos: entry.pos || '?',
    case: entry.case, number: entry.number,
    context: (entry.context || '').slice(0, 120),
    added: Date.now()
  });
  saveLibrary();
  toast('Kütüphaneye eklendi: ' + (entry.lemma || entry.word));
  return true;
}
function removeFromLibrary(idx) {
  LIBRARY.splice(idx, 1);
  saveLibrary();
}

/* ============================================================
   11) İSTATİSTİKLER
   ============================================================ */
const STATS_KEY = 'rusca-stats-v1';
function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{}'); }
  catch (e) { return {}; }
}
function saveStats(s) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) {}
}
function bumpStats(ok) {
  const s = loadStats();
  s.correct = s.correct || 0; s.wrong = s.wrong || 0;
  if (ok) s.correct++; else s.wrong++;
  s.total = s.correct + s.wrong;
  saveStats(s);
}

/* ============================================================
   12) GÖRÜNÜMLER
   ============================================================ */

/* ---------- 12.1 Ana Sayfa ---------- */
function renderHome() {
  const s = loadStats();
  const lib = LIBRARY.length;
  $('#page-home').innerHTML = `
    <div class="hero">
      <h1>Rusçayı Türkçe konuşanlar için öğren</h1>
      <p>Kural tabanlı morfoloji motoru, EPUB/PDF okuyucu, kelime üzerine gelince anlık analiz, kişisel kütüphane ve sonsuz pratik — hepsi tek yerde.</p>
      <div class="hero-actions">
        <button class="primary" data-go="reader">Kitap yükle</button>
        <button class="ghost" data-go="practice">Pratiğe geç</button>
      </div>
    </div>

    <div class="features">
      <button class="feature" data-go="alphabet"><div class="icon">Аа</div><h3>Alfabe</h3><p>33 Kiril harfi, telaffuzu, örnekleri</p></button>
      <button class="feature" data-go="grammar"><div class="icon">📐</div><h3>Gramer</h3><p>Hâller, cinsiyet, fiil çekimi, sıfat uyumu</p></button>
      <button class="feature" data-go="reader"><div class="icon">📖</div><h3>Okuyucu</h3><p>EPUB/PDF yükle, kelime üzerine gel → analiz</p></button>
      <button class="feature" data-go="library"><div class="icon">📚</div><h3>Kütüphanem</h3><p>${lib} kayıtlı kelime · flash kartlarla çalış</p></button>
      <button class="feature" data-go="practice"><div class="icon">🎯</div><h3>Pratik</h3><p>Sonsuz soru, kurallı morfoloji</p></button>
    </div>

    <h2>İlerlemen</h2>
    <div class="progress-panel">
      <div class="stat"><div class="label">Doğru</div><div class="value">${s.correct || 0}</div></div>
      <div class="stat"><div class="label">Yanlış</div><div class="value">${s.wrong || 0}</div></div>
      <div class="stat"><div class="label">Başarı</div><div class="value">${s.total ? Math.round(s.correct / s.total * 100) + '%' : '—'}</div></div>
      <div class="stat"><div class="label">Kütüphane</div><div class="value">${lib}</div></div>
    </div>

    <div class="card" style="margin-top:20px">
      <h3>🔍 Nasıl çalışır?</h3>
      <ul style="margin:8px 0 0 20px; padding:0; font-size:14px; line-height:1.9">
        <li><b>Okuyucu</b> sekmesinden EPUB veya PDF kitabını yükle</li>
        <li>Okurken bir kelimenin <b>üzerine gel</b> → kural tabanlı analiz açılır: kök, cinsiyet, hâl, çekim tablosu</li>
        <li>Beğendiğin kelimeyi <b>"+ Kütüphaneme ekle"</b> ile kaydet</li>
        <li><b>Kütüphanem</b> sekmesinden flash kartlarla çalış</li>
        <li><b>Pratik</b> sekmesinden sonsuz sorularla grameri pekiştir</li>
      </ul>
    </div>
  `;
  $('#page-home').querySelectorAll('[data-go]').forEach(b => b.onclick = () => goTo(b.dataset.go));
}

/* ---------- 12.2 Alfabe ---------- */
function renderAlphabet() {
  $('#page-alphabet').innerHTML = `
    <div class="page-head">
      <h1>Kiril Alfabesi</h1>
      <p>33 harf. Harfe tıkla → telaffuzu dinle. Türkçe okunuşu ve örnek kelime yanında.</p>
    </div>
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
    c.onclick = () => {
      const l = ALPHABET[+c.dataset.i];
      speak(l.ex);
      toast(`${l.up}${l.low} — ${l.ex} (${l.tr})`);
    };
  });
}

/* ---------- 12.3 Gramer ---------- */
const GRAMMAR = {
  'Cinsiyet': {
    body: `
      <div class="card">
        <h3>Kurallar</h3>
        <table class="data">
          <tr><th>Cinsiyet</th><th>Son harf</th><th>Örnek</th></tr>
          <tr><td>Eril</td><td>ünsüz, -й, bazı -ь</td><td><span class="ru">стол, музей, словарь</span></td></tr>
          <tr><td>Dişil</td><td>-а, -я, bazı -ь</td><td><span class="ru">книга, неделя, тетрадь</span></td></tr>
          <tr><td>Nötr</td><td>-о, -е, -мя</td><td><span class="ru">окно, море, время</span></td></tr>
        </table>
        <div class="callout"><b>İpucu:</b> -ость, -сть, -нь, -жь, -чь, -шь, -щь ile bitenler <b>dişil</b>'dir. Diğer -ь'ler eril olabilir.</div>
      </div>`
  },
  'Çoğul': {
    body: `
      <div class="card">
        <h3>Çoğul Yapımı</h3>
        <table class="data">
          <tr><th>Tekil</th><th>Çoğul</th><th>Kural</th></tr>
          <tr><td class="ru">стол</td><td class="ru">столы</td><td>Eril sert → -ы</td></tr>
          <tr><td class="ru">словарь</td><td class="ru">словари</td><td>Eril yumuşak → -и</td></tr>
          <tr><td class="ru">книга</td><td class="ru">книги</td><td>Dişil -а → -и (г sonrası)</td></tr>
          <tr><td class="ru">неделя</td><td class="ru">недели</td><td>Dişil -я → -и</td></tr>
          <tr><td class="ru">окно</td><td class="ru">окна</td><td>Nötr -о → -а</td></tr>
          <tr><td class="ru">море</td><td class="ru">моря</td><td>Nötr -е → -я</td></tr>
        </table>
        <div class="callout warn"><b>Yazım kuralı:</b> к, г, х, ж, ч, ш, щ sonrası <b>-ы değil -и</b>: <span class="ru">книга → книги</span>.</div>
      </div>`
  },
  'Hâller (Cases)': {
    body: `
      <div class="card">
        <h3>6 Hâl</h3>
        <table class="data">
          <tr><th>#</th><th>Hâl</th><th>Soru</th><th>Türkçe</th></tr>
          <tr><td>1</td><td class="ru">Именительный</td><td>Кто? Что?</td><td>Yalın (özne)</td></tr>
          <tr><td>2</td><td class="ru">Родительный</td><td>Кого? Чего?</td><td>-in / -den</td></tr>
          <tr><td>3</td><td class="ru">Дательный</td><td>Кому? Чему?</td><td>-e (yönelme)</td></tr>
          <tr><td>4</td><td class="ru">Винительный</td><td>Кого? Что?</td><td>-i (belirtme)</td></tr>
          <tr><td>5</td><td class="ru">Творительный</td><td>Кем? Чем?</td><td>-ile</td></tr>
          <tr><td>6</td><td class="ru">Предложный</td><td>О ком? Где?</td><td>-de / hakkında</td></tr>
        </table>
      </div>
      <div class="card">
        <h3>Ekler (Tekil)</h3>
        <table class="data">
          <tr><th>Hâl</th><th>Eril</th><th>Dişil</th><th>Nötr</th></tr>
          <tr><td>Nom</td><td class="ru">-∅/-й/-ь</td><td class="ru">-а/-я</td><td class="ru">-о/-е</td></tr>
          <tr><td>Gen</td><td class="ru">-а/-я</td><td class="ru">-ы/-и</td><td class="ru">-а/-я</td></tr>
          <tr><td>Dat</td><td class="ru">-у/-ю</td><td class="ru">-е</td><td class="ru">-у/-ю</td></tr>
          <tr><td>Acc</td><td class="ru">canlı: Gen · cansız: Nom</td><td class="ru">-у/-ю</td><td class="ru">= Nom</td></tr>
          <tr><td>Ins</td><td class="ru">-ом/-ем</td><td class="ru">-ой/-ей</td><td class="ru">-ом/-ем</td></tr>
          <tr><td>Pre</td><td class="ru">-е</td><td class="ru">-е</td><td class="ru">-е</td></tr>
        </table>
      </div>`
  },
  'Fiiller': {
    body: `
      <div class="card">
        <h3>Şimdiki Zaman — I. ve II. Çekim</h3>
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
          <tr><th>Özne</th><th>читать (okumak)</th></tr>
          <tr><td>он (eril)</td><td class="ru">читал</td></tr>
          <tr><td>она (dişil)</td><td class="ru">читала</td></tr>
          <tr><td>оно (nötr)</td><td class="ru">читало</td></tr>
          <tr><td>они (çoğul)</td><td class="ru">читали</td></tr>
        </table>
        <div class="callout"><b>Kural:</b> Geçmiş zaman -л + cinsiyet eki. Özneye göre değişir.</div>
      </div>`
  },
  'Sıfatlar': {
    body: `
      <div class="card">
        <h3>Nominative Sıfat Ekleri</h3>
        <table class="data">
          <tr><th>Cinsiyet</th><th>Ek</th><th>Örnek</th></tr>
          <tr><td>Eril</td><td class="ru">-ый / -ий / -ой</td><td class="ru">новый</td></tr>
          <tr><td>Dişil</td><td class="ru">-ая / -яя</td><td class="ru">новая</td></tr>
          <tr><td>Nötr</td><td class="ru">-ое / -ее</td><td class="ru">новое</td></tr>
          <tr><td>Çoğul</td><td class="ru">-ые / -ие</td><td class="ru">новые</td></tr>
        </table>
      </div>
      <div class="card">
        <h3>Çekim — новая книга</h3>
        <table class="data">
          <tr><th>Hâl</th><th>Tekil</th><th>Çoğul</th></tr>
          <tr><td>Nom</td><td class="ru">новая книга</td><td class="ru">новые книги</td></tr>
          <tr><td>Gen</td><td class="ru">новой книги</td><td class="ru">новых книг</td></tr>
          <tr><td>Dat</td><td class="ru">новой книге</td><td class="ru">новым книгам</td></tr>
          <tr><td>Acc</td><td class="ru">новую книгу</td><td class="ru">новые книги</td></tr>
          <tr><td>Ins</td><td class="ru">новой книгой</td><td class="ru">новыми книгами</td></tr>
          <tr><td>Pre</td><td class="ru">новой книге</td><td class="ru">новых книгах</td></tr>
        </table>
        <div class="callout success"><b>Altın kural:</b> Sıfat, isimle cinsiyet/sayı/hâl bakımından uyumludur.</div>
      </div>`
  },
  'Zamirler': {
    body: `
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
        <div class="callout"><b>Not:</b> Edat sonrası 3. şahıslara <b>н-</b> eklenir: <span class="ru">у него, к ней</span>.</div>
      </div>`
  },
  'Edatlar': {
    body: `
      <div class="card">
        <h3>Yaygın Edat + Hâl</h3>
        <table class="data">
          <tr><th>Edat</th><th>Hâl</th><th>Örnek</th></tr>
          <tr><td class="ru">в / на (yer)</td><td>Prepositional</td><td class="ru">в Москве, на столе</td></tr>
          <tr><td class="ru">в / на (yön)</td><td>Accusative</td><td class="ru">в Москву, на стол</td></tr>
          <tr><td class="ru">у</td><td>Genitive</td><td class="ru">у меня, у стола</td></tr>
          <tr><td class="ru">к</td><td>Dative</td><td class="ru">к маме</td></tr>
          <tr><td class="ru">с (ile)</td><td>Instrumental</td><td class="ru">с другом</td></tr>
          <tr><td class="ru">о / об</td><td>Prepositional</td><td class="ru">о книге</td></tr>
          <tr><td class="ru">из / от / до</td><td>Genitive</td><td class="ru">из Москвы</td></tr>
          <tr><td class="ru">для / без</td><td>Genitive</td><td class="ru">для мамы</td></tr>
        </table>
      </div>`
  }
};

let currentGrammarTab = Object.keys(GRAMMAR)[0];
function renderGrammar() {
  $('#page-grammar').innerHTML = `
    <div class="page-head">
      <h1>Gramer</h1>
      <p>Rusçanın yapı taşları. Kurallar ve tablolar Türkçe açıklamalarla.</p>
    </div>
    <div class="grammar-tabs">
      ${Object.keys(GRAMMAR).map(k => `
        <button data-t="${k}" class="${k === currentGrammarTab ? 'active' : ''}">${k}</button>
      `).join('')}
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

/* ---------- 12.4 Okuyucu ---------- */
let currentBook = null; // { name, text }
function renderReader() {
  $('#page-reader').innerHTML = `
    <div class="page-head">
      <h1>Okuyucu — EPUB / PDF</h1>
      <p>Bir kitap yükle. Metin içindeki her kelimenin üzerine geldiğinde <b>kural tabanlı analiz</b> açılır: kök, cinsiyet, hâl, çekim. Beğendiğin kelimeleri kütüphanene ekleyebilirsin.</p>
    </div>

    <div class="dropzone" id="dz">
      <div class="dz-icon">📚</div>
      <h3>EPUB veya PDF dosyanı buraya bırak</h3>
      <p>ya da tıkla ve seç · Dosya tarayıcında işlenir, hiçbir yere gönderilmez</p>
      <input type="file" id="fileInput" accept=".epub,.pdf,application/epub+zip,application/pdf" hidden>
    </div>

    <div id="readerArea"></div>
  `;

  const dz = $('#dz');
  const input = $('#fileInput');
  dz.onclick = () => input.click();
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
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

    currentBook = { name: file.name, text };
    showReader();
  } catch (err) {
    console.error(err);
    $('#readerArea').innerHTML = `<div class="card"><p style="color:var(--accent)">❌ Hata: ${err.message}</p></div>`;
  }
}

function showReader() {
  const { name, text } = currentBook;
  const wordCount = (text.match(/[А-Яа-яЁё]+/g) || []).length;

  // Metni token'lara ayır, kelimeleri span'lere sar
  const tokens = text.split(/(\s+)/);
  const html = tokens.map(tok => {
    if (!tok.trim()) return tok;
    // Noktalama ayır
    const m = tok.match(/^([^\p{L}]*)([\p{L}Ёё-]+)([^\p{L}]*)$/u);
    if (!m) return tok;
    const word = m[2];
    return m[1] + `<span class="w" data-w="${word}">${word}</span>` + m[3];
  }).join('');

  $('#readerArea').innerHTML = `
    <div class="book-info">
      <div class="bk">
        <div class="bk-title">📖 ${name}</div>
        <div class="bk-meta">${text.length.toLocaleString('tr-TR')} karakter · ~${wordCount.toLocaleString('tr-TR')} Rusça kelime</div>
      </div>
      <button class="btn ghost small" id="closeBook">Kapat</button>
    </div>
    <div class="reader-text" id="readerText">${html}</div>
  `;

  $('#closeBook').onclick = () => {
    currentBook = null;
    $('#readerArea').innerHTML = '';
    $('#dz').style.display = '';
  };
  $('#dz').style.display = 'none';

  bindReaderHover();
}

function bindReaderHover() {
  const rt = $('#readerText');
  rt.addEventListener('mouseover', e => {
    const w = e.target.closest('.w');
    if (!w) return;
    showPopoverForWord(w);
  });
  rt.addEventListener('mouseout', e => {
    const w = e.target.closest('.w');
    if (!w) return;
    hidePopover();
  });
  rt.addEventListener('scroll', hidePopover);
}

/* ---------- Popover ---------- */
const popover = $('#popover');
let popoverPinned = false;

function showPopoverForWord(wEl) {
  const raw = wEl.dataset.w;
  const analysis = analyzeWord(raw);
  if (!analysis) return;

  const caseTxt  = analysis.case && analysis.case !== '—' ? CASE_TR[analysis.case] : '—';
  const numTxt   = analysis.number ? NUM_TR[analysis.number] : '';
  const genderTxt = analysis.gender && analysis.gender !== '—' ? G_TR[analysis.gender] : '';
  const inLib = LIBRARY.some(x => norm(x.lemma || x.word) === norm(analysis.lemma || analysis.word));

  let detail = '';
  if (analysis.allForms && analysis.pos === 'noun') {
    detail = `
      <div class="p-detail">
        <b>Çekim tablosu:</b>
        <ul>
          <li>Gen: <span class="ru">${analysis.allForms.sg.gen || '—'}</span> / ${analysis.allForms.pl.gen || '—'}</li>
          <li>Dat: <span class="ru">${analysis.allForms.sg.dat || '—'}</span> / ${analysis.allForms.pl.dat || '—'}</li>
          <li>Acc: <span class="ru">${analysis.allForms.sg.acc || '—'}</span> / ${analysis.allForms.pl.acc || '—'}</li>
          <li>Ins: <span class="ru">${analysis.allForms.sg.ins || '—'}</span> / ${analysis.allForms.pl.ins || '—'}</li>
          <li>Pre: <span class="ru">${analysis.allForms.sg.pre || '—'}</span> / ${analysis.allForms.pl.pre || '—'}</li>
        </ul>
      </div>`;
  } else if (analysis.allForms && analysis.pos === 'verb') {
    detail = `
      <div class="p-detail">
        <b>Şimdiki zaman:</b> ${analysis.allForms.pr.join(', ')}<br>
        <b>Geçmiş:</b> ${analysis.allForms.pa.m}, ${analysis.allForms.pa.f}, ${analysis.allForms.pa.n}, ${analysis.allForms.pa.pl}
      </div>`;
  } else if (analysis.allForms && analysis.pos === 'adj') {
    detail = `
      <div class="p-detail">
        <b>Eril:</b> ${analysis.allForms.nom.m}<br>
        <b>Dişil:</b> ${analysis.allForms.nom.f}<br>
        <b>Nötr:</b> ${analysis.allForms.nom.n}<br>
        <b>Çoğul:</b> ${analysis.allForms.nom.p}
      </div>`;
  }

  const confBadge = analysis.confidence === 'low'
    ? '<span class="tag" style="background:#7c2d12;color:#fed7aa">tahmini</span>'
    : analysis.confidence === 'medium'
    ? '<span class="tag" style="background:#78350f;color:#fde68a">kısmi</span>'
    : '';

  popover.innerHTML = `
    <div class="p-word">${analysis.word}</div>
    ${analysis.lemma && norm(analysis.lemma) !== norm(analysis.word) ?
      `<div class="p-lemma">kök: <span class="ru">${analysis.lemma}</span></div>` : ''}
    ${analysis.tr ? `<div class="p-tr">${analysis.tr}</div>` : '<div class="p-tr" style="color:#fbbf24;opacity:.6">Sözlükte yok</div>'}
    <div class="p-tags">
      ${analysis.pos && analysis.pos !== '?' ? `<span class="tag pos">${analysis.pos === 'noun' ? 'isim' : analysis.pos === 'verb' ? 'fiil' : analysis.pos === 'adj' ? 'sıfat' : analysis.pos}</span>` : ''}
      ${caseTxt !== '—' ? `<span class="tag">${CASE_SHORT[analysis.case]}</span>` : ''}
      ${numTxt ? `<span class="tag">${numTxt}</span>` : ''}
      ${genderTxt ? `<span class="tag">${genderTxt}</span>` : ''}
      ${confBadge}
    </div>
    ${detail}
    <div class="p-actions">
      <button data-act="speak">🔊 Dinle</button>
      <button data-act="add" class="${inLib ? 'added' : ''}" ${inLib ? 'disabled' : ''}>${inLib ? '✓ Kütüphanede' : '+ Ekle'}</button>
    </div>
  `;

  popover.querySelector('[data-act="speak"]').onclick = () => speak(analysis.word);
  popover.querySelector('[data-act="add"]').onclick = () => {
    if (inLib) return;
    addToLibrary(analysis);
    wEl.classList.add('saved');
    // güncelle
    const btn = popover.querySelector('[data-act="add"]');
    btn.textContent = '✓ Kütüphanede';
    btn.classList.add('added');
    btn.disabled = true;
  };

  popover.classList.add('show');
  positionPopover(wEl);
}

function positionPopover(target) {
  const r = target.getBoundingClientRect();
  const pw = popover.offsetWidth;
  const ph = popover.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  let top  = r.top - ph - 8;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (top < 8) top = r.bottom + 8;
  popover.style.left = left + 'px';
  popover.style.top  = top + 'px';
}
function hidePopover() { popover.classList.remove('show'); }

document.addEventListener('keydown', e => { if (e.key === 'Escape') hidePopover(); });

/* ---------- 12.5 Kütüphane ---------- */
function renderLibrary() {
  const page = $('#page-library');
  const has = LIBRARY.length > 0;

  page.innerHTML = `
    <div class="page-head">
      <h1>Kütüphanem</h1>
      <p>Okurken eklediğin kelimeler. Arama, silme, dinleme ve flash kart pratiği.</p>
    </div>

    <div class="lib-toolbar">
      <input type="text" id="libSearch" placeholder="Kelimelerde ara…">
      <button class="btn" id="startFlash">🎴 Flash Kart Pratiği</button>
      <button class="btn ghost" id="clearLib">🗑️ Tümünü Sil</button>
    </div>

    <div id="libBody">${has ? renderLibGrid(LIBRARY) : '<div class="lib-empty">Henüz kelime eklemedin.<br>Okuyucudan bir kitap yükleyip kelimelerin üzerine gelerek ekleyebilirsin.</div>'}</div>
  `;

  $('#libSearch').oninput = (e) => {
    const q = norm(e.target.value);
    const filtered = q ? LIBRARY.filter(x => norm(x.lemma).includes(q) || norm(x.tr).includes(q)) : LIBRARY;
    $('#libBody').innerHTML = filtered.length ? renderLibGrid(filtered) : '<div class="lib-empty">Eşleşme bulunamadı.</div>';
    bindLibActions();
  };

  $('#startFlash').onclick = () => {
    if (!LIBRARY.length) { toast('Kütüphane boş'); return; }
    goTo('practice', 'flash');
  };

  $('#clearLib').onclick = () => {
    if (!LIBRARY.length) return;
    if (!confirm('Tüm kütüphane silinsin mi?')) return;
    LIBRARY = []; saveLibrary(); renderLibrary();
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
  $$('#libBody [data-act]').forEach(b => {
    const i = +b.dataset.i;
    if (b.dataset.act === 'speak') b.onclick = () => speak(LIBRARY[i].lemma);
    if (b.dataset.act === 'del')   b.onclick = () => { removeFromLibrary(i); renderLibrary(); };
  });
}

/* ---------- 12.6 Pratik ---------- */
const PRACTICE = {
  mode: 'infinite', // 'infinite' | 'flash'
  q: null,
  answered: false,
  correct: 0,
  wrong: 0,
  streak: 0,
  total: 0
};

function renderPractice(initialMode) {
  if (initialMode) PRACTICE.mode = initialMode;
  if (!PRACTICE.mode) PRACTICE.mode = 'infinite';
  const hasLib = LIBRARY.length > 0;

  $('#page-practice').innerHTML = `
    <div class="page-head">
      <h1>Pratik</h1>
      <p>Sonsuz sorularla kural bilginizi pekiştirin veya kütüphanenizden flash kartlarla çalışın.</p>
    </div>

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
  const ok = $('#scOK'); const no = $('#scNO'); const st = $('#scST'); const bar = $('#scBar');
  if (!ok) return;
  ok.textContent = PRACTICE.correct;
  no.textContent = PRACTICE.wrong;
  st.textContent = '🔥 ' + PRACTICE.streak;
  const pct = PRACTICE.total ? Math.min(PRACTICE.total * 4, 100) : 0;
  bar.style.width = pct + '%';
}

function nextQuestion() {
  PRACTICE.answered = false;
  PRACTICE.total++;
  updateQuizHUD();

  let q;
  if (PRACTICE.mode === 'flash') q = makeFlashQuestion();
  else q = makeInfiniteQuestion();

  if (!q) { $('#quizArea').innerHTML = '<div class="card"><p>Bu modda soru üretilemedi.</p></div>'; return; }
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
        <div class="quiz-options">
          ${q.choices.map(c => `<button class="opt-btn" data-v="${c.replace(/"/g, '&quot;')}">${c}</button>`).join('')}
        </div>
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

/* ---------- Sonsuz pratik: kurallı üretim ---------- */
const PRACTICE_VERBS = ['читать','говорить','знать','работать','думать','смотреть','видеть','любить','учить','гулять'];
const PRACTICE_NOUNS = DICT.filter(e => e.pos === 'noun');

function makeInfiniteQuestion() {
  const kinds = ['case', 'verb-pres', 'verb-past', 'adj-agree', 'translate-ru', 'translate-tr'];
  const kind = pick(kinds);
  if (kind === 'case') {
    const noun = pick(PRACTICE_NOUNS);
    const cases = ['gen', 'dat', 'acc', 'ins', 'pre'];
    const c = pick(cases);
    const forms = declineNoun(noun.ru, noun.gender, noun.anim);
    const answer = forms.sg[c];
    if (!answer) return makeInfiniteQuestion();
    return {
      type: 'text',
      label: `"${noun.tr}" — ${CASE_TR[c]} (tekil)`,
      target: noun.ru,
      answer,
      checkFn: v => norm(v) === norm(answer)
    };
  }
  if (kind === 'verb-pres') {
    const inf = pick(PRACTICE_VERBS);
    const { pr } = conjugateVerb(inf, null);
    const i = Math.floor(Math.random() * 6);
    const pronouns = ['я','ты','он/она','мы','вы','они'];
    const answer = pr[i];
    if (!answer) return makeInfiniteQuestion();
    return {
      type: 'text',
      label: `Fiili çekimle (${pronouns[i]})`,
      target: inf,
      answer,
      checkFn: v => norm(v) === norm(answer)
    };
  }
  if (kind === 'verb-past') {
    const inf = pick(PRACTICE_VERBS);
    const { pa } = conjugateVerb(inf, null);
    const g = pick(['m', 'f', 'n', 'pl']);
    const lbl = { m:'он (eril)', f:'она (dişil)', n:'оно (nötr)', pl:'они (çoğul)' }[g];
    return {
      type: 'text',
      label: `Geçmiş zaman — ${lbl}`,
      target: inf,
      answer: pa[g],
      checkFn: v => norm(v) === norm(pa[g])
    };
  }
  if (kind === 'adj-agree') {
    const adj = pick(DICT.filter(e => e.pos === 'adj'));
    const noun = pick(PRACTICE_NOUNS);
    const forms = declineAdj(adj.ru, adj.type);
    const g = noun.gender;
    const correct = forms.nom[g];
    if (!correct) return makeInfiniteQuestion();
    return {
      type: 'text',
      label: `"${adj.tr}" + "${noun.ru}" (${noun.tr}) — Nominative uyum`,
      target: `${adj.ru} + ${noun.ru}`,
      answer: `${correct} ${noun.ru}`,
      checkFn: v => norm(v) === norm(correct + ' ' + noun.ru)
    };
  }
  if (kind === 'translate-ru') {
    const e = pick(DICT.filter(x => x.pos === 'noun' || x.pos === 'verb' || x.pos === 'adj'));
    const wrongs = shuffle(DICT.filter(x => x.tr && x.tr !== e.tr)).slice(0, 3).map(x => x.tr);
    return {
      type: 'choice',
      label: 'Türkçe anlamı nedir?',
      target: e.ru,
      choices: shuffle([e.tr, ...wrongs]),
      answer: e.tr
    };
  }
  if (kind === 'translate-tr') {
    const e = pick(DICT.filter(x => x.pos === 'noun' || x.pos === 'verb' || x.pos === 'adj'));
    const wrongs = shuffle(DICT.filter(x => x.ru !== e.ru)).slice(0, 3).map(x => x.ru);
    return {
      type: 'choice',
      label: 'Rusçası nedir?',
      target: e.tr,
      choices: shuffle([e.ru, ...wrongs]),
      answer: e.ru
    };
  }
  return null;
}

/* ---------- Flash kartlar: kütüphaneden ---------- */
function makeFlashQuestion() {
  if (!LIBRARY.length) return null;
  const e = pick(LIBRARY);
  const dir = Math.random() < .5 ? 'ru2tr' : 'tr2ru';

  if (dir === 'ru2tr') {
    const wrongs = shuffle(LIBRARY.filter(x => x.tr && x.tr !== e.tr)).slice(0, 3).map(x => x.tr);
    if (wrongs.length < 3) return { type: 'text', label: 'Türkçesi nedir? (yaz)', target: e.lemma, answer: e.tr, checkFn: v => norm(v) === norm(e.tr) };
    return {
      type: 'choice',
      label: 'Türkçesi nedir?',
      target: e.lemma,
      choices: shuffle([e.tr, ...wrongs]),
      answer: e.tr
    };
  } else {
    return {
      type: 'text',
      label: 'Rusçası nedir?',
      target: e.tr || '—',
      answer: e.lemma,
      checkFn: v => norm(v) === norm(e.lemma)
    };
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
    fb.innerHTML = `
      <h4 style="margin:0 0 6px">✅ Doğru!</h4>
      <div class="fb-word ru">${correctAns}</div>
      <button class="next" id="qNext">Sonraki Soru →</button>
    `;
  } else {
    fb.className = 'quiz-fb no show';
    fb.innerHTML = `
      <h4 style="margin:0 0 6px">❌ Yanlış</h4>
      <div style="font-size:13px;color:var(--muted);margin-bottom:4px">Doğru cevap:</div>
      <div class="fb-word ru">${correctAns}</div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">Senin: ${userAns}</div>
      <button class="next" id="qNext">Sonraki Soru →</button>
    `;
  }
  $('#qNext').onclick = () => nextQuestion();
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ============================================================
   13) NAVİGASYON + BAŞLAT
   ============================================================ */
const PAGES = ['home', 'alphabet', 'grammar', 'reader', 'library', 'practice'];

function goTo(page, extra) {
  if (!PAGES.includes(page)) page = 'home';

  $$('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  $$('.main-nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  $('#mainNav')?.classList.remove('open');

  if (page === 'home')     renderHome();
  if (page === 'alphabet') renderAlphabet();
  if (page === 'grammar')  renderGrammar();
  if (page === 'reader')   renderReader();
  if (page === 'library')  renderLibrary();
  if (page === 'practice') renderPractice(extra);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function init() {
  loadLibrary();
  buildFormIndex();

  $$('.main-nav button').forEach(b => b.onclick = () => goTo(b.dataset.page));
  $('#navToggle').onclick = () => $('#mainNav').classList.toggle('open');

  goTo('home');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();