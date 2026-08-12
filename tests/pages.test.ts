import { describe, expect, it } from "vitest";
import { verifyPublishedPage, type PageFetcher } from "../src/deploy/pages.js";

const page: PageFetcher = async (input) => ({
  ok: true,
  status: 200,
  url: input,
  text: async () => `<!doctype html>
    <html><head><title>EngineerProfile / Portfolio</title></head>
    <body><h1>Evidence before adjectives.</h1><a href="feed.xml">Feed</a></body></html>`,
});

describe("published page verification", () => {
  it("accepts a valid HTTPS portfolio page", async () => {
    await expect(verifyPublishedPage("https://example.com/portfolio/", page)).resolves.toEqual({
      url: "https://example.com/portfolio/",
      status: 200,
      title: "EngineerProfile / Portfolio",
    });
  });

  it("rejects non-HTTPS URLs before making a request", async () => {
    await expect(verifyPublishedPage("http://example.com/portfolio/", page)).rejects.toThrow(
      "absolute HTTPS URL"
    );
  });

  it("rejects URLs that contain credentials", async () => {
    await expect(verifyPublishedPage("https://user:secret@example.com/portfolio/", page)).rejects.toThrow(
      "without credentials"
    );
  });

  it("rejects an unsuccessful response", async () => {
    const unavailable: PageFetcher = async (input) => ({
      ok: false,
      status: 503,
      url: input,
      text: async () => "",
    });

    await expect(verifyPublishedPage("https://example.com/portfolio/", unavailable)).rejects.toThrow(
      "HTTP 503"
    );
  });

  it("rejects a page without the portfolio contract", async () => {
    const incomplete: PageFetcher = async (input) => ({
      ok: true,
      status: 200,
      url: input,
      text: async () => "<html><head><title>Other site</title></head></html>",
    });

    await expect(verifyPublishedPage("https://example.com/portfolio/", incomplete)).rejects.toThrow(
      "portfolio heading"
    );
  });
});
