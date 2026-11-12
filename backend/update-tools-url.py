"""Point your existing Cartesia tools and event webhook at a new public URL.

Run (from the backend folder):
    uv run python update_tool_urls.py https://your-app.up.railway.app          # preview only
    uv run python update_tool_urls.py https://your-app.up.railway.app --apply  # make the changes

Needs in .env: CARTESIA_API_KEY, CARTESIA_AGENT_ID, TOOL_TOKEN
Only touches the 6 tools of YOUR agent. No duplicates are created.
"""
import os
import sys

import httpx
from dotenv import load_dotenv

BASE = "https://api.cartesia.ai"
NAMES = {"search_listings", "check_availability", "book_viewing", "save_lead", "web_search", "register_caller"}


def run(client: httpx.Client, agent_id: str, tool_token: str, public_url: str, apply: bool) -> int:
    public_url = public_url.rstrip("/")
    auth = {"mode": "bearer", "token": {"type": "secret", "secret_value": tool_token}}
    failures = 0

    # 1) list this agent's tools (paginated)
    tools, cursor = [], None
    while True:
        params = {"agent_id": agent_id, "limit": 100, "type": "webhook"}
        if cursor:
            params["starting_after"] = cursor
        r = client.get("/v1/agents/tools", params=params)
        r.raise_for_status()
        page = r.json()
        tools += page["data"]
        if not page.get("has_more") or not page["data"]:
            break
        cursor = page["data"][-1]["id"]

    found = {t["name"] for t in tools}
    print(f"Found {len(tools)} webhook tools on this agent.")
    for name in sorted(NAMES - found):
        print(f"  MISSING: {name} (not attached to this agent)")

    # 2) update each of our tools
    for t in tools:
        if t["name"] not in NAMES:
            continue
        schema = dict(t["api_schema"])
        new_url = f"{public_url}/tools/{t['name']}"
        print(f"  {t['name']}: {schema.get('url')} -> {new_url}")
        if not apply:
            continue
        schema["url"] = new_url
        schema["authentication"] = auth
        r = client.patch(f"/v1/agents/tools/{t['id']}", json={"api_schema": schema})
        if r.status_code >= 400:
            failures += 1
            print(f"    FAILED {r.status_code}: {r.text}")

    # 3) event webhook
    r = client.get(f"/v1/agents/{agent_id}")
    r.raise_for_status()
    agent = r.json()
    wh_id = (agent.get("config") or {}).get("event_webhook_id") or agent.get("event_webhook_id")
    if wh_id:
        new_url = f"{public_url}/cartesia/events"
        print(f"  event webhook {wh_id} -> {new_url}")
        if apply:
            r = client.patch(f"/agents/webhooks/{wh_id}", json={"url": new_url})
            if r.status_code >= 400:
                failures += 1
                print(f"    FAILED {r.status_code}: {r.text}")
    else:
        print("  No event webhook found on the agent (skip). Set it in the Cartesia dashboard if you need call transcripts.")

    print("Done." if apply else "Preview only. Add --apply to make these changes.")
    return failures


def main() -> None:
    load_dotenv()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args or not args[0].startswith("https://"):
        sys.exit("Usage: python update_tool_urls.py https://your-app.up.railway.app [--apply]")
    headers = {"X-API-Key": os.environ["CARTESIA_API_KEY"], "Cartesia-Version": "2026-08-14"}
    with httpx.Client(base_url=BASE, headers=headers, timeout=30) as c:
        failed = run(c, os.environ["CARTESIA_AGENT_ID"], os.environ["TOOL_TOKEN"], args[0], "--apply" in sys.argv)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()