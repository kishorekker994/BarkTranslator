import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

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

  if (cadenceLower.includes("howl") || cadenceLower.includes("drawn"))
    return "tracking";
  if (pitchLabel === "High" && volumeLabel === "Loud" && cadenceLower.includes("rapid"))
    return "alert";
  if (cadenceLower.includes("single") || cadenceLower.includes("sharp"))
    return "startled";
  if (pitchLabel === "Low" && cadenceLower.includes("slow"))
    return "warning";
  if (cadenceLower.includes("monotonous") || cadenceLower.includes("long pause"))
    return "lonely";
  if (cadenceLower.includes("whine") || pitchLabel === "High")
    return "happy";

  return "curious";
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback: generate a local response without LLM
      const mood = classifyMood(cadence, pitchLabel, volumeLabel);
      const fallbackResponses: Record<string, string> = {
        tracking: "I smell something incredible! My nose never lies — I am ON the trail! Follow me, human!",
        alert: "HEY! HEY! LOOK! Someone is at the door! This is NOT a drill! Pay attention to me RIGHT NOW!",
        startled: "Whoa! What was THAT?! You totally startled me. Give a pup some warning next time!",
        warning: "I do NOT like this one bit. Whatever that is, it needs to back away from my space. Now.",
        lonely: "Helloooo? Is anyone there? I am SO bored. Please come play with me... I will be your best friend!",
        happy: "OH MY GOODNESS you are HERE! I am SO happy to see you! This is the BEST day ever!",
        curious: "Hmm, that is interesting... Let me investigate with my magnificent nose!",
      };
      return NextResponse.json({
        translation: fallbackResponses[mood] || fallbackResponses.curious,
        mood,
      });
    }

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

    const translation = response.text?.trim() || "Woof! (Scooby could not translate that one)";
    const mood = classifyMood(cadence, pitchLabel, volumeLabel);

    return NextResponse.json({ translation, mood });
  } catch (error) {
    console.error("Translation API error:", error);
    return NextResponse.json(
      { error: "Failed to translate bark. Please try again." },
      { status: 500 }
    );
  }
}
