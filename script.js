(() => {
  const files = [];
  const filesGrid = document.getElementById('filesGrid');
  const searchInput = document.getElementById('searchInput');
  const tagSelect = document.getElementById('tagSelect');
  const fileInput = document.getElementById('fileInput');
  const modalBg = document.getElementById('modalBg');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalPreview = document.getElementById('modalPreview');
  const modalTitle = document.getElementById('modalTitle');
  const modalSize = document.getElementById('modalSize');
  const modalTags = document.getElementById('modalTags');
  const downloadBtn = document.getElementById('downloadBtn');
  const copyBtn = document.getElementById('copyBtn');

  const tagSet = new Set();

  // ファイルサイズを人間に読みやすい単位に
  function bytesToSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
  }

  // ファイルカード作成
  function createFileElement(fileObj, index) {
    const div = document.createElement('article');
    div.className = 'fileCard';
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-describedby', `file-desc-${index}`);

    const previewDiv = document.createElement('div');
    previewDiv.className = 'preview';

    if(fileObj.previewType === 'image'){
      const img = document.createElement('img');
      img.src = fileObj.preview;
      img.alt = fileObj.name + ' のプレビュー画像';
      previewDiv.appendChild(img);
    } else {
      // ファイルアイコンSVG簡易表示
      previewDiv.innerHTML = `
        <svg class="icon-file" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M6 2h7l5 5v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/>
          <path fill="#fff" d="M13 2v6h6"/>
        </svg>`;
    }

    const nameP = document.createElement('h3');
    nameP.className = 'fileName';
    nameP.textContent = fileObj.name;

    const sizeP = document.createElement('p');
    sizeP.className = 'fileSize';
    sizeP.textContent = bytesToSize(fileObj.size);

    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'tags';
    (fileObj.tags || []).slice(0,3).forEach(t => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.textContent = `#${t}`;
      tagsDiv.appendChild(span);
    });

    div.appendChild(previewDiv);
    div.appendChild(nameP);
    div.appendChild(sizeP);
    div.appendChild(tagsDiv);

    div.addEventListener('click', () => openModal(fileObj));
    div.addEventListener('keydown', e => {
      if(e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(fileObj);
      }
    });

    return div;
  }

  // ファイルリストを画面に表示
  function renderFiles() {
    const q = searchInput.value.trim().toLowerCase();
    const tagFilter = tagSelect.value;

    filesGrid.innerHTML = '';
    const filtered = files.filter(f => {
      if(q && !f.name.toLowerCase().includes(q)) return false;
      if(tagFilter && (!f.tags || !f.tags.includes(tagFilter))) return false;
      return true;
    });

    if(filtered.length === 0){
      const no = document.createElement('p');
      no.textContent = '該当するファイルがありません。';
      no.style.color = '#666';
      no.style.textAlign = 'center';
      no.style.gridColumn = '1 / -1';
      filesGrid.appendChild(no);
      return;
    }

    filtered.forEach((fileObj,i) => {
      filesGrid.appendChild(createFileElement(fileObj,i));
    });

    updateTagSelect();
  }

  // タグセレクトのオプションを更新
  function updateTagSelect() {
    // 今あるタグセットから作る
    const current = new Set(tagSelect.querySelectorAll('option:not([value=""])'));
    const allTags = new Set();
    files.forEach(f => {
      (f.tags || []).forEach(t => allTags.add(t));
    });

    // 既にあるタグと差分チェックして追加
    allTags.forEach(t => {
      if(![...tagSelect.options].some(o => o.value === t)){
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        tagSelect.appendChild(opt);
      }
    });
  }

  // モーダルを開く
  function openModal(fileObj) {
    modalTitle.textContent = fileObj.name;
    modalSize.textContent = 'サイズ: ' + bytesToSize(fileObj.size);
    modalTags.textContent = 'タグ: ' + ((fileObj.tags && fileObj.tags.length) ? fileObj.tags.join(', ') : 'なし');

    if(fileObj.previewType === 'image'){
      modalPreview.src = fileObj.preview;
      modalPreview.style.display = 'block';
    } else {
      modalPreview.style.display = 'none';
      modalPreview.src = '';
    }

    // ダウンロードリンクにBlob URLセット
    downloadBtn.href = fileObj.url;
    downloadBtn.download = fileObj.name;

    modalBg.classList.add('active');
  }

  function closeModal() {
    modalBg.classList.remove('active');
  }

  // URLコピーはBlob URLなのでコピーしやすいように単純にURLをコピー
  copyBtn.addEventListener('click', () => {
    if(downloadBtn.href){
      navigator.clipboard.writeText(downloadBtn.href).then(() => {
        alert('URLをコピーしました');
      });
    }
  });

  modalCloseBtn.addEventListener('click', closeModal);
  modalBg.addEventListener('click', e => {
    if(e.target === modalBg) closeModal();
  });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && modalBg.classList.contains('active')) {
      closeModal();
    }
  });

  // ファイルアップロード処理
  fileInput.addEventListener('change', async e => {
    if(!e.target.files.length) return;
    const file = e.target.files[0];
    // タグを入力させる簡易プロンプト
    let tagsInput = prompt('このファイルのタグをカンマ区切りで入力してください（例: emoji, image, icon）', '');
    let tags = [];
    if(tagsInput){
      tags = tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }

    // プレビュー画像か判定（image/で始まる）
    const isImage = file.type.startsWith('image/');

    // Blob URLを作成してfiles配列に追加
    const url = URL.createObjectURL(file);

    files.push({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      tags,
      url,
      preview: isImage ? url : null,
      previewType: isImage ? 'image' : 'other',
      mime: file.type
    });

    // タグセット更新
    tags.forEach(t => tagSet.add(t));

    renderFiles();

    // ファイル入力値リセットして連続アップロード可能に
    fileInput.value = '';
  });

  // 検索、タグ絞り込み入力イベント
  searchInput.addEventListener('input', renderFiles);
  tagSelect.addEventListener('change', renderFiles);

  // 初期表示
  renderFiles();
})();
