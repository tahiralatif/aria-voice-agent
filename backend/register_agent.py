"""One-time setup: creates the 6 webhook tools + event webhook on Cartesia and
configures your agent (prompt, greeting, tools, end_call).

Run:  uv run python register_agent.py
Needs in .env: CARTESIA_API_KEY, CARTESIA_AGENT_ID, CARTESIA_WEBHOOK_SECRET,
               TOOL_TOKEN, PUBLIC_URL (https tunnel, no trailing slash), AGENCY_NAME
"""
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

KEY = os.environ["CARTESIA_API_KEY"]
AGENT_ID = os.environ["CARTESIA_AGENT_ID"]
WH_SECRET = os.environ["CARTESIA_WEBHOOK_SECRET"]
TOOL_TOKEN = os.environ["TOOL_TOKEN"]
PUBLIC_URL = os.environ["PUBLIC_URL"].rstrip("/")
AGENCY_NAME = os.environ.get("AGENCY_NAME", "Skyline Properties")

if not PUBLIC_URL.startswith("https://"):
    sys.exit("PUBLIC_URL must be https (use ngrok or cloudflared). localhost is blocked by Cartesia.")

H = {"X-API-Key": KEY, "Cartesia-Version": "2026-08-14", "Content-Type": "application/json"}
BASE = "https://api.cartesia.ai"
AUTH = {"mode": "bearer", "token": {"type": "secret", "secret_value": TOOL_TOKEN}}


def tool(name, description, props, required=None):
    schema = {"type": "object", "properties": props}
    if required:
        schema["required"] = required
    return {
        "type": "webhook",
        "name": name,
        "description": description,
        "pre_tool_speech": "auto",
        "execution_mode": "immediate",
        "response_timeout_secs": 10,
        "api_schema": {
            "url": f"{PUBLIC_URL}/tools/{name}",
            "method": "POST",
            "request_body_schema": schema,
            "authentication": AUTH,
        },
    }


S = lambda d: {"type": "string", "description": d}
N = lambda d: {"type": "number", "description": d}

TOOLS = [
    tool("search_listings",
         "Search available Dubai properties. Use whenever the caller describes what they want. Returns up to 3 matches with valid permits.",
         {"area": S("Dubai community, e.g. Dubai Marina, Downtown Dubai, Business Bay, JVC, Palm Jumeirah, Dubai Hills Estate"),
          "max_price": N("Maximum price in AED (annual rent for rentals, total price for sales)"),
          "min_bedrooms": N("Minimum number of bedrooms"),
          "listing_type": {"type": "string", "enum": ["sale", "rent"], "description": "sale or rent"}}),
    tool("check_availability",
         "Get open viewing times (Gulf Standard Time) for a listing on a date.",
         {"listing_id": N("Listing id from search_listings"), "date": S("Date in YYYY-MM-DD format")},
         ["listing_id", "date"]),
    tool("book_viewing",
         "Book a property viewing. Only call after the caller confirmed property, date, time, name and phone.",
         {"listing_id": N("Listing id"), "name": S("Caller full name"), "phone": S("Caller phone number including country code"),
          "date": S("Date in YYYY-MM-DD format"), "time": S("Time in HH:MM 24h format, from check_availability")},
         ["listing_id", "name", "phone", "date", "time"]),
    tool("save_lead",
         "Save the caller as a lead with everything learned. Call once before the call ends.",
         {"name": S("Caller name"), "phone": S("Caller phone number including country code"),
          "intent": {"type": "string", "enum": ["buy", "rent", "sell", "other"], "description": "What the caller wants"},
          "budget": N("Budget in AED"), "area": S("Preferred area"), "bedrooms": N("Bedrooms wanted"),
          "timeline": S("When they want to move or buy, in the caller's words"),
          "financing": {"type": "string", "enum": ["cash", "approved", "needs_loan", "unsure"], "description": "Financing status"},
          "has_agent": {"type": "boolean", "description": "True if already working with another agent"},
          "language": S("Caller's preferred language, e.g. English, Arabic, Hindi, Urdu")},
         ["name", "intent"]),
    tool("web_search",
         "Quick web search for general facts the caller asks about: neighbourhood, metro and transport, schools, "
         "amenities, market or regulation basics. Never use it for our own listing prices or availability.",
         {"query": S("Short, specific search query, e.g. 'Dubai Marina metro station distance'")},
         ["query"]),
    tool("register_caller",
         "Register the caller and email the team about them. Call once, only after the caller has confirmed "
         "their name and their email address spelled back letter by letter.",
         {"name": S("Caller full name"), "email": S("Caller email address, confirmed by spelling"),
          "phone": S("Caller phone number including country code"),
          "intent": {"type": "string", "enum": ["buy", "rent", "sell", "other"], "description": "What the caller wants"},
          "summary": S("Two or three sentences: what the caller wants, areas and budget discussed, properties of interest, any viewing booked"),
          "language": S("Caller's preferred language")},
         ["name", "email", "summary"]),
]


def post(path, body):
    r = httpx.post(f"{BASE}{path}", headers=H, json=body, timeout=30)
    if r.status_code >= 400:
        sys.exit(f"POST {path} failed: {r.status_code} {r.text}")
    return r.json()


tool_ids = []
for t in TOOLS:
    res = post("/v1/agents/tools", t)
    tool_ids.append(res["id"])
    print("tool created:", t["name"], res["id"])

wh = post("/agents/webhooks", {
    "display_name": "UAE real estate call events",
    "url": f"{PUBLIC_URL}/cartesia/events",
    "secret": WH_SECRET,
})
print("webhook created:", wh["id"])

prompt = open("agent_prompt.md", encoding="utf-8").read().replace("{AGENCY_NAME}", AGENCY_NAME)
cfg = {
    "config": {
        "instructions": prompt,
        "initial_message": (
            f"Hello, this is Aria, an AI assistant for {AGENCY_NAME}. "
            "This call may be recorded and transcribed to help us serve you. How can I help you today?"
        ),
        "tools": [{"id": i} for i in tool_ids],
        "system_tools": {"end_call": {}},
        "event_webhook_id": wh["id"],
    }
}
r = httpx.patch(f"{BASE}/v1/agents/{AGENT_ID}", headers=H, json=cfg, timeout=30)
if r.status_code >= 400:
    sys.exit(f"PATCH agent failed: {r.status_code} {r.text}")
print("agent configured. Open the Playground and press Preview to test.")