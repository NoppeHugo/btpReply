import { describe, it, expect, vi, afterEach } from "vitest";
import { rateLimit, resetRateLimit, clientIp } from "./rate-limit";

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("autorise jusqu'à max tentatives puis bloque", () => {
    const key = `t1:${Math.random()}`;
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(true);
    expect(rateLimit(key, 3, 60_000)).toBe(false);
  });

  it("réautorise après expiration de la fenêtre", () => {
    vi.useFakeTimers();
    const key = `t2:${Math.random()}`;
    expect(rateLimit(key, 1, 60_000)).toBe(true);
    expect(rateLimit(key, 1, 60_000)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(rateLimit(key, 1, 60_000)).toBe(true);
  });

  it("resetRateLimit remet le compteur à zéro", () => {
    const key = `t3:${Math.random()}`;
    expect(rateLimit(key, 1, 60_000)).toBe(true);
    expect(rateLimit(key, 1, 60_000)).toBe(false);
    resetRateLimit(key);
    expect(rateLimit(key, 1, 60_000)).toBe(true);
  });

  it("les clés sont isolées entre elles", () => {
    const a = `t4a:${Math.random()}`;
    const b = `t4b:${Math.random()}`;
    expect(rateLimit(a, 1, 60_000)).toBe(true);
    expect(rateLimit(b, 1, 60_000)).toBe(true);
    expect(rateLimit(a, 1, 60_000)).toBe(false);
    expect(rateLimit(b, 1, 60_000)).toBe(false);
  });
});

describe("clientIp", () => {
  it("prend la première IP de X-Forwarded-For", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" });
    expect(clientIp(h)).toBe("1.2.3.4");
  });

  it("retourne unknown sans en-tête", () => {
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
