# ATC Transcript Analyzer - Frontend

React-based web dashboard for the ATC Transcript Analyzer prototype.

## Features

- **Shift Selection**: Browse and filter available shifts by facility, date, and controller
- **Analysis Results**: View detailed fatigue and safety analysis reports
- **Transcript Viewer**: Review full transcripts with AI-annotated fatigue indicators
- **Timeline Visualization**: See fatigue trends over the course of a shift

## Tech Stack

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- React Router for navigation
- Recharts for data visualization
- Lucide React for icons

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable UI components
│   ├── pages/          # Page components (routes)
│   ├── types/          # TypeScript type definitions
│   ├── data/           # Mock data (replace with API calls)
│   ├── App.tsx         # Main app component with routing
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── public/             # Static assets
└── package.json        # Dependencies and scripts
```

## Pages

- `/` - Shift Selection screen
- `/shift/:shiftId` - Analysis Results screen
- `/shift/:shiftId/transcript` - Transcript Viewer

## API Integration

Currently uses mock data. To integrate with the backend API:

1. Update `src/data/mockData.ts` to fetch from API endpoints
2. Replace mock data imports in components with API calls
3. Add error handling and loading states

Expected API endpoints:
- `GET /api/shifts` - List available shifts
- `GET /api/shifts/:shiftId` - Get shift analysis report
- `GET /api/shifts/:shiftId/transcript` - Get full transcript
- `POST /api/shifts/:shiftId/analyze` - Trigger analysis

## Environment Variables

Create a `.env` file for API configuration:

```
VITE_API_URL=http://localhost:8000
```
