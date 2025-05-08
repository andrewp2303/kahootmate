# KahootMate

A Chrome extension that processes Kahoot report downloads, adds noise to scores, creates student pairings, and exports results as PDF.

## Features

- **Automatic Detection**: Detects `.xlsx` report downloads from kahoot.com
- **Data Processing**: 
  - Adds Gaussian noise to scores (proportional to standard deviation)
  - Sorts students by noisy score
  - Pairs highest-scoring with lowest-scoring students
  - Handles odd numbers of students with a middle trio
- **PDF Export**: Generates a styled PDF with student pairings
- **Kahoot Branding**: Uses Kahoot's signature purple (#46178F) for UI elements

## Installation

### Development Mode

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked" and select the project directory
5. The KahootMate extension should now appear in your extensions list

### Usage

1. Visit kahoot.com and download a report (`.xlsx` file)
2. The extension will detect the download and show a notification
3. Click "Process Now" in the notification to open the processor page
4. Upload the downloaded file (or it may be auto-suggested)
5. The extension will process the data and display student pairings
6. Click "Download PDF" to export the pairings as a PDF file

## Technical Details

- Built with Manifest V3 for Chrome Extensions
- Uses SheetJS for Excel parsing
- Uses jsPDF for PDF generation
- All processing happens client-side (no server required)

## Project Structure

```
kahootmate/
├── icons/                # Extension icons
├── lib/                  # Third-party libraries
│   ├── xlsx.full.min.js  # SheetJS library
│   ├── jspdf.umd.min.js  # jsPDF library
│   └── jspdf.plugin.autotable.min.js  # jsPDF AutoTable plugin
├── src/
│   ├── css/              # Stylesheets
│   │   ├── popup.css     # Popup styles
│   │   └── processor.css # Processor page styles
│   └── js/               # JavaScript files
│       ├── background.js # Background service worker
│       ├── content.js    # Content script
│       ├── popup.js      # Popup script
│       └── processor.js  # Processor page script
├── manifest.json         # Extension manifest
├── popup.html            # Popup HTML
└── processor.html        # Processor page HTML
```

## License

This project is for educational purposes only.
