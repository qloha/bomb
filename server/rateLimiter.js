class RateLimiter {
  constructor({ tokens = 20, refillIntervalMs = 10000 } = {}) {
    this.tokens = tokens; // capacity
    this.refillIntervalMs = refillIntervalMs;
    this.map = new Map(); // id -> { tokens, lastRefill }
  }

  allow(id) {
    const now = Date.now();
    let entry = this.map.get(id);
    if (!entry) {
      entry = { tokens: this.tokens - 1, lastRefill: now };
      this.map.set(id, entry);
      return true;
    }
    // refill logic
    const elapsed = now - entry.lastRefill;
    if (elapsed > this.refillIntervalMs) {
      entry.tokens = this.tokens;
      entry.lastRefill = now;
    }
    if (entry.tokens <= 0) return false;
    entry.tokens -= 1;
    return true;
  }
}

module.exports = { RateLimiter };

