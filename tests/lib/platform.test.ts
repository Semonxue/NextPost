import { describe, it, expect } from "vitest";
import {
  calculateContentLength,
  getContentStatus,
  getRemainingChars,
  formatFileSize,
  isImageFile,
  isVideoFile,
  DEFAULT_PLATFORM_CONFIG,
} from "@/lib/platform";

describe("platform utilities", () => {
  describe("calculateContentLength", () => {
    it("should count regular characters normally", () => {
      expect(calculateContentLength("hello")).toBe(5);
      expect(calculateContentLength("hello world")).toBe(11);
    });

    it("should count URL as 23 characters", () => {
      const shortUrl = "https://x.com";
      const longUrl = "https://x.com/very/long/path/that/is/much/longer/than/the/short/url";
      
      // URL 固定计为 23 字符
      expect(calculateContentLength(shortUrl)).toBe(23);
      expect(calculateContentLength(longUrl)).toBe(23);
    });

    it("should count mixed content correctly", () => {
      // "Check this: "(12) + url(23) + " for more info"(14) = 49
      expect(calculateContentLength("Check this: https://x.com for more info")).toBe(49);
    });

    it("should handle multiple URLs", () => {
      // url1(23) + " and "(5) + url2(23) = 51
      expect(calculateContentLength("https://x.com and https://example.com")).toBe(51);
    });

    it("should handle empty string", () => {
      expect(calculateContentLength("")).toBe(0);
    });
  });

  describe("getContentStatus", () => {
    it("should return 'normal' for content within 90% of limit", () => {
      const content = "a".repeat(250);
      expect(getContentStatus(content, 280)).toBe("normal");
    });

    it("should return 'warning' for content between 90% and 100% of limit", () => {
      const content = "a".repeat(260);
      expect(getContentStatus(content, 280)).toBe("warning");
    });

    it("should return 'error' for content exceeding limit", () => {
      const content = "a".repeat(300);
      expect(getContentStatus(content, 280)).toBe("error");
    });

    it("should return 'normal' for empty content", () => {
      expect(getContentStatus("", 280)).toBe("normal");
    });
  });

  describe("getRemainingChars", () => {
    it("should calculate remaining characters correctly", () => {
      expect(getRemainingChars("hello", 280)).toBe(275);
    });

    it("should return negative for exceeding content", () => {
      const content = "a".repeat(300);
      expect(getRemainingChars(content, 280)).toBe(-20);
    });

    it("should handle URLs correctly", () => {
      // "Check "(6) + url(23) = 29, so 280 - 29 = 251
      expect(getRemainingChars("Check https://x.com", 280)).toBe(251);
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes correctly", () => {
      expect(formatFileSize(500)).toBe("500 B");
    });

    it("should format KB correctly", () => {
      expect(formatFileSize(1024)).toBe("1.0 KB");
      expect(formatFileSize(2048)).toBe("2.0 KB");
    });

    it("should format MB correctly", () => {
      expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
      expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
    });

    it("should format large files correctly", () => {
      expect(formatFileSize(10 * 1024 * 1024)).toBe("10.0 MB");
    });
  });

  describe("isImageFile", () => {
    it("should return true for image types", () => {
      expect(isImageFile(new File([], "test.jpg", { type: "image/jpeg" }))).toBe(true);
      expect(isImageFile(new File([], "test.png", { type: "image/png" }))).toBe(true);
      expect(isImageFile(new File([], "test.gif", { type: "image/gif" }))).toBe(true);
      expect(isImageFile(new File([], "test.webp", { type: "image/webp" }))).toBe(true);
    });

    it("should return false for non-image types", () => {
      expect(isImageFile(new File([], "test.mp4", { type: "video/mp4" }))).toBe(false);
      expect(isImageFile(new File([], "test.pdf", { type: "application/pdf" }))).toBe(false);
      expect(isImageFile(new File([], "test.txt", { type: "text/plain" }))).toBe(false);
    });
  });

  describe("isVideoFile", () => {
    it("should return true for video types", () => {
      expect(isVideoFile(new File([], "test.mp4", { type: "video/mp4" }))).toBe(true);
      expect(isVideoFile(new File([], "test.webm", { type: "video/webm" }))).toBe(true);
      expect(isVideoFile(new File([], "test.ogv", { type: "video/ogg" }))).toBe(true);
    });

    it("should return false for non-video types", () => {
      expect(isVideoFile(new File([], "test.jpg", { type: "image/jpeg" }))).toBe(false);
      expect(isVideoFile(new File([], "test.pdf", { type: "application/pdf" }))).toBe(false);
      expect(isVideoFile(new File([], "test.txt", { type: "text/plain" }))).toBe(false);
    });
  });

  describe("DEFAULT_PLATFORM_CONFIG", () => {
    it("should have Twitter config with correct values", () => {
      const twitter = DEFAULT_PLATFORM_CONFIG.Twitter;
      expect(twitter.maxContentLength).toBe(280);
      expect(twitter.maxImages).toBe(4);
      expect(twitter.maxVideos).toBe(1);
      expect(twitter.allowMixedMedia).toBe(true);
    });

    it("should have configs for all major platforms", () => {
      expect(DEFAULT_PLATFORM_CONFIG.Twitter).toBeDefined();
      expect(DEFAULT_PLATFORM_CONFIG.Instagram).toBeDefined();
      expect(DEFAULT_PLATFORM_CONFIG.LinkedIn).toBeDefined();
      expect(DEFAULT_PLATFORM_CONFIG.Facebook).toBeDefined();
    });

    it("should have Instagram with higher limits", () => {
      const twitter = DEFAULT_PLATFORM_CONFIG.Twitter;
      const instagram = DEFAULT_PLATFORM_CONFIG.Instagram;
      
      expect(instagram.maxContentLength).toBeGreaterThan(twitter.maxContentLength);
      expect(instagram.maxImages).toBeGreaterThan(twitter.maxImages);
    });
  });
});