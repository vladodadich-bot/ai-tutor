import OpenAI from "openai";
import { agents } from "../lib/agents.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message, agentId } = req.body || {};

    if (!agentId) {
      return res.status(400).json({ error: "Missing agentId" });
    }

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    const agent = agents[agentId];

    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: agent.systemPrompt
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const answer = response.output_text || "Nema odgovora.";

    return res.status(200).json({ answer });
  } catch (error) {
    return res.status(500).json({
      error: "Greška na serveru"
    });
  }
}
