// Test script to verify data processing with the sample Excel file
const fs = require('fs');
const XLSX = require('./lib/xlsx.full.min.js');

// Read the sample Excel file
const sampleFile = fs.readFileSync('./sample_results.xlsx');
const workbook = XLSX.read(sampleFile, { type: 'buffer' });

// Print all sheet names to understand the structure
console.log('Available sheets:', workbook.SheetNames);

// Find the "Final Scores" sheet
const sheetName = workbook.SheetNames.find(name => 
  name.toLowerCase().includes('final') || 
  name.toLowerCase().includes('score')) || workbook.SheetNames[0];

console.log(`Using sheet: ${sheetName}`);

// Get the worksheet
const worksheet = workbook.Sheets[sheetName];

// Examine the raw cell data to understand the structure
console.log('\nRaw worksheet data:');
console.log(worksheet);

// Try different parsing options
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 'A', raw: false });

// Create a manual mapping of student data
const manualStudentData = [];

// Based on our examination of the Excel file, we know the data is in rows 4 and 5
// with student names in column B and scores in column C
if (worksheet['B4'] && worksheet['C4']) {
  manualStudentData.push({
    name: worksheet['B4'].v,
    rawScore: parseFloat(worksheet['C4'].v) || 0
  });
}

if (worksheet['B5'] && worksheet['C5']) {
  manualStudentData.push({
    name: worksheet['B5'].v,
    rawScore: parseFloat(worksheet['C5'].v) || 0
  });
}

console.log('\nManually extracted student data:');
console.log(manualStudentData);

console.log('Raw JSON data from Excel:');
console.log(JSON.stringify(jsonData, null, 2));

// Process the data (similar to our extension's logic)
function processKahootData(students) {
  // If we're passed raw Excel data, extract student info
  // Otherwise, assume we're passed already extracted student data
  let extractedStudents = Array.isArray(students) ? students : [];
  
  if (extractedStudents.length === 0 && typeof students === 'object') {
    // Try to extract from raw Excel data
    extractedStudents = Object.keys(students)
      .filter(key => {
        const row = students[key];
        return row && typeof row === 'object';
      })
      .map(key => {
        const row = students[key];
        
        // Find the name and score in this row
        let name = null;
        let score = null;
        
        Object.keys(row).forEach(cellKey => {
          const value = row[cellKey];
          
          if (typeof value === 'string' && !name) {
            name = value;
          } else if ((typeof value === 'number' || !isNaN(parseFloat(value))) && !score) {
            score = parseFloat(value);
          }
        });
        
        if (name && score !== null) {
          return { name, rawScore: score };
        }
        return null;
      })
      .filter(student => student !== null);
  }
  
  // Calculate standard deviation of raw scores
  const mean = students.reduce((sum, student) => sum + student.rawScore, 0) / students.length;
  const variance = students.reduce((sum, student) => sum + Math.pow(student.rawScore - mean, 2), 0) / students.length;
  const stdDev = Math.sqrt(variance);
  
  // Add Gaussian noise proportional to the standard deviation
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
      noisyScore,
      noise
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
      pairs.push({
        student1: studentsWithNoise[i],
        student2: studentsWithNoise[n - 1 - i]
      });
    }
  } else {
    // Odd number of students - pair highest with lowest, with middle trio
    const middleIndex = Math.floor(n / 2);
    
    // Pair all except the middle three
    for (let i = 0; i < (n - 3) / 2; i++) {
      pairs.push({
        student1: studentsWithNoise[i],
        student2: studentsWithNoise[n - 1 - i]
      });
    }
    
    // Create a trio with the middle three students
    pairs.push({
      student1: studentsWithNoise[middleIndex - 1],
      student2: studentsWithNoise[middleIndex],
      student3: studentsWithNoise[middleIndex + 1]
    });
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

// Process the data using our manual extraction
const processedData = processKahootData(manualStudentData);

console.log('\nExtracted students with noise:');
console.log(processedData.students);

console.log('\nStatistics:');
console.log(processedData.stats);

console.log('\nPairs:');
console.log(JSON.stringify(processedData.pairs, null, 2));
