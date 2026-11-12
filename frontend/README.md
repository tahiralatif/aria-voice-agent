# Skyline Properties - AI Voice Agent Frontend

A premium, fully functional voice-based real estate assistant for Dubai properties powered by Cartesia AI.

## 🎯 Project Overview

This is the frontend application for **Skyline Properties**, an AI-powered real estate voice agent named **Aria**. The system enables customers to:

- **Search properties** via voice conversation
- **Book property viewings** with natural language
- **Register as leads** with automatic qualification
- **Get instant answers** about Dubai real estate

## 🏗️ Architecture

### Two Main Screens

#### 1. `/call` - Live Voice Call Interface
Premium customer-facing voice experience featuring:
- **AI Orb visualization** with real-time animations
- **Microphone capture** (44.1kHz PCM audio)
- **WebSocket streaming** to Cartesia AI
- **Live transcript** of conversations
- **Agent activity panel** showing real-time backend actions
- **Call duration tracking**
- **Status indicators**: idle, connecting, listening, thinking, speaking, ended, error

#### 2. `/dashboard` - Real Estate CRM
Professional business dashboard with:
- **Overview statistics** (leads, calls, viewings)
- **Lead management** with scoring and qualification
- **Viewing appointments** tracker
- **Call history** with transcripts
- **Property inventory** management
- **Real-time activity** monitoring

### Tech Stack

- **Next.js 16.4.6** (App Router)
- **React 19.3.0**
- **TypeScript 5**
- **Tailwind CSS 4.3.3** (with Turbopack)
- **Cartesia AI** WebSocket API
- **Web Audio API** for audio capture/playback

## 📁 Project Structure

```
frontend/
├── app/
│   ├── page.tsx              # Home page with navigation
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   ├── call/
│   │   └── page.tsx          # Voice call interface
│   └── dashboard/
│       └── page.tsx          # CRM dashboard
├── lib/
│   ├── types.ts              # TypeScript types
│   ├── audio-service.ts      # Audio capture/playback
│   ├── cartesia-service.ts   # WebSocket communication
│   └── api-client.ts         # Backend API client
├── .env.local                # Environment variables
└── README.md                 # This file
```

## 🚀 Getting Started

### Prerequisites

1. **Node.js 18+** installed
2. **Backend running** on `http://localhost:8000`
3. **Admin token** from backend `.env` file

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your values
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ADMIN_TOKEN=your_admin_token_here
```

### Development

```bash
# Start development server
npm run dev

# Visit http://localhost:3000
```

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🎤 Audio Implementation

### Microphone Capture
- Uses **Web Audio API** with `getUserMedia`
- Sample rate: **44.1kHz**
- Format: **PCM 16-bit** (2 bytes per sample)
- Processing: **ScriptProcessorNode** (4096 buffer size)
- Conversion: Float32Array → Int16Array → Base64

### Audio Playback
- Dynamic **AudioBuffer** creation
- Scheduled playback with **AudioContext**
- Queue management for smooth streaming
- Automatic buffer cleanup

### WebSocket Protocol
Follows Cartesia's documented protocol:

**Outgoing (Client → Server):**
```json
{
  "type": "session_create",
  "audio": {
    "input_format": "pcm_44100",
    "output_delivery": "speaking_pace"
  },
  "continuous_input": true
}

{
  "type": "audio_input",
  "audio": "<base64_encoded_pcm_data>"
}
```

**Incoming (Server → Client):**
```json
{
  "type": "session_ready",
  "call_id": "...",
  "agent_id": "..."
}

{
  "type": "turn_started",
  "role": "user" | "assistant"
}

{
  "type": "turn_output_text_delta",
  "delta": "text chunk"
}

{
  "type": "audio_output",
  "audio": "<base64_encoded_pcm_data>"
}

{
  "type": "audio_output_clear"
}

{
  "type": "client_tool_call",
  "tool_name": "search_listings",
  "arguments": {...}
}
```

## 📊 Dashboard APIs

All dashboard data comes from the backend:

- `GET /api/leads` - Lead list with scoring
- `GET /api/viewings` - Scheduled viewings
- `GET /api/calls` - Call history
- `GET /api/contacts` - Registered contacts
- `GET /api/listings` - Property inventory

Authentication: `X-Admin-Token` header

## 🎨 Design System

### Color Palette
- **Background**: Slate 950/900 gradients
- **Primary**: Amber 400-600 (gold accents)
- **Secondary**: Blue 500-600
- **Success**: Green 500
- **Error**: Red 500-600
- **Text**: White/Slate 200-400

### Components
- **Glass morphism** effects (backdrop-blur)
- **Smooth animations** (scale, pulse, ping)
- **Gradient overlays** for depth
- **Border accents** with opacity
- **Responsive grid** layouts

## 🔒 Security

- **API keys** never exposed to client
- **Sessions created** server-side only
- **Admin token** required for dashboard
- **No PII** in public endpoints
- **CORS** properly configured

## 🐛 Troubleshooting

### Microphone Not Working
```
Error: "Microphone access denied"
Solution: Check browser permissions (chrome://settings/content/microphone)
```

### WebSocket Connection Failed
```
Error: "Connection error"
Solution: 
1. Verify backend is running
2. Check NEXT_PUBLIC_API_URL in .env.local
3. Ensure backend CORS allows frontend origin
```

### Dashboard Shows Auth Error
```
Error: "Failed to load data"
Solution:
1. Add NEXT_PUBLIC_ADMIN_TOKEN to .env.local
2. Copy exact token from backend/.env ADMIN_TOKEN
3. Restart dev server after changing .env.local
```

### No Audio Playback
```
Issue: Agent speaks but no sound
Solution:
1. Check browser console for audio errors
2. Try user interaction before starting call (audio autoplay policy)
3. Verify audio output device is selected
```

## 📝 Implementation Notes

### What's Working
✅ Microphone capture with proper audio format  
✅ WebSocket connection to Cartesia  
✅ Real-time audio streaming bidirectionally  
✅ Live transcript with user/assistant messages  
✅ Tool activity detection and display  
✅ Call duration tracking  
✅ Full CRM dashboard with all backend APIs  
✅ Responsive design for desktop/mobile  
✅ Production build with zero TypeScript errors  

### Browser Compatibility
- **Chrome/Edge**: ✅ Full support
- **Firefox**: ✅ Full support
- **Safari**: ⚠️ Requires user interaction before audio
- **Mobile**: ⚠️ Requires HTTPS for microphone access

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables on Vercel
Add in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` → Your backend URL
- `NEXT_PUBLIC_ADMIN_TOKEN` → Admin token

### Backend Requirements
- Must be accessible from frontend domain
- CORS must allow frontend origin
- Webhook endpoints must be publicly accessible (ngrok/cloudflared)

## 📄 License

Proprietary - Skyline Properties

## 🤝 Support

For issues or questions:
1. Check console for errors
2. Verify backend connectivity
3. Test microphone permissions
4. Review environment variables

---

Built with ❤️ for Dubai Real Estate
