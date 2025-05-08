// Background service worker for KahootMate
// Listens for downloads and detects Kahoot reports

// Debug mode - set to true for console logging
const DEBUG = true;

// Helper function for logging
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

// Log that the background script has loaded
debugLog('KahootMate background script loaded');

// Track if we've detected a report download via the button click
let reportDownloadInitiated = false;
let reportDownloadInitiatedTime = 0;
let pendingDownloadUrl = null;

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('Message received from content script:', message, 'from tab:', sender?.tab?.url);
  
  // Always send a response to confirm receipt
  sendResponse({ received: true, status: 'Message received by background script' });
  
  if (message.action === 'content_script_loaded') {
    debugLog('Content script loaded on:', message.url);
  }
  else if (message.action === 'kahoot_report_download_initiated') {
    debugLog('Download initiated from Kahoot report button on page:', message.url);
    reportDownloadInitiated = true;
    reportDownloadInitiatedTime = message.timestamp;
    pendingDownloadUrl = message.url;
    
    // Immediately show the badge to indicate something is happening
    chrome.action.setBadgeText({ text: '...' });
    chrome.action.setBadgeBackgroundColor({ color: '#46178F' }); // Kahoot purple color
    
    // Set a timeout to reset the flag after 15 seconds if no download is detected
    setTimeout(() => {
      if (reportDownloadInitiated && 
          Date.now() - reportDownloadInitiatedTime > 15000) {
        debugLog('Download initiation timed out after 15 seconds');
        reportDownloadInitiated = false;
        pendingDownloadUrl = null;
        chrome.action.setBadgeText({ text: '' });
      }
    }, 15000);
    
    // Force-trigger the popup to open after a short delay
    // This helps the user see that something is happening
    setTimeout(() => {
      chrome.action.setPopup({ popup: 'popup.html?checking_download=true' });
    }, 500);
  }
  
  return true; // Keep the message channel open for async response
});

// Listen for download events
chrome.downloads.onCreated.addListener((downloadItem) => {
  debugLog('Download detected:', downloadItem);
  
  let isKahootReport = false;
  let detectionMethod = '';
  
  // Method 1: Check if we recently clicked the download button
  if (reportDownloadInitiated && 
      Date.now() - reportDownloadInitiatedTime < 15000 && 
      downloadItem.filename.endsWith('.xlsx')) {
    isKahootReport = true;
    detectionMethod = 'button click';
    reportDownloadInitiated = false; // Reset the flag
    debugLog('Kahoot report detected via button click:', downloadItem.filename);
  }
  // Method 2: Check file properties (fallback method)
  else if (downloadItem.filename.endsWith('.xlsx') && 
      (downloadItem.url.includes('kahoot.com') || 
       downloadItem.url.includes('kahoot.it') || 
       downloadItem.filename.toLowerCase().includes('kahoot') ||
       downloadItem.filename.toLowerCase().includes('report'))) {
    isKahootReport = true;
    detectionMethod = 'file properties';
    debugLog('Kahoot report detected via file properties:', downloadItem.filename);
  }
  
  if (isKahootReport) {
    // Store download info in local storage for later access
    const reportInfo = {
      filename: downloadItem.filename,
      downloadId: downloadItem.id,
      timestamp: Date.now(),
      path: downloadItem.filename,
      url: downloadItem.url,
      detectionMethod: detectionMethod
    };
    
    debugLog('Storing report info:', reportInfo);
    
    chrome.storage.local.set({
      'lastKahootReport': reportInfo
    }, () => {
      debugLog('Report info stored in local storage');
    });
    
    // Create a notification to alert the user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '/icons/icon128.png',
      title: 'KahootMate',
      message: 'Kahoot report detected! Would you like to process it now?',
      buttons: [
        { title: 'Process Now' },
        { title: 'Later' }
      ],
      requireInteraction: true
    }, (notificationId) => {
      debugLog('Notification created with ID:', notificationId);
    });
    
    // Also open the popup to show the report was detected
    // This creates a better user experience by making the extension more visible
    chrome.action.setPopup({ popup: 'popup.html?report_detected=true' });
    
    // Update the extension badge to show there's a report ready
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#46178F' }); // Kahoot purple color
    
    // Try to open the popup automatically
    try {
      chrome.action.openPopup();
      debugLog('Popup opened automatically');
    } catch (error) {
      debugLog('Could not open popup automatically:', error);
    }
  }
});

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  debugLog('Notification button clicked:', notificationId, 'button index:', buttonIndex);
  
  if (buttonIndex === 0) { // "Process Now" button
    // Open the processor page
    chrome.tabs.create({
      url: 'processor.html'
    }, (tab) => {
      debugLog('Opened processor page in tab:', tab.id);
    });
    
    // Clear the badge
    chrome.action.setBadgeText({ text: '' });
  }
});

// Reset popup when closed
chrome.runtime.onSuspend.addListener(() => {
  debugLog('Background script suspending');
  chrome.action.setPopup({ popup: 'popup.html' });
});

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener((details) => {
  debugLog('Extension installed/updated:', details.reason);
  
  // Clear any existing badge
  chrome.action.setBadgeText({ text: '' });
});

// Add a direct download handler for testing
chrome.downloads.onChanged.addListener((downloadDelta) => {
  debugLog('Download changed:', downloadDelta);
  
  // If a download completes, check if it might be a Kahoot report that we missed
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    chrome.downloads.search({id: downloadDelta.id}, (downloads) => {
      if (downloads && downloads.length > 0) {
        const download = downloads[0];
        debugLog('Completed download:', download);
        
        // Check if this might be a Kahoot report that we missed
        if (download.filename.endsWith('.xlsx') && 
            (download.url.includes('kahoot') || 
             download.filename.toLowerCase().includes('kahoot') ||
             download.filename.toLowerCase().includes('report'))) {
          
          // Check if we already processed this download
          chrome.storage.local.get(['lastKahootReport'], (result) => {
            if (!result.lastKahootReport || 
                result.lastKahootReport.downloadId !== download.id) {
              debugLog('Found potential Kahoot report that was missed initially:', download.filename);
              
              // Simulate a download creation event
              chrome.downloads.onCreated.dispatch(download);
            }
          });
        }
      }
    });
  }
});
