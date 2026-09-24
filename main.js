function renderPopover() {
  const a = popState.analysis;
  if (!a) return;

  const caseTxt = a.case && a.case !== '—' ? CASE_TR[a.case] : '—';
  const numTxt = a.number ? NUM_TR[a.number] : '';
  const genderTxt = a.gender && a.gender !== '—' ? G_TR[a.gender] : '';
  const inLib = LIBRARY.some(x => norm(x.lemma || x.word) === norm(a.lemma || a.word));

  // ---- Detay bölümü (kaydırılan kısım) ----
  let detail = '';
  if (a.allForms && a.pos === 'noun') {
    const { sg, pl } = a.allForms;
    detail = `
      <div class="p-detail">
        <b>Çekim tablosu</b>
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
        <b>Nominative</b><br>
        eril: <span class="ru">${n.m}</span> · dişil: <span class="ru">${n.f}</span><br>
        nötr: <span class="ru">${n.n}</span> · çoğul: <span class="ru">${n.p}</span>
      </div>`;
  }

  // ---- Alternatif anlamlar ----
  let altHTML = '';
  if (popState.meanings.length) {
    altHTML = `
      <div class="p-detail">
        <b>📚 Diğer anlamlar / kullanımlar</b>
        <ul>
          ${popState.meanings.slice(0, 6).map(m => `
            <li><span style="color:#9ca3af;font-size:11.5px">[${m.pos}]</span> ${m.text}</li>
          `).join('')}
        </ul>
      </div>`;
  }

  const confTag = a.confidence === 'low' ? '<span class="tag low">tahmini</span>'
                : a.confidence === 'medium' ? '<span class="tag mid">kısmi</span>' : '';
  const hasTr = !!a.tr;

  popover.innerHTML = `
    <div class="p-head">
      <div class="p-head-inner">
        <div class="p-head-main">
          <div class="p-word">${a.word}</div>
          ${a.lemma && norm(a.lemma) !== norm(a.word) ? `<div class="p-lemma">kök: <span class="ru">${a.lemma}</span></div>` : ''}
          <div class="p-tr">${hasTr ? a.tr : '<span class="p-loading">⏳ Çeviri aranıyor…</span>'}</div>
        </div>
        <button class="p-close" id="pClose" title="Kapat">✕</button>
      </div>
    </div>

    <div class="p-body">
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
        <div class="p-sentence">
          <div style="font-size:11px;color:#9ca3af;margin-bottom:4px">CÜMLE</div>
          <div class="p-sent-text">${popState.sentence}</div>
          <button class="p-sent-btn" id="sentenceBtn">📖 Cümleyi Çevir</button>
          <div id="sentenceTrans"></div>
        </div>
      ` : ''}

      ${detail}
      ${altHTML}
    </div>
  `;

  // Olaylar
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