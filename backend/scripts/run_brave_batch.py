"""Sequentially fetch and durably store a fixed Brave search batch.

This script deliberately performs one successful Brave request at a time. The
raw response is captured before JSON parsing and is committed together with
every result item in one SQLite transaction by the application's persistence
function. A failed query stops the batch so no query is silently skipped.
"""

from __future__ import annotations

import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import (  # noqa: E402
    DATABASE_PATH,
    database_connection,
    extract_result_items,
    persist_search_response,
)


QUERIES = [
    "how do I change my legal name",
    "how to replace a lost identity card",
    "how to find an old friend online",
    "how to write a birthday message for my sister",
    "what should I bring to a housewarming party",
    "how to apologize after an argument",
    "how to plan a surprise birthday party",
    "how to make friends in a new city",
    "how to start a family photo album",
    "how to organize important personal documents",
    "how to write a sympathy message",
    "what to say in a condolence card",
    "how to prepare for a first date",
    "how to politely decline an invitation",
    "how to ask someone to be a reference",
    "how to create a personal emergency contact list",
    "how to update my emergency contact information",
    "how to find a lost wallet",
    "how to report a lost passport",
    "how to prepare for moving into a new apartment",
    "what should I buy for a new apartment",
    "how to change my mailing address",
    "how to forward mail to a new address",
    "how to safely meet someone from online",
    "how to make a weekly family schedule",
    "where can I find a good breakfast nearby",
    "best restaurants open late tonight",
    "where to find vegetarian food nearby",
    "where to find halal restaurants",
    "where to find gluten free food",
    "best food delivery services near me",
    "how to order food for a large group",
    "how much food should I prepare for ten people",
    "what should I cook for a dinner party",
    "easy food to make for children",
    "healthy snacks that do not need refrigeration",
    "how to make soup from leftover vegetables",
    "how to keep cooked food fresh",
    "how long can leftovers stay in the fridge",
    "how to tell if milk has gone bad",
    "how to safely thaw frozen meat",
    "what temperature should chicken be cooked to",
    "how to make rice without a rice cooker",
    "how to make a simple salad dressing",
    "what can I use instead of eggs in baking",
    "how to make homemade pizza dough",
    "how to make a restaurant reservation",
    "how to cancel a restaurant reservation",
    "best local foods to try while traveling",
    "where can I find a 24 hour food shop",
    "best hotels near the city center",
    "affordable hotels with breakfast included",
    "hotels with late check in",
    "hotels that allow early check in",
    "hotels with airport shuttle service",
    "best family friendly hotels",
    "hotels with accessible rooms",
    "hotels with free parking",
    "hotels with a swimming pool",
    "quiet hotels for a business trip",
    "best hostels for solo travelers",
    "how to compare hotel prices",
    "how to check hotel cancellation policies",
    "what is included in a hotel resort fee",
    "how to request a late checkout",
    "how to ask for a quieter hotel room",
    "what identification is needed to check into a hotel",
    "can I check into a hotel without a credit card",
    "how to report a problem with a hotel room",
    "where to stay near the airport overnight",
    "emergency phone number in my country",
    "ambulance number near me",
    "police emergency number near me",
    "fire department emergency number near me",
    "poison control phone number",
    "suicide crisis hotline in my country",
    "domestic violence helpline near me",
    "child protection emergency number",
    "emergency mental health support near me",
    "what to do if someone is having a seizure",
    "what to do if someone is unconscious",
    "what to do if someone is choking",
    "what to do if someone is having a severe allergic reaction",
    "what to do during a house fire",
    "what to do if I feel unsafe at home",
    "how to find an after hours doctor",
    "how to find a walk in clinic",
    "how to book a telehealth appointment",
    "how to find a nearby dentist",
    "how to find a nearby eye doctor",
    "what to do about a persistent cough",
    "when should I see a doctor for a fever",
    "what causes sudden dizziness",
    "what causes frequent headaches",
    "how to treat a minor kitchen burn",
    "how to care for a sprained ankle",
    "how to clean and cover a small cut",
    "how to know if a wound is infected",
    "how to prepare for a medical appointment",
    "what information should I bring to a doctor visit",
]


# A larger, varied query bank used for the 1,000-query run. The final batch is
# filtered against every query already stored in SQLite before any network
# request is made.
QUERY_TOPICS = [
    "choosing a bank account",
    "buying a used car",
    "renting an apartment",
    "planning a wedding budget",
    "preparing for a driving test",
    "finding a qualified babysitter",
    "starting a personal journal",
    "building a morning routine",
    "planning a family reunion",
    "choosing a school for a child",
    "organizing a garage",
    "planning a retirement party",
    "writing a personal will",
    "getting a document notarized",
    "replacing a broken house key",
    "planning a community event",
    "choosing a pet sitter",
    "preparing for a long distance move",
    "setting up a home office",
    "creating a household inventory",
    "making sourdough bread",
    "cooking dried beans",
    "making homemade jam",
    "baking a birthday cake",
    "preparing vegetarian lunches",
    "cooking lentils",
    "making fresh pasta sauce",
    "storing herbs in the freezer",
    "choosing a chef knife",
    "making homemade yogurt",
    "cooking with an air fryer",
    "making a packed school lunch",
    "preparing food for a picnic",
    "making a low cost dinner",
    "cooking with a slow cooker",
    "choosing a coffee grinder",
    "making cold brew coffee",
    "storing fresh bread",
    "planning a weekly grocery list",
    "cooking with seasonal vegetables",
    "planning a weekend road trip",
    "traveling by international train",
    "choosing a travel backpack",
    "booking a vacation rental",
    "traveling with a baby",
    "planning a hiking holiday",
    "finding a pet friendly hotel",
    "choosing travel insurance",
    "planning a cultural vacation",
    "traveling with prescription medicine",
    "finding a long stay apartment",
    "planning a museum trip",
    "choosing a beach destination",
    "traveling during a public holiday",
    "finding a hotel with a kitchen",
    "planning a rail pass journey",
    "choosing a camping location",
    "traveling with only carry on luggage",
    "planning a city walking tour",
    "finding a quiet vacation destination",
    "understanding blood pressure readings",
    "building a balanced exercise plan",
    "improving flexibility at home",
    "choosing comfortable walking shoes",
    "managing seasonal allergies",
    "preparing for a blood test",
    "finding a reliable medical specialist",
    "tracking daily water intake",
    "reducing back strain at a desk",
    "improving sleep quality",
    "understanding food allergies",
    "planning healthy meals for a week",
    "recovering after a long flight",
    "protecting hearing at concerts",
    "choosing sunscreen for sensitive skin",
    "managing screen time for children",
    "preparing a basic first aid kit",
    "finding accessible exercise classes",
    "understanding health insurance claims",
    "supporting someone with stress",
    "choosing a password manager",
    "setting up a home network",
    "learning Linux basics",
    "choosing a laptop for school",
    "backing up smartphone data",
    "protecting an online account",
    "learning spreadsheet formulas",
    "choosing a cloud storage plan",
    "building a simple mobile app",
    "understanding computer memory",
    "setting up a wireless printer",
    "choosing noise cancelling headphones",
    "learning photo editing",
    "managing browser tabs",
    "understanding website cookies",
    "choosing a home security camera",
    "learning basic video editing",
    "setting up a smart television",
    "understanding software updates",
    "choosing an external hard drive",
    "learning keyboard shortcuts",
    "filing an annual tax return",
    "building a credit history",
    "choosing a travel credit card",
    "comparing home insurance",
    "saving for a first home",
    "planning monthly expenses",
    "understanding compound interest",
    "choosing a retirement account",
    "negotiating a service bill",
    "protecting against identity theft",
    "comparing electricity plans",
    "starting a small online business",
    "creating an invoice for freelance work",
    "understanding import taxes",
    "planning a charitable donation",
    "choosing a financial adviser",
    "building an emergency savings fund",
    "checking a credit report",
    "understanding rental bonds",
    "comparing mobile banking apps",
    "painting an interior wall",
    "repairing a leaking toilet",
    "choosing energy efficient light bulbs",
    "installing a ceiling fan",
    "cleaning a fabric sofa",
    "removing rust from metal",
    "choosing a vacuum cleaner",
    "maintaining a washing machine",
    "fixing a squeaky door",
    "choosing a home water filter",
    "growing tomatoes in containers",
    "caring for indoor succulents",
    "starting a compost bin",
    "removing weeds from a garden",
    "planting a shade garden",
    "pruning fruit trees",
    "protecting plants from frost",
    "choosing soil for houseplants",
    "attracting bees to a garden",
    "growing vegetables on a balcony",
    "learning conversational Spanish",
    "studying for a language exam",
    "choosing an online degree",
    "learning public speaking",
    "improving business writing",
    "studying for a certification exam",
    "choosing a coding bootcamp",
    "finding free academic journals",
    "planning a study timetable",
    "learning how to take better notes",
    "preparing a research presentation",
    "finding a remote job",
    "negotiating a freelance contract",
    "creating a professional portfolio",
    "preparing for a phone interview",
    "changing careers after thirty",
    "finding an internship",
    "writing a project proposal",
    "managing a small team",
    "improving workplace communication",
    "starting a side business",
    "understanding solar power",
    "learning about lunar phases",
    "identifying common clouds",
    "understanding earthquake warnings",
    "learning about deep sea animals",
    "understanding recycling symbols",
    "reducing household energy use",
    "learning about native birds",
    "understanding water quality tests",
    "choosing an astronomy telescope",
    "learning digital drawing",
    "choosing a beginner guitar",
    "starting a photography project",
    "learning watercolor painting",
    "choosing a board game for adults",
    "starting a book club",
    "finding live theatre tickets",
    "learning ballroom dancing",
    "choosing a sewing machine",
    "starting a pottery hobby",
    "training for a 5k race",
    "learning to swim as an adult",
    "choosing a bicycle for commuting",
    "starting indoor rock climbing",
    "learning basic yoga poses",
    "choosing a tennis racket",
    "joining a local walking group",
    "learning to ski safely",
    "choosing a kayak",
    "training for a charity run",
]

QUERY_TEMPLATES = [
    "how does {topic} work",
    "best beginner guide to {topic}",
    "how to get started with {topic}",
    "common mistakes with {topic}",
    "how to improve {topic}",
    "cost of {topic}",
    "how long does {topic} take",
    "best tools for {topic}",
    "how to compare {topic} options",
    "latest advice about {topic}",
]


def build_query_batch() -> list[str]:
    candidates = [
        template.format(topic=topic)
        for topic in QUERY_TOPICS
        for template in QUERY_TEMPLATES
    ]
    if len(set(candidates)) != len(candidates):
        raise RuntimeError("Generated query bank contains duplicate queries")

    with database_connection() as connection:
        existing = {
            str(row[0]).strip().casefold()
            for row in connection.execute("SELECT query FROM search_runs")
        }
    unused = [query for query in candidates if query.casefold() not in existing]
    if len(unused) < 1000:
        raise RuntimeError(
            f"Only {len(unused)} unique unused queries are available; refusing to run a partial batch"
        )
    return unused[:1000]


def stored_run(request_id: str) -> tuple[int, int, str] | None:
    with database_connection() as connection:
        row = connection.execute(
            """
            SELECT brave_result_count, stored_result_count, response_sha256
            FROM search_runs
            WHERE request_id = ?
            """,
            (request_id,),
        ).fetchone()
    if row is None:
        return None
    return int(row[0] or 0), int(row[1] or 0), str(row[2] or "")


def main() -> int:
    load_dotenv(BACKEND_DIR / ".env")
    api_key = os.getenv("BRAVE_API_KEY")
    if not api_key:
        raise RuntimeError("BRAVE_API_KEY is not configured in backend/.env")

    queries = build_query_batch()
    if len(queries) != 1000 or len(set(queries)) != 1000:
        raise RuntimeError("The batch must contain exactly 1,000 unique queries")

    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": api_key,
        "User-Agent": "TRON local search indexer/1.0",
    }
    timeout = httpx.Timeout(30.0, connect=10.0)
    total_results = 0

    print(f"batch_total={len(queries)} database={DATABASE_PATH}", flush=True)
    with httpx.Client(
        headers=headers,
        timeout=timeout,
        follow_redirects=True,
        # The bundled Windows Python trust store does not include the local
        # proxy's issuer. The request is restricted to Brave's HTTPS endpoint;
        # this matches the existing local favicon resolver workaround.
        verify=False,
    ) as client:
        for number, query in enumerate(queries, start=1):
            request_id = str(uuid.uuid4())
            requested_at = datetime.now(timezone.utc)
            last_error: Exception | None = None
            response: httpx.Response | None = None

            for attempt in range(1, 4):
                try:
                    response = client.get(
                        "https://api.search.brave.com/res/v1/web/search",
                        params={"q": query, "count": 20},
                    )
                    response.raise_for_status()
                    break
                except (httpx.HTTPError, OSError, ValueError) as exc:
                    last_error = exc
                    if attempt < 3:
                        time.sleep(attempt * 2)

            if response is None or response.is_error:
                raise RuntimeError(
                    f"query {number} failed after retries: {query}"
                ) from last_error

            raw_response = response.content
            try:
                payload = response.json()
            except ValueError as exc:
                raise RuntimeError(
                    f"query {number} returned invalid JSON: {query}"
                ) from exc

            expected_count = len(extract_result_items(payload))
            persist_search_response(
                request_id=request_id,
                query=query,
                requested_at=requested_at,
                status_code=response.status_code,
                raw_response=raw_response,
                payload=payload,
            )

            stored = stored_run(request_id)
            if stored is None:
                raise RuntimeError(f"query {number} was not found after commit: {query}")
            brave_count, stored_count, response_hash = stored
            if brave_count != expected_count or stored_count != expected_count:
                raise RuntimeError(
                    f"query {number} count mismatch for {query!r}: "
                    f"expected={expected_count} brave={brave_count} stored={stored_count}"
                )
            if not response_hash:
                raise RuntimeError(f"query {number} has no response hash: {query}")

            total_results += stored_count
            print(
                f"stored {number}/{len(queries)} results={stored_count} "
                f"total_results={total_results} query={query}",
                flush=True,
            )
            time.sleep(0.25)

    print(
        f"complete queries={len(queries)} total_results={total_results}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
