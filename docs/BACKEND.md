# Backend API — Documentation

## Overview

Sign-to-Health AI includes a simple backend built with Next.js API Routes. It provides:

- **Session storage**: Persist patient sessions
- **Settings management**: Store API keys and preferences
- **Health monitoring**: System status endpoint
- **Statistics**: Session analytics

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   API Routes     │────▶│   File Storage  │
│   (React)       │◀────│   (Next.js)      │◀────│   (JSON)        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │   localStorage   │
                        │   (Fallback)     │
                        └──────────────────┘
```

## Storage

### Current Implementation (MVP)
- **Type**: File-based JSON storage
- **Location**: `./data/` directory
- **Files**:
  - `sessions.json` - Patient session records
  - `settings.json` - Application settings

### For Production
Consider upgrading to:
- PostgreSQL with Prisma
- MongoDB
- Supabase
- PlanetScale

## API Endpoints

### Health Check

```
GET /api/health
```

Returns system status and statistics.

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2026-01-31T19:13:04.997Z",
  "version": "1.0.0",
  "uptime": 9892.0020846,
  "responseTime": "26ms",
  "database": {
    "status": "connected",
    "sessionCount": 5,
    "dataDir": "/path/to/data"
  },
  "statistics": {
    "totalSessions": 5,
    "emergencies": 1,
    "avgDuration": "45s",
    "triageBreakdown": {
      "urgent": 2,
      "emergency": 1,
      "non-urgent": 2
    }
  },
  "services": {
    "mediaPipe": "client-side",
    "humeAI": "optional (requires API key)",
    "elevenLabs": "optional (requires API key)"
  }
}
```

### Sessions

#### List Sessions
```
GET /api/sessions
GET /api/sessions?filter=emergencies
GET /api/sessions?filter=today
GET /api/sessions?filter=week
GET /api/sessions?stats=true
GET /api/sessions?startDate=1234567890&endDate=1234567899
```

**Response:**
```json
{
  "success": true,
  "data": [...sessions],
  "count": 10
}
```

#### Get Session
```
GET /api/sessions/[id]
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session_123",
    "timestamp": 1234567890,
    "duration": 5000,
    "gestureTokens": ["point_chest", "pain"],
    "painRegion": "chest",
    "emotion": { "painLevel": 0.7, "distress": 0.5, "emotion": "In pain" },
    "clinicalInterpretation": "Patient reports chest pain",
    "triageUrgency": "urgent",
    "soapNote": { ... },
    "icd10Codes": ["R07.9"],
    "patientConfirmed": true,
    "emergencyTriggered": false
  }
}
```

#### Create Session
```
POST /api/sessions
Content-Type: application/json

{
  "id": "session_123",
  "timestamp": 1234567890,
  "duration": 5000,
  "gestureTokens": ["point_chest", "pain"],
  "clinicalInterpretation": "Patient reports chest pain",
  "triageUrgency": "urgent"
}
```

**Response:**
```json
{
  "success": true,
  "data": { ...session },
  "message": "Session saved successfully"
}
```

#### Update Session
```
PUT /api/sessions/[id]
Content-Type: application/json

{
  "patientConfirmed": true
}
```

#### Delete Session
```
DELETE /api/sessions/[id]
```

#### Clear All Sessions
```
DELETE /api/sessions
```

### Settings

#### Get Settings
```
GET /api/settings
```

Returns settings with API keys masked.

**Response:**
```json
{
  "success": true,
  "data": {
    "autoSaveEnabled": true,
    "voiceSummaryEnabled": true,
    "emergencyAlertEnabled": true,
    "maxSessionHistory": 100,
    "humeApiKey": "***configured***",
    "elevenLabsApiKey": null,
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

#### Update Settings
```
PUT /api/settings
Content-Type: application/json

{
  "autoSaveEnabled": false,
  "humeApiKey": "your_new_api_key"
}
```

#### Reset Settings
```
DELETE /api/settings
```

#### Get API Keys (Internal)
```
GET /api/settings/keys
```

Returns actual API keys for client-side services.

⚠️ **Security Note**: In production, use server-side proxy for API calls.

## Session Record Schema

```typescript
interface SessionRecord {
  id: string;              // Unique identifier
  timestamp: number;       // Unix timestamp (ms)
  duration: number;        // Session duration (ms)
  gestureTokens: string[]; // Detected gestures
  painRegion: string | null;
  emotion: EmotionState | null;
  clinicalInterpretation: string | null;
  triageUrgency: TriageUrgency | null;
  soapNote: SOAPNote | null;
  icd10Codes: string[];
  patientConfirmed: boolean | null;
  emergencyTriggered: boolean;
}
```

## Settings Schema

```typescript
interface AppSettings {
  humeApiKey?: string;
  elevenLabsApiKey?: string;
  autoSaveEnabled: boolean;
  voiceSummaryEnabled: boolean;
  emergencyAlertEnabled: boolean;
  maxSessionHistory: number;
  createdAt: number;
  updatedAt: number;
}
```

## Frontend Integration

### API Client

Use the API client in `src/lib/api.ts`:

```typescript
import { 
  fetchSessions, 
  saveSessionToApi, 
  fetchSettings,
  checkApiHealth 
} from "@/lib/api";

// Check if API is available
const isHealthy = await checkApiHealth();

// Fetch sessions (falls back to localStorage)
const sessions = await fetchSessions();

// Save session
await saveSessionToApi(session);

// Get settings
const settings = await fetchSettings();
```

### Fallback Strategy

The API client automatically falls back to localStorage if the API is unavailable:

1. Try API request
2. If fails, use localStorage
3. Sync localStorage to API when available

## Testing

### Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/health"
```

### Create Session
```powershell
$body = @{
  id = "test_123"
  timestamp = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
  gestureTokens = @("point_chest", "pain")
  clinicalInterpretation = "Test session"
  triageUrgency = "urgent"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3001/api/sessions" `
  -Method Post -Body $body -ContentType "application/json"
```

### List Sessions
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/sessions"
```

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (missing fields)
- `404` - Not Found
- `500` - Server Error
- `503` - Service Unavailable (health check failed)

## File Structure

```
src/
├── app/
│   └── api/
│       ├── health/
│       │   └── route.ts       # Health check endpoint
│       ├── sessions/
│       │   ├── route.ts       # Sessions CRUD
│       │   └── [id]/
│       │       └── route.ts   # Single session operations
│       └── settings/
│           ├── route.ts       # Settings management
│           └── keys/
│               └── route.ts   # API keys endpoint
├── lib/
│   ├── db.ts                  # Database operations
│   └── api.ts                 # Frontend API client
data/
├── sessions.json              # Session storage
└── settings.json              # Settings storage
```

## Security Considerations

### Current (MVP)
- API keys stored in plain JSON (acceptable for local development)
- No authentication on API routes
- CORS handled by Next.js defaults

### For Production
1. **Authentication**: Add NextAuth.js or similar
2. **API Keys**: Use environment variables or encrypted storage
3. **Rate Limiting**: Add rate limiting middleware
4. **CORS**: Configure allowed origins
5. **HTTPS**: Ensure all traffic is encrypted
6. **Input Validation**: Add schema validation (Zod)
7. **Audit Logging**: Log all API access

## Environment Variables

```bash
# Optional: Override data directory
DATA_DIR=/path/to/data

# API Keys (can also be set via /api/settings)
NEXT_PUBLIC_HUME_API_KEY=your_hume_key
NEXT_PUBLIC_ELEVENLABS_API_KEY=your_elevenlabs_key
```

## Upgrading to Production Database

### Option 1: Prisma + PostgreSQL

```bash
npm install prisma @prisma/client
npx prisma init
```

```prisma
// prisma/schema.prisma
model Session {
  id                    String   @id
  timestamp             BigInt
  duration              Int
  gestureTokens         String[]
  painRegion            String?
  clinicalInterpretation String?
  triageUrgency         String?
  emergencyTriggered    Boolean  @default(false)
  createdAt             DateTime @default(now())
}
```

### Option 2: MongoDB

```bash
npm install mongodb
```

### Option 3: Supabase

```bash
npm install @supabase/supabase-js
```

## Monitoring

The `/api/health` endpoint provides:
- System uptime
- Database connection status
- Session statistics
- Response time

Use with monitoring tools like:
- UptimeRobot
- Pingdom
- AWS CloudWatch
- Datadog
