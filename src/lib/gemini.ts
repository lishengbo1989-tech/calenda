import { GoogleGenAI } from "@google/genai";
import { TravelModule, ItineraryItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateDayTheme(
  dayIndex: number,
  items: (ItineraryItem & { module: TravelModule })[]
): Promise<string> {
  if (items.length === 0) return "Free Day";

  const activities = items
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(item => `${item.startTime}: ${item.module.title} (${item.module.type})`)
    .join(", ");

  const prompt = `根据以下第 ${dayIndex + 1} 天的旅行活动，生成一个简短、有创意的当天主题或标题（最多 10 个字）。请使用中文回答。
  活动列表: ${activities}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || "探索未知的一天";
  } catch (error) {
    console.error("Error generating theme:", error);
    return "发现之旅";
  }
}

export async function generateTripTheme(
  allDays: { dayIndex: number; items: (ItineraryItem & { module: TravelModule })[] }[]
): Promise<string> {
  const allActivities = allDays
    .map(day => `第 ${day.dayIndex + 1} 天: ${day.items.map(i => i.module.title).join(", ")}`)
    .join("; ");

  if (!allActivities) return "新的旅程";

  const prompt = `根据这份多日旅行行程，生成一个简短、鼓舞人心的整个行程标题（最多 15 个字）。请使用中文回答。
  行程概览: ${allActivities}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });
    return response.text?.trim() || "宏伟的旅程";
  } catch (error) {
    console.error("Error generating trip theme:", error);
    return "难忘的旅行";
  }
}
