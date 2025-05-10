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
            <p style="text-align:center;">Recently downloaded: <span class="detected-file" style="max-width: fit-content; margin: 6px auto;">${report.filename}</span></p>
            <p>Click below or drag and drop to upload this (or another) file</p>
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

  // Open picker when clicking in the drop-area, but avoid double-triggering when clicking on the file input label
  dropArea.addEventListener('click', (e) => {
    // Check if the click is on the file-input-label or its parent label
    const fileLabel = e.target.closest('.file-input-label');
    const parentLabel = e.target.closest('label');
    
    // Only trigger file input click if not clicking on the Choose File button or its parent label
    if (!fileLabel && !parentLabel) {
      fileInput.click();
    }
  });

  // Navigation buttons
  downloadTeamsPdfBtn.addEventListener('click', generateTeamsPDF);
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
        
        // Extract Kahoot name and date from Overview tab
        let kahootInfo = {
          name: 'Kahoot Quiz',
          date: new Date().toLocaleDateString()
        };
        
        // Try to find the Overview sheet
        const overviewSheetName = workbook.SheetNames.find(name => name.includes('Overview'));
        if (overviewSheetName) {
          const overviewSheet = workbook.Sheets[overviewSheetName];
          const overviewData = XLSX.utils.sheet_to_json(overviewSheet, { header: 'A' });
          
          // Based on the sample Excel structure:
          // - Kahoot name is in the first row, column A (A1)
          // - Date is in the second row, column B (B2) with "Played on" in column A
          
          if (overviewData.length > 0) {
            // Extract Kahoot name from first row, column A
            if (overviewData[0] && overviewData[0].A && typeof overviewData[0].A === 'string') {
              // Get the name and remove " Kahoot" if present
              let quizName = overviewData[0].A.trim();
              kahootInfo.name = quizName.replace(/ Kahoot$/i, '');
            }
            
            // Extract date from second row, column B (where A is "Played on")
            if (overviewData.length > 1 && overviewData[1]) {
              if (overviewData[1].A === 'Played on' && overviewData[1].B) {
                try {
                  // Try to parse the date
                  const dateValue = overviewData[1].B;
                  if (typeof dateValue === 'string') {
                    // If it's a string like "8 May 2025"
                    kahootInfo.date = dateValue;
                  } else if (typeof dateValue === 'object' && dateValue instanceof Date) {
                    // If it's already a Date object
                    kahootInfo.date = dateValue.toLocaleDateString();
                  } else if (typeof dateValue === 'number') {
                    // If it's a numeric Excel date
                    const excelDate = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
                    if (!isNaN(excelDate.getTime())) {
                      kahootInfo.date = excelDate.toLocaleDateString();
                    }
                  }
                } catch (e) {
                  console.log('Error parsing date:', e);
                  // Keep the default date
                }
              }
            }
          }
        }
        
        // Find the "Final Scores" sheet or use the first sheet
        let sheetName = workbook.SheetNames.find(name => name.includes('Final') && name.includes('Scores')) || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert the worksheet to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A' });
        
        updateProgress(70, 'Processing data...');
        
        // Extract student data from the Excel file
        // Process the extracted data
        processedData = processKahootData(jsonData);
        
        // Add Kahoot info to the processed data
        processedData.kahootInfo = kahootInfo;
        
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
    
    // Configuration parameters
    // noiseFactor: controls the amount of Gaussian noise added (as a proportion of stdDev)
    // alpha: threshold for determining teaching mode (in standard deviations)
    const noiseFactor = 0.2; // Can be adjusted as needed
    const alpha = 1.5; // Default threshold for teaching mode assignment
    
    // Add Gaussian noise proportional to the standard deviation
    const noiseAmount = noiseFactor * stdDev;
    
    const studentsWithNoise = students.map(student => {
      // Box-Muller transform to generate Gaussian noise
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
      
      // Apply noise proportional to the standard deviation
      const noise = z0 * noiseAmount;
      const noisyScore = student.rawScore + noise;
      
      return {
        ...student,
        noisyScore
      };
    });
    
    // Sort by noisy score (descending)
    studentsWithNoise.sort((a, b) => b.noisyScore - a.noisyScore);
    
    // Create pairs (highest with lowest) and determine teaching mode
    const pairs = [];
    const n = studentsWithNoise.length;
    
    if (n % 2 === 0) {
      // Even number of students - pair highest with lowest
      for (let i = 0; i < n / 2; i++) {
        // Get the higher and lower scoring students
        const higherStudent = studentsWithNoise[i];
        const lowerStudent = studentsWithNoise[n - 1 - i];
        
        // Calculate score difference in terms of standard deviations
        const scoreDiff = Math.abs(higherStudent.noisyScore - lowerStudent.noisyScore) / stdDev;
        
        // Determine teaching mode based on alpha threshold
        const teachingMode = scoreDiff > alpha ? 'Think-Lead-Learn' : 'Think-Mix-Master';
        
        // Randomly decide if student1 should be the higher or lower scoring student
        const randomizeOrder = Math.random() > 0.5;
        pairs.push({
          student1: randomizeOrder ? higherStudent : lowerStudent,
          student2: randomizeOrder ? lowerStudent : higherStudent,
          teachingMode,
          // Store which student is the teacher (the higher scoring one)
          teacher: randomizeOrder ? 'student1' : 'student2'
        });
      }
    } else {
      // Odd number of students - pair highest with lowest, with middle trio
      const middleIndex = Math.floor(n / 2);
      
      // Pair all except the middle three
      for (let i = 0; i < (n - 3) / 2; i++) {
        // Get the higher and lower scoring students
        const higherStudent = studentsWithNoise[i];
        const lowerStudent = studentsWithNoise[n - 1 - i];
        
        // Calculate score difference in terms of standard deviations
        const scoreDiff = Math.abs(higherStudent.noisyScore - lowerStudent.noisyScore) / stdDev;
        
        // Determine teaching mode based on alpha threshold
        const teachingMode = scoreDiff > alpha ? 'Think-Lead-Learn' : 'Think-Mix-Master';
        
        // Randomly decide if student1 should be the higher or lower scoring student
        const randomizeOrder = Math.random() > 0.5;
        pairs.push({
          student1: randomizeOrder ? higherStudent : lowerStudent,
          student2: randomizeOrder ? lowerStudent : higherStudent,
          teachingMode,
          // Store which student is the teacher (the higher scoring one)
          teacher: randomizeOrder ? 'student1' : 'student2'
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
      
      // For trios, always use Think-Mix-Master (as requested)
      pairs.push({
        student1: trioStudents[0],
        student2: trioStudents[1],
        student3: trioStudents[2],
        teachingMode: 'Think-Mix-Master',
        teacher: null // No designated teacher for trios
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
        noiseFactor,
        alpha
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
    
    // Add Kahoot name and date subtitle
    if (data.kahootInfo) {
      // Create subtitle element if it doesn't exist
      let subtitleElement = document.querySelector('#results-card .kahoot-subtitle');
      if (!subtitleElement) {
        subtitleElement = document.createElement('p');
        subtitleElement.className = 'kahoot-subtitle';
        // Insert after the heading
        resultsHeading.insertAdjacentElement('afterend', subtitleElement);
      }
      // Update subtitle text
      subtitleElement.textContent = `${data.kahootInfo.name} - ${data.kahootInfo.date}`;
    }
    
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
      
      // Create a container for students (left side, 2/3 width)
      const studentsContainer = document.createElement('div');
      studentsContainer.className = 'students-container';
      
      // Create a container for teaching mode (right side, 1/3 width)
      const modeContainer = document.createElement('div');
      modeContainer.className = 'mode-container';
      
      // Add specific class based on teaching mode for color styling
      if (pair.teachingMode === 'Think-Lead-Learn') {
        modeContainer.classList.add('mode-think-lead-learn');
      } else {
        modeContainer.classList.add('mode-think-mix-master');
      }
      
      modeContainer.textContent = pair.teachingMode || 'Think-Mix-Master';
      
      // Create HTML for the students
      let studentsHTML = '';
      
      // Truncate names to 15 chars if needed and add styling for teacher
      const student1Name = pair.student1.name.length > 15 ? 
        pair.student1.name.substring(0, 15) + '...' : pair.student1.name;
      const student2Name = pair.student2.name.length > 15 ? 
        pair.student2.name.substring(0, 15) + '...' : pair.student2.name;
      
      // Add styling for teacher if in Pair-Teach-Share mode
      const isStudent1Teacher = pair.teachingMode === 'Pair-Teach-Share' && pair.teacher === 'student1';
      const isStudent2Teacher = pair.teachingMode === 'Pair-Teach-Share' && pair.teacher === 'student2';
      
      studentsHTML += `
        <div class="student">
          <div class="student-name ${isStudent1Teacher ? 'teacher' : ''}">
            ${isStudent1Teacher ? '<strong><i class="fas fa-star"></i> ' + student1Name + '</strong>' : student1Name}
          </div>
        </div>
        <div class="student">
          <div class="student-name ${isStudent2Teacher ? 'teacher' : ''}">
            ${isStudent2Teacher ? '<strong><i class="fas fa-star"></i> ' + student2Name + '</strong>' : student2Name}
          </div>
        </div>
      `;
      
      // Add third student if this is a trio
      if (pair.student3) {
        const student3Name = pair.student3.name.length > 15 ? 
          pair.student3.name.substring(0, 15) + '...' : pair.student3.name;
        
        studentsHTML += `
          <div class="student">
            <div class="student-name">${student3Name}</div>
          </div>
        `;
      }
      
      studentsContainer.innerHTML = studentsHTML;
      
      // Add the containers to the pair element
      pairElement.appendChild(studentsContainer);
      pairElement.appendChild(modeContainer);
      
      pairsContainer.appendChild(pairElement);
    });
  }

  // Generate and download Teams PDF by capturing the current HTML view
  function generateTeamsPDF() {
    if (!processedData) {
      alert('No data to export');
      return;
    }
    
    // Get the results card element that contains the Teams section
    const resultsCard = document.getElementById('results-card');
    
    // Create a temporary container to clone the content we want to capture
    const tempContainer = document.createElement('div');
    tempContainer.className = 'pdf-capture-container';
    document.body.appendChild(tempContainer);
    
    // Clone only the teams content (without the KahootMate header)
    const teamsHeading = document.querySelector('#results-card h2').cloneNode(true);
    const kahootSubtitle = document.querySelector('#results-card .kahoot-subtitle');
    const summary = document.getElementById('summary').cloneNode(true);
    const pairsContent = document.getElementById('pairs-container').cloneNode(true);
    
    // Add the cloned elements to our temporary container (starting with Teams heading)
    tempContainer.appendChild(teamsHeading);
    if (kahootSubtitle) {
      tempContainer.appendChild(kahootSubtitle.cloneNode(true));
    }
    tempContainer.appendChild(summary);
    tempContainer.appendChild(pairsContent);
    
    // Add a footer
    const footer = document.createElement('div');
    footer.className = 'pdf-footer';
    footer.innerHTML = `<p>Generated by KahootMate on ${new Date().toLocaleDateString()}</p>`;
    tempContainer.appendChild(footer);
    
    // Add some temporary styling to make it look good in the PDF
    const tempStyle = document.createElement('style');
    tempStyle.textContent = `
      .pdf-capture-container {
        background-color: white;
        padding: 20px;
        max-width: 800px;
        margin: 0 auto;
        font-family: 'Montserrat', sans-serif;
      }
      .pdf-capture-container header {
        text-align: center;
        margin-bottom: 20px;
      }
      .pdf-capture-container h1 {
        color: #46178F;
        margin-bottom: 5px;
      }
      .pdf-capture-container .teams-heading {
        color: #46178F;
        margin-top: 20px;
        margin-bottom: 10px;
      }
      .pdf-capture-container .kahoot-subtitle {
        font-style: italic;
        margin-bottom: 15px;
      }
      .pdf-footer {
        text-align: center;
        margin-top: 30px;
        color: #666;
        font-size: 12px;
      }
    `;
    document.head.appendChild(tempStyle);
    
    // Use html2canvas to capture the content
    html2canvas(tempContainer, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      // Create PDF from canvas
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      // Calculate dimensions to fit the content properly
      const imgWidth = 210; // A4 width in mm (portrait)
      const pageHeight = 297; // A4 height in mm
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save the PDF with formatted name
      let fileName = `KahootMate_${new Date().toLocaleDateString('en-US', {month: '2-digit', day: '2-digit', year: '2-digit'}).replace(/\//g, '-')}.pdf`;
      
      // If we have the kahoot subtitle, extract the name and date
      if (kahootSubtitle) {
        const subtitleText = kahootSubtitle.textContent;
        // Extract kahoot name and date from format like "Template Algebra - 8 May 2025"
        const match = subtitleText.match(/(.+)\s+-\s+(\d+)\s+(\w+)\s+(\d+)/);
        
        if (match) {
          const kahootName = match[1].trim().replace(/\s+/g, '_'); // Replace spaces with underscores
          const day = match[2];
          const month = match[3];
          const year = match[4];
          
          // Convert month name to number
          const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
          const monthNum = monthNames.findIndex(m => m === month) + 1;
          
          // Format date as MM-DD-YY
          const formattedDate = `${monthNum}-${day}-${year.slice(-2)}`;
          
          // Final filename format: KahootMate_MM-DD-YY_Kahoot_Name.pdf
          fileName = `KahootMate_${formattedDate}_${kahootName}.pdf`;
        }
      }
      
      pdf.save(fileName);
      
      // Clean up - remove temporary elements
      document.body.removeChild(tempContainer);
      document.head.removeChild(tempStyle);
    }).catch(error => {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
      
      // Clean up even if there's an error
      document.body.removeChild(tempContainer);
      document.head.removeChild(tempStyle);
    });
  }
  
  // Helper function to update progress bar
  function updateProgress(percent, statusText) {
    progressBar.style.width = `${percent}%`;
    processingStatus.textContent = statusText;
  }
});
