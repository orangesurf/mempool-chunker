(function() {
  const DEFAULT_COLORS = ['#05ddff', '#6c92f9'];
  
  // Bitcoin address patterns (mainnet and testnet)
  const ADDRESS_PATTERNS = [
    // Bech32 (bc1, tb1)
    /\b(bc1|tb1)[a-zA-HJ-NP-Z0-9]{25,87}\b/g,
    // Legacy P2PKH (1...)
    /\b1[a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
    // Legacy P2SH (3...)
    /\b3[a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
    // Bech32m (bc1p, tb1p - Taproot)
    /\b(bc1p|tb1p)[a-zA-HJ-NP-Z0-9]{25,87}\b/g
  ];
  
  let colors = DEFAULT_COLORS;
  let enabled = true;
  let addSpaces = false;
  let showCopyButton = true;
  let processedNodes = new WeakSet();
  
  // Load settings
  function loadSettings() {
    chrome.storage.sync.get(['colors', 'enabled', 'addSpaces', 'showCopyButton'], (data) => {
      colors = data.colors || DEFAULT_COLORS;
      enabled = data.enabled !== false;
      addSpaces = data.addSpaces || false;
      showCopyButton = data.showCopyButton !== false;
      if (enabled) {
        processPage();
      }
    });
  }
  
  // Check if text looks like a Bitcoin address
  function isAddress(text) {
    const trimmed = text.trim();
    return ADDRESS_PATTERNS.some(pattern => {
      pattern.lastIndex = 0;
      return pattern.test(trimmed);
    });
  }
  
  // Check if element should be skipped
  function shouldSkipElement(element) {
    if (!element) return true;
    
    // Skip hidden content (used by mempool.space for copy functionality)
    if (element.classList?.contains('hidden-content')) return true;
    if (element.closest?.('.hidden-content')) return true;
    
    // Skip if already processed
    if (element.classList?.contains('btc-colorized-address')) return true;
    if (element.closest?.('.btc-colorized-address')) return true;
    
    // Skip script, style, etc.
    const tagName = element.tagName?.toLowerCase();
    if (['script', 'style', 'textarea', 'input', 'noscript'].includes(tagName)) return true;
    
    return false;
  }
  
  // Create a copy button for an address
  // Clippy SVG matching mempool.space's native icon
  const CLIPPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" viewBox="0 0 1000 1000"><path fill="#FFFFFF" d="M128 768h256v64H128v-64z m320-384H128v64h320v-64z m128 192V448L384 640l192 192V704h320V576H576z m-288-64H128v64h160v-64zM128 704h160v-64H128v64z m576 64h64v128c-1 18-7 33-19 45s-27 18-45 19H64c-35 0-64-29-64-64V192c0-35 29-64 64-64h192C256 57 313 0 384 0s128 57 128 128h192c35 0 64 29 64 64v320h-64V320H64v576h640V768zM128 256h512c0-35-29-64-64-64h-64c-35 0-64-29-64-64s-29-64-64-64-64 29-64 64-29 64-64 64h-64c-35 0-64 29-64 64z"></path></svg>`;
  const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="13" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

  function createCopyButton(address) {
    const wrapper = document.createElement('app-clipboard');
    wrapper.className = 'btc-copy-clipboard';
    
    const inner = document.createElement('span');
    inner.style.position = 'relative';
    
    const button = document.createElement('button');
    button.className = 'btn btn-link btn-sm padding pt-0';
    button.style.boxShadow = 'none';
    button.title = 'Copy address';
    button.setAttribute('data-address', address);
    button.innerHTML = CLIPPY_SVG;
    
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const addr = e.currentTarget.getAttribute('data-address');
      navigator.clipboard.writeText(addr).then(() => {
        e.currentTarget.innerHTML = CHECK_SVG;
        setTimeout(() => {
          e.currentTarget.innerHTML = CLIPPY_SVG;
        }, 1500);
      });
    });
    
    inner.appendChild(button);
    wrapper.appendChild(inner);
    return wrapper;
  }
  
  // Colorize a substring based on its position in the full address
  // This ensures correct color continuity even for truncated displays
  function colorizeSubstring(text, startPositionInFull) {
    const wrapper = document.createElement('span');
    wrapper.className = 'btc-colorized-address';
    wrapper.setAttribute('data-original', text);
    
    // Add hidden original text for CTRL-F searching and copying
    const hiddenSpan = document.createElement('span');
    hiddenSpan.className = 'btc-hidden-address';
    hiddenSpan.textContent = text;
    hiddenSpan.style.display = 'none';
    hiddenSpan.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(hiddenSpan);
    
    let currentChunk = '';
    let currentColorIndex = -1;
    
    for (let i = 0; i < text.length; i++) {
      const posInFull = startPositionInFull + i;
      const colorIndex = Math.floor(posInFull / 4) % colors.length;
      
      if (colorIndex !== currentColorIndex) {
        // Flush current chunk
        if (currentChunk) {
          const span = document.createElement('span');
          span.textContent = currentChunk;
          span.style.color = colors[currentColorIndex];
          wrapper.appendChild(span);
        }
        currentChunk = text[i];
        currentColorIndex = colorIndex;
      } else {
        currentChunk += text[i];
      }
      
      // Add space after every 4-char boundary in the FULL address (if enabled)
      if (addSpaces && (posInFull + 1) % 4 === 0 && i < text.length - 1) {
        // Flush current chunk first
        if (currentChunk) {
          const span = document.createElement('span');
          span.textContent = currentChunk;
          span.style.color = colors[currentColorIndex];
          wrapper.appendChild(span);
          currentChunk = '';
        }
        
        // Add space
        const spaceSpan = document.createElement('span');
        spaceSpan.className = 'btc-chunk-space';
        spaceSpan.textContent = ' ';
        wrapper.appendChild(spaceSpan);
      }
    }
    
    // Flush remaining
    if (currentChunk) {
      const span = document.createElement('span');
      span.textContent = currentChunk;
      span.style.color = colors[currentColorIndex];
      wrapper.appendChild(span);
    }
    
    return wrapper;
  }
  
  // Colorize a full address (starting at position 0)
  function colorizeAddress(address) {
    return colorizeSubstring(address, 0);
  }
  
  // Handle mempool.space's truncated address format
  function processTruncatedAddress(container) {
    if (processedNodes.has(container)) return;
    if (shouldSkipElement(container)) return;
    
    // Get the full address from the title attribute of parent link or href
    const parentLink = container.closest('a[title]') || container.closest('a[href*="/address/"]') ||
                   container.querySelector('a[title]') || container.querySelector('a[href*="/address/"]');
    let fullAddress = parentLink?.getAttribute('title') || '';
    
    if (!fullAddress && parentLink) {
      const href = parentLink.getAttribute('href') || '';
      if (href.includes('/address/')) {
        fullAddress = href.split('/address/')[1]?.split('/')[0]?.split('?')[0] || '';
      }
    }
    
    if (!fullAddress || !isAddress(fullAddress)) return;
    
    // Process .first span
    const firstSpan = container.querySelector('.first');
    if (firstSpan && !firstSpan.querySelector('.btc-colorized-address')) {
      const text = getDirectText(firstSpan);
      if (text && text !== '...' && text !== '…') {
        let posInFull = fullAddress.indexOf(text);
        if (posInFull === -1 && fullAddress.startsWith(text)) posInFull = 0;
        
        if (posInFull !== -1) {
          const colorized = colorizeSubstring(text, posInFull);
          clearAndAppend(firstSpan, colorized);
        }
      }
    }
    
    // Process .last-four span (or similar)
    const lastSpan = container.querySelector('.last-four') || 
                     container.querySelector('.last') ||
                     container.querySelector('[class*="last"]');
    if (lastSpan && !lastSpan.querySelector('.btc-colorized-address')) {
      const text = getDirectText(lastSpan);
      if (text && text !== '...' && text !== '…') {
        let posInFull = -1;
        
        // Try exact match first
        posInFull = fullAddress.indexOf(text);
        
        // If not found, check if it's at the end
        if (posInFull === -1 && fullAddress.endsWith(text)) {
          posInFull = fullAddress.length - text.length;
        }
        
        if (posInFull !== -1) {
          const colorized = colorizeSubstring(text, posInFull);
          clearAndAppend(lastSpan, colorized);
        }
      }
    }
    
    // Add copy button inside the truncate container, matching native app-clipboard placement
    if (showCopyButton && fullAddress) {
      const truncateSpan = container.matches?.('.truncate') ? container : container.querySelector('.truncate');
      const targetContainer = truncateSpan || container;
      if (!targetContainer.querySelector('.btc-copy-clipboard') && !targetContainer.querySelector('app-clipboard:not(.btc-copy-clipboard)')) {
        const copyBtn = createCopyButton(fullAddress);
        targetContainer.appendChild(copyBtn);
      }
    }
    
    processedNodes.add(container);
  }
  
  // Get direct text content (not from child elements)
  function getDirectText(element) {
    let text = '';
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text || element.textContent;
  }
  
  // Clear element and append new content
  function clearAndAppend(element, newContent) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    element.appendChild(newContent);
  }
  
  // Process address links directly
  function processAddressLink(linkElement) {
    if (processedNodes.has(linkElement)) return;
    if (shouldSkipElement(linkElement)) return;
    
    // Get full address from href or title
    const href = linkElement.getAttribute('href') || '';
    const title = linkElement.getAttribute('title') || '';
    
    let fullAddress = title;
    if (!fullAddress && href.includes('/address/')) {
      fullAddress = href.split('/address/')[1]?.split('/')[0]?.split('?')[0] || '';
    }
    
    if (!fullAddress || !isAddress(fullAddress)) return;
    
    // If it has app-truncate inside, process that instead
    const truncateEl = linkElement.querySelector('app-truncate, .truncate');
    if (truncateEl) {
      processTruncatedAddress(truncateEl);
      processedNodes.add(linkElement);
      return;
    }
    
    processedNodes.add(linkElement);
  }
  
  // Process a text node
  function processTextNode(textNode) {
    const text = textNode.textContent;
    if (!text || text.length < 26) return;
    
    const parent = textNode.parentNode;
    if (shouldSkipElement(parent)) return;
    
    // Check each pattern
    for (const pattern of ADDRESS_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = text.match(pattern);
      
      if (matches) {
        let currentText = text;
        const fragment = document.createDocumentFragment();
        
        for (const match of matches) {
          const index = currentText.indexOf(match);
          if (index === -1) continue;
          
          // Add text before match
          if (index > 0) {
            fragment.appendChild(document.createTextNode(currentText.slice(0, index)));
          }
          
          // Add colorized address
          const colorizedSpan = colorizeAddress(match);
          fragment.appendChild(colorizedSpan);
          
          // Add copy button if enabled
          if (showCopyButton) {
            const copyBtn = createCopyButton(match);
            fragment.appendChild(copyBtn);
          }
          
          currentText = currentText.slice(index + match.length);
        }
        
        // Add remaining text
        if (currentText) {
          fragment.appendChild(document.createTextNode(currentText));
        }
        
        parent.replaceChild(fragment, textNode);
        return;
      }
    }
  }
  
  // Process elements that commonly contain addresses
  function processElement(element) {
    if (processedNodes.has(element)) return;
    if (!enabled) return;
    if (shouldSkipElement(element)) return;
    
    // Handle app-truncate elements specially
    if (element.matches?.('app-truncate, .truncate')) {
      processTruncatedAddress(element);
      return;
    }
    
    // Process text content in links and specific elements
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const parent = node.parentNode;
          if (shouldSkipElement(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.textContent.length >= 26) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    textNodes.forEach(processTextNode);
    processedNodes.add(element);
  }
  
  // Process the entire page
  function processPage() {
    if (!enabled) return;
    
    // First, handle all truncated addresses (mempool.space specific)
    document.querySelectorAll('app-truncate, .truncate').forEach(el => {
      if (!el.closest('.hidden-content')) {
        processTruncatedAddress(el);
      }
    });
    
    // Process address links
    document.querySelectorAll('a[href*="/address/"], a.address').forEach(el => {
      if (!shouldSkipElement(el)) {
        processAddressLink(el);
      }
    });
    
    // Process specific selectors that commonly contain addresses
    const selectors = [
      'a[href*="/tx/"]',
      '.address',
      '[class*="address"]',
      'td',
      'code',
      'pre'
    ];
    
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (!shouldSkipElement(el)) {
          processElement(el);
        }
      });
    });
    
    // Also check all anchor tags
    document.querySelectorAll('a').forEach(el => {
      if (shouldSkipElement(el)) return;
      const text = el.textContent?.trim();
      if (text && isAddress(text)) {
        processElement(el);
      }
    });
  }
  
  // Update colors on existing colorized addresses
  function updateColors() {
    // Need to re-process since color positions depend on full address
    removeColorization();
    processPage();
  }
  
  // Remove colorization
  function removeColorization() {
    document.querySelectorAll('.btc-colorized-address').forEach(wrapper => {
      const original = wrapper.getAttribute('data-original');
      if (original) {
        wrapper.replaceWith(document.createTextNode(original));
      }
    });
    document.querySelectorAll('.btc-colorized-last').forEach(el => {
      el.classList.remove('btc-colorized-last');
    });
    document.querySelectorAll('.btc-copy-clipboard').forEach(el => {
      el.remove();
    });
    processedNodes = new WeakSet();
  }
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateColors') {
      colors = message.colors;
      enabled = message.enabled;
      addSpaces = message.addSpaces;
      showCopyButton = message.showCopyButton;
      
      if (enabled) {
        updateColors();
      } else {
        removeColorization();
      }
    }
  });
  
  // Observe DOM changes for dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    if (!enabled) return;
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (!shouldSkipElement(node)) {
            // Process truncate elements
            if (node.matches?.('app-truncate, .truncate')) {
              processTruncatedAddress(node);
            }
            node.querySelectorAll?.('app-truncate, .truncate').forEach(el => {
              if (!shouldSkipElement(el)) {
                processTruncatedAddress(el);
              }
            });
            
            // Process address links
            if (node.matches?.('a[href*="/address/"]')) {
              processAddressLink(node);
            }
            node.querySelectorAll?.('a[href*="/address/"]').forEach(el => {
              if (!shouldSkipElement(el)) {
                processAddressLink(el);
              }
            });
            
            // General processing
            processElement(node);
          }
        }
      });
    });
  });
  
  // Initialize
  function init() {
    loadSettings();
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Process on load and after short delay (for SPA navigation)
    processPage();
    setTimeout(processPage, 1000);
    setTimeout(processPage, 3000);
  }
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Also process on URL changes (SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      processedNodes = new WeakSet();
      setTimeout(processPage, 500);
    }
  }).observe(document, { subtree: true, childList: true });
})();
