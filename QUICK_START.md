# 🚀 Quick Start Guide - Skyline Properties

Get the AI Voice Agent running in 5 minutes!

## Step 1: Start Backend (Terminal 1)

```bash
cd backend
uv run uvicorn main:app --reload
```

✅ Backend should be running on `http://localhost:8000`

## Step 2: Start Frontend (Terminal 2)

```bash
cd frontend
npm install  # First time only
npm run dev
```

✅ Frontend should be running on `http://localhost:3000`

## Step 3: Test the Voice Call

1. **Open browser**: Visit `http://localhost:3000`
2. **Click**: "Voice Call" card
3. **Allow**: Microphone access when prompted
4. **Click**: "Start Call" button
5. **Speak**: "Hi, I'm looking for a 2 bedroom apartment in Dubai Marina"
6. **Listen**: Aria will respond with voice!
7. **Watch**: 
   - Transcript appears in real-time
   - Activity panel shows "Searching properties..."
   - AI orb pulses when speaking
8. **Continue**: Have a natural conversation
9. **End**: Click "End Call" when finished

## Step 4: Check the Dashboard

1. **Go back**: to home page
2. **Click**: "CRM Dashboard" card
3. **Explore**:
   - Overview stats (your call is counted!)
   - Leads tab (your conversation saved as lead)
   - Calls tab (your call history)
   - Properties tab (available listings)

## 🎉 That's It!

You now have a fully functional AI voice real estate agent!

## 🐛 Troubleshooting

### "Microphone access denied"
- **Chrome**: Go to `chrome://settings/content/microphone`
- Allow `localhost` to access microphone

### "Failed to create session"
- Check backend is running on port 8000
- Check console for errors

### "Dashboard auth error"
- Token is already configured in `.env.local`
- If changed, restart `npm run dev`

### "No audio playback"
- Click anywhere on page before starting call (browser audio policy)
- Check your computer's audio output is not muted

## 📝 What's Happening Behind the Scenes?

1. **Frontend** requests session from backend
2. **Backend** creates Cartesia AI session
3. **Frontend** connects WebSocket to Cartesia
4. **Microphone** captures your voice → converts to PCM → base64 → WebSocket
5. **Cartesia AI** processes speech → runs backend tools → generates response
6. **Backend tools** search properties, check availability, save leads
7. **Cartesia** sends audio back → base64 → PCM → speakers
8. **Transcript** shows both sides of conversation
9. **Activity panel** shows what the AI agent is doing
10. **Dashboard** displays all captured data

## 🎬 Demo Tips

For the best demo:

1. **Start with overview**: Show home page first
2. **Explain concept**: "This is Aria, our AI real estate assistant"
3. **Show voice interaction**: Do a full property search conversation
4. **Highlight features**: Point out transcript and activity panel
5. **Switch to dashboard**: Show how data is captured
6. **Explain business value**: Lead qualification, automated bookings, 24/7 availability

## 📱 Browser Compatibility

- ✅ **Chrome**: Best experience
- ✅ **Edge**: Full support
- ✅ **Firefox**: Full support
- ⚠️ **Safari**: Works, may need click before audio plays
- ⚠️ **Mobile**: Requires HTTPS in production

## 🔥 Production Deployment

### Frontend (Vercel)
```bash
vercel --prod
```

Add environment variables in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` = your backend URL
- `NEXT_PUBLIC_ADMIN_TOKEN` = from backend `.env`

### Backend (Railway/Render/AWS)
Deploy FastAPI backend with public URL.

Update `backend/.env`:
- `PUBLIC_URL` = your ngrok/cloudflared tunnel
- `FRONTEND_ORIGIN` = your Vercel URL

## ✨ Features to Showcase

### Voice Interface
- Natural conversation flow
- Real-time transcription
- Visual feedback (orb animations)
- Agent activity tracking

### CRM Dashboard
- Lead qualification (hot/warm/cold)
- Automated scoring (0-100)
- Viewing management
- Call history with AI summaries

### AI Capabilities
- Property search with filters
- Availability checking
- Viewing booking
- Lead registration
- Web search for general questions
- Email notifications

## 🎯 Next Steps

After testing:
1. Customize the agent prompt (`backend/agent_prompt.md`)
2. Replace sample listings with real properties
3. Add real Trakheesi permit numbers
4. Configure email settings for notifications
5. Set up production domains
6. Add your branding/logo

---

**Ready to impress?** Start the demo! 🚀

Questions? Check:
- `frontend/README.md` - Detailed documentation
- `IMPLEMENTATION_REPORT.md` - Complete feature list
- Console logs - For debugging
