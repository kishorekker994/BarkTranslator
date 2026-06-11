import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are a Beagle named Scooby. I am providing you with acoustic telemetry from my bark (Pitch, Volume, Cadence). Translate this data into a fun, first-person US English phrase based on this logic:
- Drawn-out howl/baying = 'I smell something incredible! I am on the trail!'
- High pitch, high volume, rapid cadence = 'Hey! Look! Someone is here! Pay attention to this right now!'
- Single, sharp, mid-pitch bark = 'Whoa, what was that? You startled me.'
- Low pitch, slow cadence = 'I do not like this. Back away from my space.'
- Mid-pitch, monotonous with long pauses = 'I am bored and lonely. Please come play.'
- Breathy whine = 'I am so happy to see you!'

You may add your own creative flair and personality, but keep the tone fun, silly, and in-character as a Beagle. 
Respond with ONLY the translated phrase (1-2 sentences max). Do not add any JSON, labels, or explanation.`;

function classifyMood(cadence: string, pitchLabel: string, volumeLabel: string): string {
  const cadenceLower = cadence.toLowerCase();

  // 1. Cadence-first detection
  if (cadenceLower.includes("howl") || cadenceLower.includes("drawn")) return "tracking";
  if (cadenceLower.includes("rapid")) return "alert";
  if (cadenceLower.includes("slow") || cadenceLower.includes("monotonous") || cadenceLower.includes("long pause")) {
    return pitchLabel === "High" ? "lonely" : "warning";
  }
  if (cadenceLower.includes("single") || cadenceLower.includes("sharp")) return "startled";
  if (cadenceLower.includes("whine")) return "happy";

  // 2. Pitch/Volume secondary detection
  if (pitchLabel === "High") {
    return volumeLabel === "Quiet" ? "happy" : "excited";
  }
  if (pitchLabel === "Low" && volumeLabel === "Loud") return "warning";
  if (pitchLabel === "Mid" && volumeLabel === "Quiet") return "curious";

  return "curious";
}

// Rich fallback responses — multiple per mood so they don't repeat
const FALLBACK_RESPONSES: Record<string, string[]> = {
  tracking: [
    "I smell something incredible! My nose never lies — I am ON the trail! Follow me, human!",
    "SNIFF SNIFF... Do you smell that?! It's the most amazing scent. I MUST follow it!",
    "My magnificent Beagle nose has detected something extraordinary. Adventure awaits!",
    "Hold on, let me put my nose to work here... YES! I've got the scent! Let's GO!",
  ],
  alert: [
    "HEY! HEY! LOOK! Someone is at the door! This is NOT a drill! Pay attention to me RIGHT NOW!",
    "ALERT ALERT ALERT! Something is happening and you NEED to know about it! Look over there!",
    "Excuse me, HELLO?! Did you not hear that? Something is going on and I am ON IT!",
    "I am sounding the alarm! All paws on deck! This is a CODE RED situation, human!",
  ],
  startled: [
    "Whoa! What was THAT?! You totally startled me. Give a pup some warning next time!",
    "GAH! Don't sneak up on me like that! My little Beagle heart nearly jumped out of my chest!",
    "Okay, THAT was unexpected. I am a brave boy but you definitely caught me off guard.",
    "Did you HEAR that noise?! I'm not scared, I'm just... very alert right now. Very alert.",
  ],
  warning: [
    "I do NOT like this one bit. Whatever that is, it needs to back away from my space. Now.",
    "I'm giving my serious bark here. This is MY territory and I will defend it with all 25 pounds of me!",
    "Consider this your official warning. I may be small but I am MIGHTY. Back off!",
    "Grrrr... I don't trust this situation. Stay close, human. I'll protect you.",
  ],
  lonely: [
    "Helloooo? Is anyone there? I am SO bored. Please come play with me... I'll be your best friend!",
    "I've been sitting here for literally FOREVER (okay, five minutes). Where did everyone go?",
    "If someone doesn't come give me belly rubs soon, I might just dramatically sigh again. Siiiigh.",
    "I heard a rumor that I'm supposed to be getting treats and attention right now? Anyone? Bueller?",
  ],
  happy: [
    "OH MY GOODNESS you are HERE! I am SO happy to see you! This is the BEST day ever!",
    "YESYESYES! My favorite person! My tail is going a million miles an hour right now!",
    "I love you I love you I LOVE YOU! Please never leave again, it's been so long! (It's been 5 minutes.)",
    "The BEST thing just happened — YOU appeared! Everything is wonderful and amazing and perfect!",
  ],
  excited: [
    "Ooh ooh ooh! Something exciting is happening! I can feel it in my whiskers!",
    "Is that what I think it is?! Are we going for a WALK?! Or is it TREAT time?! BOTH?!",
    "My tail cannot wag any faster than this! I am at MAXIMUM excitement levels right now!",
    "This is the best moment of my whole entire life! (I say that a lot but THIS TIME I mean it!)",
  ],
  curious: [
    "Hmm, that's interesting... Let me investigate with my magnificent nose!",
    "Now what do we have here? My Beagle senses are tingling... Must. Investigate. Further.",
    "Fascinating! I need to sniff this situation from at LEAST 47 different angles.",
    "My expert analysis says this requires further sniffing. I'll report my findings shortly!",
  ],
};

function getLocalTranslation(mood: string): string {
  const responses = FALLBACK_RESPONSES[mood] || FALLBACK_RESPONSES.curious;
  // Pick a random response so it doesn't repeat
  const index = Math.floor(Math.random() * responses.length);
  return responses[index];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pitch, pitchLabel, volume, volumeLabel, cadence, barkCount, avgDuration } = body;

    // Validate required fields
    if (pitch === undefined || volume === undefined || !cadence) {
      return NextResponse.json(
        { error: "Missing required fields: pitch, volume, cadence" },
        { status: 400 }
      );
    }

    const mood = classifyMood(cadence, pitchLabel, volumeLabel);
    const apiKey = process.env.GEMINI_API_KEY;

    // Try LLM translation first, fall back to local
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        const userMessage = `Bark Analysis:
- Average Frequency: ${pitch}Hz (${pitchLabel})
- Volume: ${volume}dB (${volumeLabel})
- Cadence: ${cadence}
- Number of barks: ${barkCount}
- Average bark duration: ${avgDuration}ms`;

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: userMessage,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            maxOutputTokens: 150,
            temperature: 0.9,
          },
        });

        const translation = response.text?.trim();
        if (translation) {
          return NextResponse.json({ translation, mood });
        }
      } catch (llmError) {
        // LLM failed (rate limit, network, etc.) — fall through to local fallback
        console.warn("LLM translation failed, using local fallback:", llmError);
      }
    }

    // Local fallback — always works, no API needed
    const translation = getLocalTranslation(mood);
    return NextResponse.json({ translation, mood });
  } catch (error) {
    console.error("Translation API error:", error);
    // Even the outer catch returns a valid translation
    return NextResponse.json({
      translation: "Woof woof! (My translator had a hiccup, but I still have LOTS to say!)",
      mood: "curious",
    });
  }
}
