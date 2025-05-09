# KahootMate

A Chrome extension that enhances Kahoot classroom experiences by dynamically pairing students based on quiz results. KahootMate processes Kahoot Excel reports, adds controlled randomization to scores, and creates balanced student pairings for cooperative and hierarchical learning.

## Installation

### Chrome Web Store

Install the extension at [link]

### Development Mode

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the project directory
5. The KahootMate extension should now appear in your extensions list

## Usage

1. Navigate to the Kahoot website in teacher mode, build a classic Kahoot, and have your students take it!
2. On the Kahoot website, go to Reports > Report options > click on "Download report"
3. KahootMate will detect the report and encourage you to upload it
4. Click on the upload button, drag the downloaded report in (or choose another report), and click "Process Report"
5. View the team groupings, and download them as a PDF if you want!

## How It Works

KahootMate follows this process:

1. **Detection**: Listens for `.xlsx` file downloads from kahoot.com
2. **Processing**: Prompts you to provide the Kahoot report with all students' results
3. **Noise Addition**: Adds Gaussian noise to results proportional to `noiseFactor * standard deviation`, ensuring results aren't fully deterministic and that outlier students don't always get the same partners
4. **Ranking**: Sorts students based on these noisy results
5. **Matching**: Pairs students so the top performer works with the lowest performer, second-highest with second-lowest, and so on to the middle
   - If pairs are more than `alpha * standard deviation` apart in score, they follow a Pair-Teach-Share model with the higher-performing student as "teacher"
   - If there's an odd number of students, a group of 3 is formed from the median students, following a Think-Pair-Share approach
6. **Randomization**: Teams (top to bottom) and team members (left and right) are uniformly randomly sorted to remove bias

## Sample Report

The repository includes a sample Kahoot report for testing purposes. This sample contains fake student data and demonstrates the format of Kahoot Excel reports, which should have a "Final Scores" sheet with student names in column B and their scores in column C starting from row 4.

## Technical Details

- Built with Manifest V3 for Chrome Extensions
- Uses SheetJS for Excel parsing
- Uses jsPDF and HTML2Canvas for PDF generation
- All processing happens client-side (no server required)

## Project Structure

```bash
kahootmate/
├── icons/                # Extension icons
├── lib/                  # Third-party libraries
│   ├── xlsx.full.min.js  # SheetJS library
│   ├── jspdf.umd.min.js  # jsPDF library
│   ├── jspdf.plugin.autotable.min.js  # jsPDF AutoTable plugin
│   └── html2canvas.min.js  # html2canvas library
├── src/
│   ├── css/              # Stylesheets
│   │   ├── popup.css     # Popup styles
│   │   └── processor.css # Processor page styles
│   └── js/               # JavaScript files
│       ├── background.js # Background service worker
│       ├── content.js    # Content script
│       ├── popup.js      # Popup script
│       └── processor.js  # Processor page script
├── test/                 # Test files
│   ├── test.js           # Main test script
│   └── test_excel.js     # Excel processing test script
├── manifest.json         # Extension manifest
├── popup.html            # Popup HTML
└── processor.html        # Processor page HTML
```

## License

This project is for educational purposes only.
