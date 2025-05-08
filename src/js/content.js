// Content script for KahootMate
// Injected into Kahoot pages to detect report downloads

console.log('KahootMate content script loaded on Kahoot page:', window.location.href);

// Function to detect the "Download report" button and other download actions
function setupDownloadButtonListener() {
  console.log('Setting up download button listeners');
  
  // Log all the elements with data-functional-selector attributes to help debugging
  const allSelectors = document.querySelectorAll('[data-functional-selector]');
  console.log('Found elements with data-functional-selector:', allSelectors.length);
  allSelectors.forEach(el => {
    console.log('Selector:', el.getAttribute('data-functional-selector'));
  });
  
  // Use event delegation to handle dynamically added elements
  document.addEventListener('click', (event) => {
    // Log all clicks for debugging
    console.log('Click detected on:', event.target.tagName, event.target.className);
    
    // Method 1: Look for clicks on the download report button using the exact selector
    const downloadButton = event.target.closest('[data-functional-selector="report-action-menu__download"]');
    
    // Method 2: Look for clicks on any download-related elements
    const isDownloadRelated = 
      event.target.textContent?.includes('Download report') || 
      event.target.textContent?.includes('Export') ||
      event.target.closest('a[href*=".xlsx"]') ||
      event.target.closest('button')?.textContent?.includes('Download');
    
    // Method 3: Look for SVG icons that might be part of download buttons
    const isSvgIcon = event.target.closest('svg') && 
                     event.target.closest('div')?.textContent?.includes('Download');
    
    if (downloadButton || isDownloadRelated || isSvgIcon) {
      console.log('Potential Kahoot report download action detected!');
      
      // Notify the background script that a report download was initiated
      chrome.runtime.sendMessage({
        action: 'kahoot_report_download_initiated',
        timestamp: Date.now(),
        url: window.location.href
      }, response => {
        // Log the response to verify communication
        console.log('Background script response:', response);
      });
    }
  });
  
  // Also set up a MutationObserver to detect if the button is added after page load
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        // Check if any of the added nodes contain download-related elements
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Method 1: Check for the exact selector
            const downloadButton = node.querySelector('[data-functional-selector="report-action-menu__download"]');
            
            // Method 2: Check for text content
            const hasDownloadText = node.textContent?.includes('Download report');
            
            if (downloadButton || hasDownloadText) {
              console.log('Download report element detected in DOM changes');
            }
          }
        });
      }
    });
  });
  
  // Start observing the document body for changes
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Also listen for all download-related events
  document.addEventListener('mousedown', logPotentialDownloadAction);
  document.addEventListener('mouseup', logPotentialDownloadAction);
}

// Helper function to log potential download actions
function logPotentialDownloadAction(event) {
  if (event.target.tagName === 'A' && event.target.href?.includes('.xlsx')) {
    console.log('Excel download link interaction detected:', event.type, event.target.href);
    chrome.runtime.sendMessage({
      action: 'kahoot_report_download_initiated',
      timestamp: Date.now(),
      url: event.target.href
    });
  }
}

// Initialize when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', setupDownloadButtonListener);

// Also run the setup immediately in case the page is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setupDownloadButtonListener();
}

// Send a ping to the background script to verify communication
chrome.runtime.sendMessage({
  action: 'content_script_loaded',
  url: window.location.href
}, response => {
  console.log('Background script connection test response:', response);
});
