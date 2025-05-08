// Popup script for KahootMate

document.addEventListener('DOMContentLoaded', () => {
  const lastReportDiv = document.getElementById('last-report');
  const reportNameElem = document.getElementById('report-name');
  const processBtn = document.getElementById('process-btn');
  const uploadBtn = document.getElementById('upload-btn');
  const waitingMsg = document.querySelector('.container > p');

  // Check if we were opened because a report was just detected
  const urlParams = new URLSearchParams(window.location.search);
  const reportDetected = urlParams.get('report_detected') === 'true';

  // Check if there's a recently detected Kahoot report
  chrome.storage.local.get(['lastKahootReport'], (result) => {
    if (result.lastKahootReport) {
      const report = result.lastKahootReport;
      
      // Only show if the report was detected in the last 30 minutes
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      
      if (report.timestamp > thirtyMinutesAgo) {
        // Show the report section
        lastReportDiv.classList.remove('hidden');
        // Extract just the filename from the full path
        const filename = report.filename.split('/').pop();
        reportNameElem.textContent = filename;
        
        // Change the waiting message to be more action-oriented
        waitingMsg.textContent = 'Kahoot report detected!';
        
        // If this popup was opened right after detection, focus on the process button
        if (reportDetected) {
          processBtn.focus();
          
          // Highlight the process button to draw attention to it
          processBtn.classList.add('highlight-button');
          
          // Add a pulsing animation to make it more noticeable
          setTimeout(() => {
            processBtn.classList.remove('highlight-button');
          }, 2000);
        }
      }
    }
  });

  // Process button click handler
  processBtn.addEventListener('click', () => {
    // Clear the badge when processing
    chrome.action.setBadgeText({ text: '' });
    
    chrome.tabs.create({
      url: 'processor.html'
    });
    
    window.close();
  });

  // Upload manually button click handler
  uploadBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'processor.html?manual=true'
    });
    
    window.close();
  });
});
