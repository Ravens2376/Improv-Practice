import anthropic
import os
import random
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    base_url="https://api.anthropic.com",
)

OBJECT_POOL = [
    "scissors", "stapler", "glasses", "water bottle", "notebook", "backpack",
    "wallet", "umbrella", "headphones", "TV remote", "plate", "bowl", "fork",
    "spoon", "spatula", "pot lid", "cutting board", "jacket", "scarf", "hat",
    "belt", "shoe", "sunglasses", "watch", "phone", "tablet", "mouse",
    "charger cable", "marker", "newspaper", "magazine", "envelope",
    "tape dispenser", "toothbrush", "comb", "towel", "apple", "banana",
    "sandwich", "coffee pot", "wine glass", "beer bottle", "takeout container",
    "keys", "book", "candle", "mug", "pen", "cup", "bottle", "bowl",
]

DRILL_SYSTEM_PROMPTS = {
    "scene": """You are an improv coach at an Unexpected Productions-style theater.
Generate a fresh, specific scene starter prompt. It should establish a clear WHO, WHAT, and WHERE.
Be specific and unusual — avoid generic prompts. Keep it to 1-2 sentences.
Examples of good prompts: "A lighthouse keeper teaches their replacement how to communicate with the fog.",
"Two strangers realize they've been leaving passive-aggressive notes for each other for three years.""",

    "character": """You are an improv coach. Generate a layered character prompt in 3 escalating stages.
Return JSON with exactly this structure:
{
  "layer1": "A specific, unusual character with a clear physicality or occupation",
  "layer2": "A physical detail or habit that reveals something about them",
  "layer3": "An emotional circumstance they are carrying right now"
}
Be specific and avoid clichés. Think of characters you'd find interesting on stage.""",

    "environment": """You are an improv coach. Generate a rich environment for solo exploration.
Return JSON with exactly this structure:
{
  "location": "A specific, unusual location",
  "detail1": "A sensory detail — something you can see or touch",
  "detail2": "A sensory detail — something you can hear or smell",
  "circumstance": "Something unusual that has just happened in this space"
}""",

    "word_association": """You are an improv coach running a word association drill.
Generate a single unexpected, evocative starting word. Just the word, nothing else.
Avoid obvious nouns. Think: textures, actions, emotions, obscure objects.""",

    "emotional": """You are an improv coach. Generate an emotional drill prompt.
Return JSON with exactly this structure:
{
  "emotion": "A specific nuanced emotion (not just 'happy' or 'sad' — think: 'quietly devastated', 'nervously proud')",
  "trigger": "The specific event or memory that caused this emotion",
  "physicality": "How this emotion lives in the body right now"
}""",

    "story": """You are an improv coach trained in narrative structure (similar to Unexpected Productions curriculum).
Generate a story structure prompt. Return JSON with exactly this structure:
{
  "once_upon_a_time": "Establish a character and their normal world",
  "every_day": "Their routine or pattern",
  "until_one_day": "The inciting incident that breaks the pattern",
  "because_of_that": "The first consequence",
  "until_finally": "The climax moment — what must be faced",
  "moral": "A theme or question the story is really about"
}""",

    "first_last": """You are an improv coach. Generate a first line / last line drill.
The first line opens a scene. The last line closes it with a button or callback.
They should feel like they belong to the same scene but leave a wide open middle.
Be specific, grounded, and avoid clichés.
Return JSON with exactly this structure:
{
  "first_line": "The opening line of the scene — a specific, actable sentence spoken by a character",
  "last_line": "The closing line — a callback, button, or revelation that makes the scene feel complete"
}""",

    "object": """You are an improv coach designing an object work drill for solo practice.
The object has already been chosen. Your job is to generate realistic actions and a scene context for it.

Return JSON with exactly this structure:
{
  "object": "{{OBJECT}}",
  "actions": ["3 to 4 specific physical actions — describe the body mechanics, not just the action. E.g. 'Pick it up by the handle, feeling the weight shift as you lift'"],
  "scene_context": "A specific, grounded scene where this object would appear naturally (e.g. 'You are a tired nurse on break in the hospital break room')"
}"""
}


async def generate_prompt(drill_type: str, context: str = "") -> dict:
    import json

    # For object drills, pick the object locally then ask AI only for actions/scene
    if drill_type == "object":
        # Determine which object to use
        if context and "object:" in context:
            obj = context.split("object:")[1].split(",")[0].strip()
        else:
            exclude = ""
            if context and "exclude:" in context:
                exclude = context.split("exclude:")[1].split(",")[0].strip().lower()
            pool = [o for o in OBJECT_POOL if o.lower() != exclude]
            obj = random.choice(pool)

        system = DRILL_SYSTEM_PROMPTS["object"].replace("{{OBJECT}}", obj)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=500,
            system=system,
            messages=[{"role": "user", "content": f"Generate actions and scene context for: {obj}"}]
        )
        content = message.content[0].text
        try:
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            data = json.loads(cleaned.strip())
            data["object"] = obj  # enforce our chosen object
            return {"type": "object", "data": data}
        except Exception:
            return {"type": "object", "data": {"object": obj, "raw": content}}

    system = DRILL_SYSTEM_PROMPTS.get(drill_type, DRILL_SYSTEM_PROMPTS["scene"])
    user_message = "Generate a new prompt."
    if context:
        user_message = f"Generate a new prompt. Context: {context}"

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=500,
        system=system,
        messages=[{"role": "user", "content": user_message}]
    )

    content = message.content[0].text

    if drill_type in ["character", "environment", "emotional", "story", "object", "first_last"]:
        try:
            cleaned = content.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
            return {"type": drill_type, "data": json.loads(cleaned.strip())}
        except Exception:
            return {"type": drill_type, "data": {"raw": content}}

    return {"type": drill_type, "data": {"text": content}}


async def analyze_object_work(with_object_frames: list, without_object_frames: list, object_name: str) -> str:
    """Analyze two sets of video frames and provide coaching feedback."""

    content = [
        {
            "type": "text",
            "text": f"""You are an expert improv coach analyzing object work practice.
The performer first practiced with a real {object_name}, then performed the same actions without it.
Compare these two performances and give specific, actionable coaching feedback.

Focus on:
- What physical details were maintained (weight, grip, wrist angle, etc.)
- What was lost or forgotten without the object
- Specific body mechanics to remember
- 2-3 concrete things to work on next time

Be specific and encouraging. This is for solo practice improvement."""
        }
    ]

    # Add frames from with-object video
    content.append({"type": "text", "text": f"\n--- WITH {object_name.upper()} ---"})
    for frame in with_object_frames[:4]:  # limit frames
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": frame}
        })

    # Add frames from without-object video
    content.append({"type": "text", "text": f"\n--- WITHOUT {object_name.upper()} (mime the object) ---"})
    for frame in without_object_frames[:4]:
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": "image/jpeg", "data": frame}
        })

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[{"role": "user", "content": content}]
    )

    return message.content[0].text
