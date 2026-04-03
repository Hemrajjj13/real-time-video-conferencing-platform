const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

const titleCase = (value) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const extractKeywords = (topic) =>
  topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !stopWords.has(word))
    .slice(0, 5);

export const buildMeetingAssistant = ({ topic, history = [] }) => {
  const trimmedTopic = topic.trim();
  const keywords = extractKeywords(trimmedTopic);
  const baseTitle = keywords.length
    ? `${titleCase(keywords.slice(0, 3).join(" "))} Sync`
    : "Team Sync";

  const agenda = [
    `Start with the main goal for ${trimmedTopic || "the meeting"}.`,
    keywords[0]
      ? `Review blockers related to ${keywords[0]}.`
      : "Review blockers and dependencies.",
    keywords[1]
      ? `Align on next steps for ${keywords[1]}.`
      : "Align on owners and next actions.",
  ];

  const relatedCodes = history
    .map((item) => item.meetingCode)
    .filter(Boolean)
    .slice(0, 3);

  const prompts = [
    "Ask everyone for one clear update before diving deep.",
    "Capture decisions live in chat so late joiners stay aligned.",
    relatedCodes.length
      ? `Reuse context from recent rooms: ${relatedCodes.join(", ")}.`
      : "Create a short recap message before ending the meeting.",
  ];

  return {
    title: baseTitle,
    summary:
      trimmedTopic.length > 0
        ? `Focus this room on ${trimmedTopic.toLowerCase()} and finish with a concrete owner for each action item.`
        : "Use this room for a short, structured check-in with clear next steps.",
    agenda,
    prompts,
  };
};
