# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Visual Diff is an image comparison tool with a Flask backend (Python) and React frontend. It compares two images and generates a visual diff highlighting pixel differences. The application is optimized for 480×800 resolution images.

## Development Commands

### Backend (Flask)

```bash
# Activate virtual environment
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run Flask server (runs on port 5000)
python app.py
```

### Frontend (React)

```bash
cd client

# Install dependencies
npm install

# Start development server (runs on port 3000)
npm start

# Build for production
npm run build

# Run tests
npm test
```

## Architecture

### Backend (`app.py`)
- Single Flask application with CORS enabled for `/api/*` routes
- Uploads stored in `uploads/`, results in `results/`
- Image processing uses OpenCV with multi-threshold detection algorithm:
  1. Resize both images to 480×800 using LANCZOS4 interpolation
  2. Apply Gaussian blur for noise reduction
  3. Dual threshold detection (20 & 35 values)
  4. Morphological operations (open/close) for mask cleanup
  5. Contour detection and red overlay for differences

### API Endpoints
- `GET /api/health` - Health check
- `POST /api/compare` - Compare two images (multipart form: `original`, `current`)
- `GET /api/download/<filename>` - Download result image
- `GET /api/preview/<filename>` - Preview result image

### Frontend (`client/`)
- React 19 with Tailwind CSS for styling
- Main component: `src/ImageComparison.js` - handles all UI and API interaction
- API base URL is hardcoded in `ImageComparison.js` (`API_BASE` constant)
- Uses lucide-react for icons

## Key Configuration

- **Max upload size**: 16MB (configured in Flask)
- **Allowed image formats**: PNG, JPG, JPEG, GIF, BMP, TIFF
- **Output resolution**: Fixed 480×800 pixels
- **Backend port**: 5000
- **Frontend port**: 3000 (default React dev server)
