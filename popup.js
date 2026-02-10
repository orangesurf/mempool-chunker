const DEFAULT_COLORS = ['#05ddff', '#6c92f9'];
const SAMPLE_ADDRESS = 'tb1qrp2nfan96zppevezz72xu6jmean9787jehd3yy';

// Sync color picker with text input
function setupColorSync(colorId) {
  const picker = document.getElementById(colorId);
  const text = document.getElementById(`${colorId}-hex`);
  
  picker.addEventListener('input', () => {
    text.value = picker.value;
    updatePreview();
  });
  
  text.addEventListener('input', () => {
    const val = text.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      picker.value = val;
      updatePreview();
    }
  });
  
  text.addEventListener('blur', () => {
    let val = text.value;
    // Auto-add # if missing
    if (/^[0-9A-Fa-f]{6}$/.test(val)) {
      val = '#' + val;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      text.value = val.toLowerCase();
      picker.value = val;
    } else {
      text.value = picker.value;
    }
    updatePreview();
  });
}

function getColors() {
  return [
    document.getElementById('color1').value,
    document.getElementById('color2').value
  ];
}

function setColors(colors) {
  for (let i = 0; i < 2; i++) {
    const color = colors[i] || DEFAULT_COLORS[i];
    document.getElementById(`color${i + 1}`).value = color;
    document.getElementById(`color${i + 1}-hex`).value = color;
  }
}

function colorizeAddress(address, colors) {
  let html = '';
  let currentChunk = '';
  let currentColorIndex = -1;
  
  for (let i = 0; i < address.length; i++) {
    const colorIndex = Math.floor(i / 4) % colors.length;
    
    if (colorIndex !== currentColorIndex) {
      if (currentChunk) {
        html += `<span style="color: ${colors[currentColorIndex]}">${currentChunk}</span>`;
      }
      currentChunk = address[i];
      currentColorIndex = colorIndex;
    } else {
      currentChunk += address[i];
    }
  }
  
  if (currentChunk) {
    html += `<span style="color: ${colors[currentColorIndex]}">${currentChunk}</span>`;
  }
  
  return html;
}

function updatePreview() {
  const colors = getColors();
  const preview = document.getElementById('preview');
  
  // Show both full and truncated examples
  const fullAddress = SAMPLE_ADDRESS;
  const firstPart = fullAddress.slice(0, 20);
  const lastPart = fullAddress.slice(-8);
  
  // Colorize first part (starts at position 0)
  let firstHtml = '';
  let currentChunk = '';
  let currentColorIndex = -1;
  
  for (let i = 0; i < firstPart.length; i++) {
    const colorIndex = Math.floor(i / 4) % colors.length;
    if (colorIndex !== currentColorIndex) {
      if (currentChunk) {
        firstHtml += `<span style="color: ${colors[currentColorIndex]}">${currentChunk}</span>`;
      }
      currentChunk = firstPart[i];
      currentColorIndex = colorIndex;
    } else {
      currentChunk += firstPart[i];
    }
  }
  if (currentChunk) {
    firstHtml += `<span style="color: ${colors[currentColorIndex]}">${currentChunk}</span>`;
  }
  
  // Colorize last part (starts at its position in full address)
  const lastStartPos = fullAddress.length - lastPart.length;
  let lastHtml = '';
  currentChunk = '';
  currentColorIndex = -1;
  
  for (let i = 0; i < lastPart.length; i++) {
    const posInFull = lastStartPos + i;
    const colorIndex = Math.floor(posInFull / 4) % colors.length;
    if (colorIndex !== currentColorIndex) {
      if (currentChunk) {
        lastHtml += `<span style="color: ${colors[currentColorIndex]}">${currentChunk}</span>`;
      }
      currentChunk = lastPart[i];
      currentColorIndex = colorIndex;
    } else {
      currentChunk += lastPart[i];
    }
  }
  if (currentChunk) {
    lastHtml += `<span style="color: ${colors[currentColorIndex]}">${currentChunk}</span>`;
  }
  
  preview.innerHTML = `<div style="margin-bottom: 8px;">${firstHtml}<span style="color: #666">...</span>${lastHtml}</div><div style="font-size: 11px; color: #666;">Full: ${colorizeAddress(fullAddress, colors)}</div>`;
}

function showStatus(message) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.classList.add('show');
  setTimeout(() => {
    status.classList.remove('show');
  }, 2000);
}

// Load settings
chrome.storage.sync.get(['colors', 'enabled'], (data) => {
  const colors = data.colors || DEFAULT_COLORS;
  const enabled = data.enabled !== false; // Default to true
  
  setColors(colors);
  document.getElementById('enabled').checked = enabled;
  updatePreview();
});

// Setup color sync for all pickers
['color1', 'color2'].forEach(setupColorSync);

// Save button
document.getElementById('save').addEventListener('click', () => {
  const colors = getColors();
  const enabled = document.getElementById('enabled').checked;
  
  chrome.storage.sync.set({ colors, enabled }, () => {
    showStatus('Settings saved!');
    
    // Notify content scripts to update
    chrome.tabs.query({ url: 'https://mempool.space/*' }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { type: 'updateColors', colors, enabled });
      });
    });
  });
});

// Reset button
document.getElementById('reset').addEventListener('click', () => {
  setColors(DEFAULT_COLORS);
  document.getElementById('enabled').checked = true;
  updatePreview();
  showStatus('Reset to defaults');
});

// Toggle change
document.getElementById('enabled').addEventListener('change', updatePreview);
