// Popup script for KahootMate

document.addEventListener('DOMContentLoaded', () => {
  const lastReportDiv = document.getElementById('last-report');
  const reportNameElem = document.getElementById('report-name');
  const processBtn = document.getElementById('process-btn');
  const uploadBtn = document.getElementById('upload-btn');

  // Check if there's a recently detected Kahoot report
  chrome.storage.local.get(['lastKahootReport'], (result) => {
    if (result.lastKahootReport) {
      const report = result.lastKahootReport;
      
      // Only show if the report was detected in the last 30 minutes
      const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
      
      if (report.timestamp > thirtyMinutesAgo) {
        lastReportDiv.classList.remove('hidden');
        reportNameElem.textContent = report.filename;
      }
    }
  });

  // Process button click handler
  processBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'processor.html'
    });
  });

  // Upload manually button click handler
  uploadBtn.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'processor.html?manual=true'
    });
  });
});
