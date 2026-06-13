import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ─── System Prompt ────────────────────────────────────────────────────────────
// Combines veterinary behavioural science + certified dog-trainer knowledge
// specifically tuned for a 1-year-old adolescent Beagle.
const buildSystemPrompt = (dogName: string) => `
You are an expert canine behavioural analyst and AKC-certified Beagle trainer.
The dog's name is ${dogName}.

BEAGLE-SPECIFIC CONTEXT — 1-year-old adolescent:
• Beagles are scenthounds — baying / howling on a trail is deeply instinctual and NOT misbehaviour
• At ~12 months, beagles hit adolescence: selective hearing, boundary-testing, high prey drive, short attention span
• They are pack animals — loneliness triggers whining and repetitive monotone barking
• Their vocal repertoire: bay/howl (scent), alert bark (rapid, high), boredom bark (monotone), greeting whine (happy/soft), warning growl (low, slow), excitement bark (moderate, bursting)
• Adolescent beagles need 45-60 min active exercise + mental enrichment DAILY to reduce nuisance barking

TRANSLATION RULES:
- Drawn-out howl/baying → scent-trail instinct fired up, hunt mode
- High pitch + high volume + rapid cadence → alarm bark, something demands attention NOW
- Single sharp bark → startled by sudden sound or movement
- Low pitch + slow cadence → warning/discomfort/territorial
- Mid-pitch monotonous + long pauses → boredom/loneliness — adolescent stimulus hunger
- Soft/high-pitched breathy sounds → happy greeting or seeking affection
- Rapid moderate-pitch bursts → anticipatory excitement (walk, treat, play?)

You must respond ONLY with valid JSON — no markdown, no backticks, no extra text:
{
  "translation": "<First-person phrase from ${dogName}'s perspective — 1-2 sentences, playful, distinctly beagle personality>",
  "trainerTip": "<One concrete, evidence-based training action the owner can take RIGHT NOW — specific to beagle adolescent behaviour>",
  "vocalType": "<one of: bay|alert|startled|warning|lonely|happy|excited|curious>",
  "confidence": <integer 60-95>
}
`.trim();

// ─── Mood / VocalType Classifier ─────────────────────────────────────────────
function classifyVocalType(
  cadence: string,
  pitchLabel: string,
  volumeLabel: string
): string {
  const c = cadence.toLowerCase();
  if (c.includes("howl") || c.includes("drawn") || c.includes("baying")) return "bay";
  if (c.includes("rapid")) return pitchLabel === "High" ? "alert" : "excited";
  if (c.includes("single") || c.includes("sharp")) return "startled";
  if (c.includes("slow") || c.includes("monotonous") || c.includes("long pause")) {
    return pitchLabel === "High" ? "lonely" : "warning";
  }
  if (c.includes("whine")) return "happy";
  // pitch/volume secondary
  if (pitchLabel === "High" && volumeLabel === "Loud") return "alert";
  if (pitchLabel === "High" && volumeLabel !== "Loud") return "happy";
  if (pitchLabel === "Low" && volumeLabel === "Loud") return "warning";
  if (pitchLabel === "Mid" && volumeLabel === "Quiet") return "curious";
  return "curious";
}

// ─── Fallback Library (no API needed) ────────────────────────────────────────
// Each entry: [translation, trainerTip]
const FALLBACKS: Record<string, [string, string][]> = {
  bay: [
    [
      "SNIFF SNIFF SNIFF! Oh. OH. Do you SMELL that?! My magnificent nose has picked up the most extraordinary trail — I MUST follow it immediately, this is NOT negotiable!",
      "Beagles are genetically wired to bay on a scent — redirect with a 'find it' treat game indoors to channel the instinct productively.",
    ],
    [
      "Hold ALL paws — I am currently processing approximately 300 million scent molecules and they are telling me something INCREDIBLE is this way. Follow me, human!",
      "Never punish baying; instead teach a 'quiet' cue by waiting for a 2-second pause and immediately rewarding with a high-value treat.",
    ],
    [
      "My nose has clocked something at roughly 47 rabbit-lengths away. I am a professional. Please hold my leash tightly because I have a JOB to do right now.",
      "Daily nose-work sessions (hide treats around the house) burn mental energy faster than a walk — perfect for adolescent beagles who bay excessively.",
    ],
  ],
  alert: [
    [
      "HEY! HEY! HEY! Code Red at the perimeter! There is a SITUATION happening out there and somehow I appear to be the only one who noticed. You are WELCOME for the heads-up!",
      "Teach an incompatible behaviour — ask for 'sit' the moment barking starts, then reward the sit heavily. Repeat 50× and the bark-sit chain becomes automatic.",
    ],
    [
      "ALERT ALERT ALERT! I do not know exactly what it is but I am 94% sure it is suspicious and 100% sure you need to know about it RIGHT NOW!",
      "Avoid shouting 'quiet' — your beagle thinks you're joining in. Instead, a calm hand-signal + treat the moment they stop for a breath works far better.",
    ],
    [
      "Excuse me, hi, HELLO? Did everyone else's ears stop working? Something is out there and I am SOUNDING THE ALARM. Someone give me a badge.",
      "Management tip: block visual access to the trigger (window film, baby gate) while you teach a calm 'go to your mat' alternative response.",
    ],
  ],
  startled: [
    [
      "GAH! What in the — okay. Okay. I am fine. That sound just came from NOWHERE and my entire soul briefly left my body. I'm totally fine. Don't look at me.",
      "Desensitisation: play a recording of the startling sound at low volume during meal times to build a positive association — gradually raise the volume over 2 weeks.",
    ],
    [
      "I was not scared. I was simply… very surprised. There is a difference. My brave beagle dignity remains completely intact, thank you very much.",
      "After a startle, give your beagle a moment to self-settle rather than over-reassuring — excessive comforting can inadvertently reward a fearful state.",
    ],
  ],
  warning: [
    [
      "I am delivering my Official Warning Bark™ right now. Whatever that is, it needs to step BACK from my territory. I may be 25 lbs but I am all business.",
      "Identify the trigger and create distance — pushing a beagle into confrontation during a warning growl can escalate. Consult a positive-reinforcement trainer if this is frequent.",
    ],
    [
      "Grrrr-WOOF. This is not my playful bark. This is my serious voice. I don't trust this situation and I am keeping a very close eye on things right now.",
      "Never punish a growl — it is a valuable warning signal. Instead, remove your dog from the stressor and work on controlled, positive exposure from a safe distance.",
    ],
  ],
  lonely: [
    [
      "Helloooooo? Is there a human in this dimension? I have been sitting here for an ETERNITY (it's been six minutes) and nobody has come to adore me yet. This is unacceptable.",
      "Adolescent beagles need enrichment, not just company — try a filled Kong or lick mat before you leave to occupy the first 20 minutes, the peak anxiety window.",
    ],
    [
      "I am performing my Loneliness Aria, Part 3. If someone does not appear soon I will be forced to escalate to the full symphony. I have been practising.",
      "A consistent departure routine (same cue, same treat, same calm exit) dramatically reduces separation anxiety in young beagles within 2-3 weeks of practice.",
    ],
    [
      "The boredom is real. The loneliness is profound. I have already sniffed every corner of this house. Twice. Someone please give me a job or a snack or BOTH.",
      "Beagles are working dogs — 10 minutes of obedience training per day reduces boredom barking better than any chew toy. Short sessions, high rewards.",
    ],
  ],
  happy: [
    [
      "Oh my GOODNESS you are HERE! Or food is here! Or something wonderful is definitely happening! My tail velocity is at maximum, this is physically the best moment of my life!",
      "Capture this calm happy energy — asking for a sit before giving greetings teaches your beagle that polite behaviour earns the good stuff.",
    ],
    [
      "I LOVE YOU SO MUCH! Please never go anywhere ever again. It has been so long. (Four minutes.) I missed you every single second.",
      "Reward four-paws-on-floor greetings with instant attention — ignoring jumping consistently for 2 weeks will phase out the behaviour in most beagles.",
    ],
  ],
  excited: [
    [
      "WAIT WAIT WAIT — is that a LEASH?! Are we GOING OUTSIDE?! Or — oh — is that FOOD?! My brain cannot process this level of excitement, everything is wonderful!",
      "Practice 'calm before the walk' — clip the leash only when all four paws are on the floor. A beagle that learns patience at the door walks far more politely.",
    ],
    [
      "Ooh ooh ooh ooh OOH! Something AMAZING is about to happen. I don't know what it is yet but every cell in my beagle body is absolutely CONVINCED of it!",
      "Channel pre-walk zoomies into a 2-minute 'sit-stay' session before heading out — it redirects energy and builds impulse control simultaneously.",
    ],
  ],
  curious: [
    [
      "Hmm. Now THIS is interesting. My nose is detecting 47 separate data points and I need approximately 3-7 more minutes of thorough sniffing to complete my analysis. Do not rush me.",
      "Sniff walks — letting your beagle lead and sniff freely for 15 minutes — are as mentally exhausting as a 45-minute run. Let them explore!",
    ],
    [
      "There is definitely something here and I am going to sniff every millimetre of this surface until I understand exactly what it is and where it has been. Science, basically.",
      "Encourage natural sniffing behaviour — suppressing it increases frustration barking. Give a 'sniff' or 'go explore' cue to make it a rewarded, controlled behaviour.",
    ],
  ],
};

function getLocalTranslation(vocalType: string): {
  translation: string;
  trainerTip: string;
  vocalType: string;
  confidence: number;
} {
  const pool = FALLBACKS[vocalType] || FALLBACKS.curious;
  const [translation, trainerTip] = pool[Math.floor(Math.random() * pool.length)];
  return {
    translation,
    trainerTip,
    vocalType,
    confidence: Math.floor(Math.random() * 20) + 65, // 65-85 for local
  };
}

// ─── POST Handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      pitch,
      pitchLabel,
      volume,
      volumeLabel,
      cadence,
      barkCount,
      avgDuration,
      avgPause,
      dogName = "Scooby",
    } = body;

    if (pitch === undefined || volume === undefined || !cadence) {
      return NextResponse.json(
        { error: "Missing required fields: pitch, volume, cadence" },
        { status: 400 }
      );
    }

    const vocalType = classifyVocalType(cadence, pitchLabel, volumeLabel);
    const apiKey = process.env.GEMINI_API_KEY;

    // ── Try Gemini LLM first ────────────────────────────────────────────────
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const userMessage = `Bark Analysis for ${dogName} (1-year-old Beagle):
- Average Frequency: ${pitch}Hz (${pitchLabel} pitch)
- Volume: ${volume}dB (${volumeLabel})
- Cadence pattern: ${cadence}
- Number of vocalizations detected: ${barkCount}
- Average vocalization duration: ${avgDuration}ms
- Average pause between vocalizations: ${avgPause}ms
- Preliminary classification: ${vocalType}`;

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: userMessage,
          config: {
            systemInstruction: buildSystemPrompt(dogName),
            maxOutputTokens: 300,
            temperature: 0.85,
          },
        });

        const raw = response.text?.trim();
        if (raw) {
          // Strip markdown code fences if model wraps in ```json
          const clean = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
          const parsed = JSON.parse(clean);
          if (parsed.translation) {
            return NextResponse.json({
              translation: parsed.translation,
              trainerTip: parsed.trainerTip || "",
              vocalType: parsed.vocalType || vocalType,
              confidence: parsed.confidence || 80,
              mood: parsed.vocalType || vocalType, // backward-compat
            });
          }
        }
      } catch (llmError) {
        console.warn("LLM translation failed, using local fallback:", llmError);
      }
    }

    // ── Local fallback — always works ──────────────────────────────────────
    const local = getLocalTranslation(vocalType);
    return NextResponse.json({ ...local, mood: local.vocalType });
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json({
      translation:
        "Woof! My translator had a hiccup, but I still have LOTS to say — try again!",
      trainerTip:
        "If your beagle barks when the app errors, use that as a training moment: wait for quiet, then reward.",
      vocalType: "curious",
      mood: "curious",
      confidence: 70,
    });
  }
}
