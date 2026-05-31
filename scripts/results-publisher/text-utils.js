const UI_NOISE =
  /^(day|week|month|custom|tag|woche|monat|historie|history|quotes|trade|settings|preise|handel|einstellungen)$/i;

const FRAGMENT_START =
  /^(the|money|bot makes|makes me|me every|every week|only this|for the|you for|a real|week \d)/i;

const isTradeLine = (line) => {
  const value = String(line || "").trim();
  if (!value) return true;
  if (/^(xauusd|gold|eurusd|gbpusd|nas100|us30)/i.test(value) && /(buy|sell|kauf|verkauf)/i.test(value)) {
    return true;
  }
  if (/\d{4}[.\-]\d{2}[.\-]\d{2}/.test(value) && /(buy|sell|kauf|verkauf)/i.test(value)) {
    return true;
  }
  if (/^(profit|gewinn|balance|kontostand|deposit|einzahlung|swap|commission|credit|withdrawal)/i.test(value)) {
    return true;
  }
  return false;
};

const isUiNoise = (line) => {
  const value = String(line || "").trim();
  if (!value) return true;
  if (UI_NOISE.test(value)) return true;
  if (/^[\[\(]?(day|week|month|custom|tag|woche|monat)[\]\)]?(\s*[\[\(]?(day|week|month|custom)[\]\)]?)*$/i.test(value)) {
    return true;
  }
  if (/(day|tag).*(week|woche).*(month|monat)/i.test(value) && value.length < 40) return true;
  if (/^(day|tag)\s+(week|woche)\s+(month|monat)/i.test(value)) return true;
  return false;
};

const INCOMPLETE_END =
  /\b(every|the|for|and|to|you|me|makes|bot|money|with|this|that|thankful|thank|im|i'm|a|an|in|on|for the|makes me)$/i;

const isIncompleteEnding = (line) => INCOMPLETE_END.test(String(line || "").trim());

const isSentenceFragment = (line) => {
  const value = String(line || "").trim();
  if (!value) return true;
  if (FRAGMENT_START.test(value)) return true;
  if (isIncompleteEnding(value)) return true;
  const words = value.split(/\s+/).length;
  if (words < 7) return true;
  if (!/^(bro|i |i'm|thank|testing|wow|damn|mate|yo |hey)/i.test(value) && words < 12) return true;
  return false;
};

const scoreQuoteLine = (line) => {
  const value = String(line || "").trim();
  if (!value || value.length < 12) return -1;
  if (isTradeLine(value) || isUiNoise(value) || isSentenceFragment(value)) return -1;
  if (/^[\d\s.,+-]+$/.test(value)) return -1;

  let score = 0;
  const words = value.split(/\s+/).length;
  if (words >= 8) score += 4;
  if (words >= 12) score += 2;
  if (/^(bro|thank|testing|i'm|i am)/i.test(value)) score += 4;
  if (/thank|grateful|bot|money|week|love|real one|mental|🙏|❤️|💪/i.test(value)) score += 5;
  if (/zonex|ai bot|makes me|only this week|every week/i.test(value)) score += 4;
  if (/xauusd|buy|sell|0\.\d{2}\s+\d{4}/i.test(value)) score -= 10;
  if (/(day|week|month|custom)/i.test(value) && words <= 6) score -= 10;
  return score;
};

const extractTestimonialPatterns = (text) => {
  const blob = String(text || "").replace(/\s+/g, " ");
  const patterns = [
    /bro[\s\S]{0,280}?(?:every week|this week|only this week)[\s\S]{0,80}?(?:🙏|!|\.|\?)/gi,
    /bro[\s\S]{0,280}?(?:every week|this week|only this week)/gi,
    /(?:thankful|thank you|thanks)[\s\S]{0,200}?(?:week|bot|🙏)/gi,
    /testing more and more[\s\S]{0,80}?(?:💪|!|\.)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of blob.matchAll(pattern)) {
      const candidate = match[0].replace(/\s+/g, " ").trim();
      if (scoreQuoteLine(candidate) >= 6 && !isIncompleteEnding(candidate)) {
        return candidate;
      }
    }
  }
  return null;
};

const extendQuoteFromBlob = (text, partial) => {
  if (!partial || !text) return null;
  const needle = partial.slice(0, Math.min(24, partial.length)).toLowerCase();
  const idx = text.toLowerCase().indexOf(needle);
  if (idx === -1) return null;
  const slice = text.slice(idx, idx + 350).replace(/\s+/g, " ");
  const match = slice.match(
    /bro[\s\S]{0,280}?(?:every week|this week|only this week)[\s\S]{0,80}?(?:🙏|!|\.|\?|$)/i
  );
  const candidate = match?.[0]?.trim();
  if (candidate && scoreQuoteLine(candidate) >= 6 && !isIncompleteEnding(candidate)) {
    return candidate;
  }
  return null;
};

const mergeChatLines = (lines) => {
  const merged = [];
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i];
    if (/^(bro|i |i'm|thank|testing|hey|yo)/i.test(line) && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (next && next.length < 100 && !isTradeLine(next) && !isUiNoise(next)) {
        line = `${line} ${next}`.trim();
        i += 1;
      }
    }
    merged.push(line);
  }
  return merged;
};

const pickBestQuote = (text) => {
  const fromPattern = extractTestimonialPatterns(text);
  if (fromPattern) return fromPattern;

  const lines = mergeChatLines(
    String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

  let best = null;
  let bestScore = -1;
  for (const line of lines) {
    let candidate = line;
    if (isIncompleteEnding(line)) {
      candidate = extendQuoteFromBlob(text, line) || null;
    }
    if (!candidate) continue;
    const score = scoreQuoteLine(candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return bestScore >= 6 ? best : null;
};

const cleanQuote = (line) => {
  const value = String(line || "").trim();
  if (!value || value.length < 12) return null;
  if (isTradeLine(value) || isUiNoise(value) || isSentenceFragment(value)) return null;
  if (isIncompleteEnding(value)) return null;
  if (scoreQuoteLine(value) < 6) return null;
  return value.slice(0, 200);
};

const inferPeriodLabel = (text, quote) => {
  const combined = `${text || ""} ${quote || ""}`;
  if (/this week|only this week|every week/i.test(combined)) return "This week";
  if (/last two weeks|two weeks|2 weeks/i.test(combined)) return "Last 2 weeks";
  if (/(^|\s)(day|tag)($|\s)/i.test(text) && /(history|historie)/i.test(text)) return "Today";
  if (/(week|woche)/i.test(text) && /(history|historie)/i.test(text)) return "This week";
  if (/(month|monat)/i.test(text) && /(history|historie)/i.test(text)) return "This month";
  return "Account history";
};

module.exports = {
  isTradeLine,
  isUiNoise,
  isSentenceFragment,
  isIncompleteEnding,
  scoreQuoteLine,
  pickBestQuote,
  cleanQuote,
  inferPeriodLabel,
};
