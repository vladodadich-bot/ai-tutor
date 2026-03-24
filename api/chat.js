export default async function handler(req, res) {
  try {
    return res.status(200).json({
      answer: "CHAT ENDPOINT RADI"
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
