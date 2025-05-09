// Processor script for KahootMate
// Handles file upload, parsing, processing, and PDF generation

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const dropArea = document.getElementById('drop-area');
  let fileInput = document.getElementById('file-input');  // use let so we can reassign after dynamic HTML
  const fileInfo = document.getElementById('file-info');
  const filename = document.getElementById('filename');
  const processFileBtn = document.getElementById('process-file-btn');
  const uploadCard = document.getElementById('upload-card');
  const processingCard = document.getElementById('processing-card');
  const resultsCard = document.getElementById('results-card');
  const progressBar = document.getElementById('progress-bar');
  const processingStatus = document.getElementById('processing-status');
  const pairsContainer = document.getElementById('pairs-container');
  const downloadTeamsPdfBtn = document.getElementById('download-teams-pdf-btn');
  const downloadResultsPdfBtn = document.getElementById('download-results-pdf-btn');
  const backButton = document.getElementById('back-button');

  // State variables
  let selectedFile = null;
  let processedData = null;
  let lastReportPath = null;

  // Detect manual vs. auto-upload
  const urlParams = new URLSearchParams(window.location.search);
  const isManualUpload = urlParams.get('manual') === 'true';

  if (!isManualUpload) {
    // Try to get the last detected Kahoot report
    chrome.storage.local.get(['lastKahootReport'], (result) => {
      const report = result.lastKahootReport;
      if (report) {
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
        if (report.timestamp > thirtyMinutesAgo) {
          lastReportPath = report.filename;

          // Replace drop-area HTML with detected file UI
          dropArea.innerHTML = `
            <p style="text-align:center;">Recently detected: <span class="detected-file">${report.filename}</span></p>
            <p>Click below or drag and drop to upload this file</p>
            <label for="file-input" class="file-input-label">Choose File</label>
            <input type="file" id="file-input" accept=".xlsx" hidden>
          `;

          // Re-bind fileInput to the new element
          fileInput = document.getElementById('file-input');
          // Prevent bubbling from native click
          fileInput.addEventListener('click', e => e.stopPropagation());
          // Handle file selection
          fileInput.addEventListener('change', handleFileSelect);
          // Optional: try to focus picker on lastReportPath (best-effort)
          fileInput.addEventListener('click', () => {
            try {
              if (lastReportPath) {
                console.log('Focusing on:', lastReportPath);
                localStorage.setItem('lastReportPath', lastReportPath);
              }
            } catch (err) {
              console.log('Pre-select failed:', err);
            }
          });
        }
      }
    });
  }

  // Prevent default drag behaviors
  ['dragenter','dragover','dragleave','drop'].forEach(evt => {
    dropArea.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); }, false);
  });

  // Highlight on drag
  ['dragenter','dragover'].forEach(evt => {
    dropArea.addEventListener(evt, () => dropArea.classList.add('active'));
  });
  ['dragleave','drop'].forEach(evt => {
    dropArea.addEventListener(evt, () => dropArea.classList.remove('active'));
  });

  // Handle drop
  dropArea.addEventListener('drop', handleDrop);
  // File picker change
  fileInput.addEventListener('change', handleFileSelect);
  // Process button
  processFileBtn.addEventListener('click', processFile);

  // Open picker only when clicking directly on drop-area
  dropArea.addEventListener('click', e => {
    if (e.target === dropArea) {
      fileInput.click();
    }
  });

  // Navigation buttons
  downloadTeamsPdfBtn.addEventListener('click', generateTeamsPDF);
  downloadResultsPdfBtn.addEventListener('click', generateResultsPDF);
  backButton.addEventListener('click', () => {
    resultsCard.classList.add('hidden');
    uploadCard.classList.remove('hidden');
  });

  // File handling functions
  function handleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length) handleFiles(files);
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length) handleFiles(files);
    fileInput.value = '';
  }

  function handleFiles(files) {
    if (files[0].name.endsWith('.xlsx')) {
      selectedFile = files[0];
      filename.textContent = selectedFile.name;
      fileInfo.classList.remove('hidden');
    } else {
      alert('Please select a valid Excel (.xlsx) file');
    }
  }

  // Main processing function
  function processFile() {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    // Show processing UI
    uploadCard.classList.add('hidden');
    processingCard.classList.remove('hidden');
    updateProgress(10, 'Reading file...');

    // Read the file
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        updateProgress(30, 'Parsing Excel data...');
        
        // Parse the Excel file using SheetJS
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Find the "Final Scores" sheet or use the first sheet
        let sheetName = workbook.SheetNames.find(name => name.includes('Final') && name.includes('Scores')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert the worksheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });
        
        updateProgress(70, 'Processing data...');
        
        // Extract student data from the Excel file
        // Process the extracted data
        processedData = processKahootData(jsonData);
        
        // Check if we have valid processed data
        if (!processedData.students || processedData.students.length === 0) {
          throw new Error('Error processing the data');
        }
        
        // In a production version, we would handle the Excel parsing more robustly
        // For now, we're using test data to demonstrate the functionality
        
        updateProgress(90, 'Preparing results...');
        
        // Display the results
        displayResults(processedData);
        
        updateProgress(100, 'Complete!');
        
        // Show results UI
        setTimeout(() => {
          processingCard.classList.add('hidden');
          resultsCard.classList.remove('hidden');
        }, 500);
        
      } catch (error) {
        console.error('Error processing file:', error);
        alert('Error processing file: ' + error.message + '\nPlease make sure this is a valid Kahoot report.');
        
        // Reset UI
        processingCard.classList.add('hidden');
        uploadCard.classList.remove('hidden');
      }
    };
    
    reader.readAsArrayBuffer(selectedFile);
  }

  // Process Kahoot data: add noise, sort, and pair
  function processKahootData(data) {
    // First check if we're already passed an array of student objects
    if (Array.isArray(data) && data.length > 0 && data[0].name && data[0].rawScore !== undefined) {
      return processStudentData(data);
    }
    
    // Otherwise, try to extract student data from the JSON representation
    let students = [];
    
    // Check if we're dealing with an array of objects (typical JSON format from sheet_to_json)
    if (Array.isArray(data)) {
      students = data.map(row => {
        // Try to find name and score columns
        // Kahoot reports typically have student names in column B and scores in column C
        let name = null;
        let score = null;
        
        // Look for specific keys that might contain the name
        for (const key of Object.keys(row)) {
          if ((key === 'B' || key === 'Player' || key.includes('name') || key.includes('player') || 
               key.includes('student')) && typeof row[key] === 'string') {
            name = row[key];
            break;
          }
        }
        
        // Look for specific keys that might contain the score
        for (const key of Object.keys(row)) {
          if ((key === 'C' || key === 'Total Score (points)' || key.includes('score')) && 
              (typeof row[key] === 'number' || !isNaN(parseFloat(row[key])))) {
            score = parseFloat(row[key]);
            break;
          }
        }
        
        if (name && score !== null) {
          return { name, rawScore: score };
        }
        return null;
      }).filter(student => student !== null);
    }
    
    // If we couldn't extract students from the JSON data, log an error
    if (students.length === 0) {
      console.warn('Could not extract student data using standard method');
      // Return an empty object to trigger the error in the calling function
      return { students: [], pairs: [], stats: {} };
    }
    
    // Process the extracted student data
    return processStudentData(students);
  }
  
  // Process student data: add noise, sort, and pair
  function processStudentData(students) {
    
    // Calculate standard deviation of raw scores
    const mean = students.reduce((sum, student) => sum + student.rawScore, 0) / students.length;
    const variance = students.reduce((sum, student) => sum + Math.pow(student.rawScore - mean, 2), 0) / students.length;
    const stdDev = Math.sqrt(variance);
    
    // Add Gaussian noise proportional to the standard deviation
    // We'll use a noise factor of 0.2 * stdDev
    const noiseFactor = 0.2 * stdDev;
    
    const studentsWithNoise = students.map(student => {
      // Box-Muller transform to generate Gaussian noise
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      
      // Apply noise proportional to the standard deviation
      const noise = z0 * noiseFactor;
      const noisyScore = student.rawScore + noise;
      
      return {
        ...student,
        noisyScore
      };
    });
    
    // Sort by noisy score (descending)
    studentsWithNoise.sort((a, b) => b.noisyScore - a.noisyScore);
    
    // Create pairs (highest with lowest)
    const pairs = [];
    const n = studentsWithNoise.length;
    
    if (n % 2 === 0) {
      // Even number of students - pair highest with lowest
      for (let i = 0; i < n / 2; i++) {
        // Randomly decide if student1 should be the higher or lower scoring student
        const randomizeOrder = Math.random() > 0.5;
        pairs.push({
          student1: randomizeOrder ? studentsWithNoise[i] : studentsWithNoise[n - 1 - i],
          student2: randomizeOrder ? studentsWithNoise[n - 1 - i] : studentsWithNoise[i]
        });
      }
    } else {
      // Odd number of students - pair highest with lowest, with middle trio
      const middleIndex = Math.floor(n / 2);
      
      // Pair all except the middle three
      for (let i = 0; i < (n - 3) / 2; i++) {
        // Randomly decide if student1 should be the higher or lower scoring student
        const randomizeOrder = Math.random() > 0.5;
        pairs.push({
          student1: randomizeOrder ? studentsWithNoise[i] : studentsWithNoise[n - 1 - i],
          student2: randomizeOrder ? studentsWithNoise[n - 1 - i] : studentsWithNoise[i]
        });
      }
      
      // Create a trio with the middle three students (randomize order)
      const trioStudents = [
        studentsWithNoise[middleIndex - 1],
        studentsWithNoise[middleIndex],
        studentsWithNoise[middleIndex + 1]
      ];
      // Shuffle the trio
      for (let i = trioStudents.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [trioStudents[i], trioStudents[j]] = [trioStudents[j], trioStudents[i]];
      }
      
      pairs.push({
        student1: trioStudents[0],
        student2: trioStudents[1],
        student3: trioStudents[2]
      });
    }
    
    // Randomize the order of the pairs
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }
    
    return {
      students: studentsWithNoise,
      pairs,
      stats: {
        mean,
        stdDev,
        noiseFactor
      }
    };
  }

  // Display the results in the UI
  function displayResults(data) {
    // Update summary stats
    const summaryElement = document.getElementById('summary');
    summaryElement.innerHTML = `<p class="summary-stats">${data.pairs.length} team${data.pairs.length === 1 ? '' : 's'} created from ${data.students.length} students</p>`;
    
    // Update heading
    const resultsHeading = document.querySelector('#results-card h2');
    resultsHeading.textContent = 'Teams';
    resultsHeading.className = 'teams-heading';
    
    // Clear previous results
    pairsContainer.innerHTML = '';
    
    // Add each pair to the UI
    data.pairs.forEach((pair, index) => {
      const pairElement = document.createElement('div');
      pairElement.className = 'pair-item';
      // Add alternating background color
      if (index % 2 === 0) {
        pairElement.classList.add('even-row');
      } else {
        pairElement.classList.add('odd-row');
      }
      
      // Create HTML for the team without scores
      let pairHTML = `
        <div class="student">
          <div class="student-name">${pair.student1.name}</div>
        </div>
        <div class="student">
          <div class="student-name">${pair.student2.name}</div>
        </div>
      `;
      
      // Add third student if this is a trio
      if (pair.student3) {
        pairHTML += `
          <div class="student">
            <div class="student-name">${pair.student3.name}</div>
          </div>
        `;
      }
      
      pairElement.innerHTML = pairHTML;
      pairsContainer.appendChild(pairElement);
    });
  }

  // Generate and download Teams PDF (without scores)
  function generateTeamsPDF() {
    if (!processedData) {
      alert('No data to export');
      return;
    }
    
    // Create a new jsPDF instance
    const doc = new jspdf.jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.setTextColor(70, 23, 143); // Kahoot purple
    doc.text('Kahoot Teams Report', 105, 15, { align: 'center' });
    
    // Add date (without time)
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const now = new Date();
    doc.text(`Generated on ${now.toLocaleDateString()}`, 105, 22, { align: 'center' });
    
    // Add summary in larger font on one line
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Students: ${processedData.students.length} | Teams Created: ${processedData.pairs.length}`, 105, 30, { align: 'center' });
    
    // Create table data for pairs (without scores)
    const tableData = [];
    
    // Add header row
    const hasTrioGroup = processedData.pairs.some(pair => pair.student3);
    const headers = hasTrioGroup ? 
      ['Team', 'Student 1', 'Student 2', 'Student 3'] :
      ['Team', 'Student 1', 'Student 2'];
    
    tableData.push(headers);
    
    // Add data rows
    processedData.pairs.forEach((pair, index) => {
      const row = [
        `${index + 1}`,
        pair.student1.name,
        pair.student2.name
      ];
      
      // Add third student if this is a trio
      if (pair.student3) {
        row.push(pair.student3.name);
      } else if (hasTrioGroup) {
        // Add empty cell to maintain table structure
        row.push('');
      }
      
      tableData.push(row);
    });
    
    // Create the table
    doc.autoTable({
      head: [tableData[0]],
      body: tableData.slice(1),
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: [70, 23, 143],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 250]
      },
      margin: { top: 40 }
    });
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('Generated by KahootMate', 105, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    
    // Save the PDF
    doc.save('Kahoot_Teams.pdf');
  }
  
  // Generate and download Results PDF (with scores)
  function generateResultsPDF() {
    if (!processedData) {
      alert('No data to export');
      return;
    }
    
    // Create a new jsPDF instance
    const doc = new jspdf.jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.setTextColor(70, 23, 143); // Kahoot purple
    doc.text('Kahoot Results Report', 105, 15, { align: 'center' });
    
    // Add date (without time)
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const now = new Date();
    doc.text(`Generated on ${now.toLocaleDateString()}`, 105, 22, { align: 'center' });
    
    // Add summary in larger font on one line
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Students: ${processedData.students.length} | Teams Created: ${processedData.pairs.length}`, 105, 30, { align: 'center' });
    
    // Create table data for pairs with scores
    const tableData = [];
    
    // Add header row
    const hasTrioGroup = processedData.pairs.some(pair => pair.student3);
    const headers = hasTrioGroup ? 
      ['Team', 'Student 1', 'Score', 'Student 2', 'Score', 'Student 3', 'Score'] :
      ['Team', 'Student 1', 'Score', 'Student 2', 'Score'];
    
    tableData.push(headers);
    
    // Add data rows
    processedData.pairs.forEach((pair, index) => {
      const row = [
        `${index + 1}`,
        pair.student1.name,
        pair.student1.rawScore.toFixed(1),
        pair.student2.name,
        pair.student2.rawScore.toFixed(1)
      ];
      
      // Add third student if this is a trio
      if (pair.student3) {
        row.push(pair.student3.name);
        row.push(pair.student3.rawScore.toFixed(1));
      } else if (hasTrioGroup) {
        // Add empty cells to maintain table structure
        row.push('');
        row.push('');
      }
      
      tableData.push(row);
    });
    
    // Create the table
    doc.autoTable({
      head: [tableData[0]],
      body: tableData.slice(1),
      startY: 40,
      theme: 'grid',
      headStyles: {
        fillColor: [70, 23, 143],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [240, 240, 250]
      },
      margin: { top: 40 }
    });
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text('Generated by KahootMate', 105, doc.internal.pageSize.height - 10, { align: 'center' });
    }
    
    // Save the PDF
    doc.save('Kahoot_Results.pdf');
  }

  // Helper function to update progress bar
  function updateProgress(percent, statusText) {
    progressBar.style.width = `${percent}%`;
    processingStatus.textContent = statusText;
  }
});
