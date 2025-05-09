// Test script to verify data extraction from the actual sample_results.xlsx file
const fs = require('fs');
const XLSX = require('./lib/xlsx.full.min.js');

// Read the sample Excel file
const sampleFile = fs.readFileSync('./sample_results.xlsx');
const workbook = XLSX.read(sampleFile, { type: 'buffer' });

// Print all sheet names
console.log('Available sheets:', workbook.SheetNames);

// Examine the Overview sheet first
const overviewSheetName = workbook.SheetNames.find(name => name.includes('Overview'));
if (overviewSheetName) {
  console.log('\nExamining Overview sheet:');
  const overviewSheet = workbook.Sheets[overviewSheetName];
  
  // Convert to JSON to see the structure
  const overviewData = XLSX.utils.sheet_to_json(overviewSheet, { header: 'A' });
  console.log('Overview sheet data (first 10 rows):');
  console.log(JSON.stringify(overviewData.slice(0, 10), null, 2));
  
  // Look for cells that might contain the Kahoot name and date
  console.log('\nSearching for Kahoot name and date in Overview sheet:');
  let kahootName = null;
  let kahootDate = null;
  
  // Examine the first 10 rows to find potential Kahoot name and date
  for (let i = 0; i < Math.min(10, overviewData.length); i++) {
    const row = overviewData[i];
    console.log(`Row ${i}:`, row);
  }
}

// Find the "Final Scores" sheet
const sheetName = workbook.SheetNames.find(name => 
  name.toLowerCase().includes('final') || 
  name.toLowerCase().includes('score')) || workbook.SheetNames[0];

console.log(`\nUsing sheet for student data: ${sheetName}`);

// Get the worksheet
const worksheet = workbook.Sheets[sheetName];

// Manually extract student data from cells
const manualStudentData = [];

// Check for student data in rows 4 and onwards (typical for Kahoot reports)
// We'll check up to 20 rows to be safe
for (let i = 4; i < 24; i++) {
  const nameCell = worksheet[`B${i}`];
  const scoreCell = worksheet[`C${i}`];
  
  if (nameCell && scoreCell && nameCell.v && scoreCell.v) {
    manualStudentData.push({
      name: nameCell.v.toString(),
      rawScore: parseFloat(scoreCell.v) || 0
    });
  }
}

console.log('\nManually extracted student data:');
console.log(manualStudentData);

// If we found student data, process it
if (manualStudentData.length > 0) {
  // Calculate standard deviation of raw scores
  const mean = manualStudentData.reduce((sum, student) => sum + student.rawScore, 0) / manualStudentData.length;
  const variance = manualStudentData.reduce((sum, student) => sum + Math.pow(student.rawScore - mean, 2), 0) / manualStudentData.length;
  const stdDev = Math.sqrt(variance);
  
  // Add Gaussian noise proportional to the standard deviation
  const noiseFactor = 0.2 * stdDev;
  
  const studentsWithNoise = manualStudentData.map(student => {
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
  
  console.log('\nStudents with noise:');
  console.log(studentsWithNoise);
  
  console.log('\nStatistics:');
  console.log({ mean, stdDev, noiseFactor });
  
  console.log('\nPairs:');
  console.log(JSON.stringify(pairs, null, 2));
} else {
  console.log('No student data found in the Excel file');
}
