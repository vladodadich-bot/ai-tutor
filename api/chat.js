import { agents } from "../lib/agents.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

  return res.status(200).json({
    answer: `Agent ${agent.agentName} je primio: ${message}`
  });
}
