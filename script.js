const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('fileElem');
const formatSelect = document.getElementById('format-select');
const convertBtn = document.getElementById('convertBtn');
const output = document.getElementById('output');

let filesToConvert = [];

dropArea.addEventListener('click', () => fileInput.click());
dropArea.addEventListener('dragover', e => {
  e.preventDefault();
  dropArea.classList.add('hover');
});
dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('hover');
});
dropArea.addEventListener('drop', e => {
  e.preventDefault();
  dropArea.classList.remove('hover');
  if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFiles(fileInput.files);
});

function handleFiles(files) {
  filesToConvert = [];
  output.innerHTML = '';
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    filesToConvert.push(file);
  }
  convertBtn.disabled = filesToConvert.length === 0;
  if (filesToConvert.length > 0) {
    output.innerHTML = `<p>${filesToConvert.length} file pronti per la conversione.</p>`;
  }
}

convertBtn.addEventListener('click', () => {
  if (filesToConvert.length === 0) return;
  output.innerHTML = '<p>Conversione in corso...</p>';
  convertBtn.disabled = true;
  convertMultipleFiles(filesToConvert, formatSelect.value)
    .then(html => output.innerHTML = html)
    .catch(() => output.innerHTML = '<p style="color:#f33;">Errore durante la conversione.</p>')
    .finally(() => convertBtn.disabled = false);
});

async function convertMultipleFiles(files, targetFormat) {
  let html = '';
  for (const file of files) {
    try {
      const blob = await convertFile(file, targetFormat);
      const url = URL.createObjectURL(blob);
      html += `
        <div style="margin-bottom:1.5rem;">
          <strong>${file.name}</strong><br />
          <a href="${url}" download="${file.name.replace(/\.[^/.]+$/, '')}.${targetFormat}">Scarica ${targetFormat.toUpperCase()}</a><br />
          <img src="${url}" alt="Anteprima" />
        </div>
      `;
    } catch {
      html += `<p style="color:#f33;">Errore nella conversione di ${file.name}</p>`;
    }
  }
  return html;
}

function convertFile(file, format) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        let mimeType = {
          webp: 'image/webp',
          png: 'image/png',
          jpeg: 'image/jpeg'
        }[format] || 'image/webp';

        canvas.toBlob(blob => blob ? resolve(blob) : reject(), mimeType, 0.8);
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
