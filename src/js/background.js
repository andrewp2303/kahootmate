// Background service worker for KahootMate
// Listens for downloads and detects Kahoot reports

// Listen for download events
chrome.downloads.onCreated.addListener((downloadItem) => {
  // Check if the download is an Excel file from Kahoot
  if (downloadItem.filename.endsWith('.xlsx') && 
      (downloadItem.url.includes('kahoot.com') || 
       downloadItem.filename.toLowerCase().includes('kahoot'))) {
    
    console.log('Kahoot report detected:', downloadItem.filename);
    
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
    });
    
    // Store download info in local storage for later access
    chrome.storage.local.set({
      'lastKahootReport': {
        filename: downloadItem.filename,
        downloadId: downloadItem.id,
        timestamp: Date.now()
      }
    });
  }
});

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) { // "Process Now" button
    // Open the processor page
    chrome.tabs.create({
      url: 'processor.html'
    });
  }
});
