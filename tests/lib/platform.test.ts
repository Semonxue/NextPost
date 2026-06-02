import { describe, it, expect } from "vitest";
import {
  calculateContentLength,
  getContentStatus,
  getRemainingChars,
  formatFileSize,
  isImageFile,
  isVideoFile,
  isVideoMimeType,
  isImageMimeType,
  isVideoUrl,
  isImageUrl,
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

  describe("isVideoMimeType", () => {
    it("should return true for video MIME types", () => {
      expect(isVideoMimeType("video/mp4")).toBe(true);
      expect(isVideoMimeType("video/webm")).toBe(true);
      expect(isVideoMimeType("video/ogg")).toBe(true);
      expect(isVideoMimeType("video/quicktime")).toBe(true);
    });

    it("should handle case insensitivity", () => {
      expect(isVideoMimeType("Video/MP4")).toBe(true);
      expect(isVideoMimeType("VIDEO/WEBM")).toBe(true);
    });

    it("should return false for non-video MIME types", () => {
      expect(isVideoMimeType("image/jpeg")).toBe(false);
      expect(isVideoMimeType("audio/mp3")).toBe(false);
      expect(isVideoMimeType("application/pdf")).toBe(false);
      expect(isVideoMimeType("text/plain")).toBe(false);
    });
  });

  describe("isImageMimeType", () => {
    it("should return true for image MIME types", () => {
      expect(isImageMimeType("image/jpeg")).toBe(true);
      expect(isImageMimeType("image/png")).toBe(true);
      expect(isImageMimeType("image/gif")).toBe(true);
      expect(isImageMimeType("image/webp")).toBe(true);
    });

    it("should handle case insensitivity", () => {
      expect(isImageMimeType("Image/JPEG")).toBe(true);
      expect(isImageMimeType("IMAGE/PNG")).toBe(true);
    });

    it("should return false for non-image MIME types", () => {
      expect(isImageMimeType("video/mp4")).toBe(false);
      expect(isImageMimeType("audio/mp3")).toBe(false);
      expect(isImageMimeType("application/pdf")).toBe(false);
    });
  });

  describe("isVideoUrl", () => {
    it("should return true for video URLs", () => {
      expect(isVideoUrl("https://example.com/video.mp4")).toBe(true);
      expect(isVideoUrl("https://example.com/video.webm")).toBe(true);
      expect(isVideoUrl("https://example.com/video.ogg")).toBe(true);
      expect(isVideoUrl("https://example.com/video.mov")).toBe(true);
      expect(isVideoUrl("https://example.com/video.m4v")).toBe(true);
      expect(isVideoUrl("https://example.com/video.avi")).toBe(true);
      expect(isVideoUrl("https://example.com/video.mkv")).toBe(true);
    });

    it("should handle URLs with query parameters", () => {
      expect(isVideoUrl("https://example.com/video.mp4?token=abc")).toBe(true);
      expect(isVideoUrl("https://example.com/video.mp4#section")).toBe(true);
    });

    it("should return false for non-video URLs", () => {
      expect(isVideoUrl("https://example.com/image.jpg")).toBe(false);
      expect(isVideoUrl("https://example.com/file.pdf")).toBe(false);
      expect(isVideoUrl("https://example.com/audio.mp3")).toBe(false);
    });

    it("should return false for empty or null URLs", () => {
      expect(isVideoUrl("")).toBe(false);
    });
  });

  describe("isImageUrl", () => {
    it("should return true for image URLs", () => {
      expect(isImageUrl("https://example.com/image.jpg")).toBe(true);
      expect(isImageUrl("https://example.com/image.jpeg")).toBe(true);
      expect(isImageUrl("https://example.com/image.png")).toBe(true);
      expect(isImageUrl("https://example.com/image.gif")).toBe(true);
      expect(isImageUrl("https://example.com/image.webp")).toBe(true);
      expect(isImageUrl("https://example.com/image.bmp")).toBe(true);
      expect(isImageUrl("https://example.com/image.svg")).toBe(true);
    });

    it("should handle URLs with query parameters", () => {
      expect(isImageUrl("https://example.com/image.jpg?width=800")).toBe(true);
      expect(isImageUrl("https://example.com/image.png#preview")).toBe(true);
    });

    it("should return false for non-image URLs", () => {
      expect(isImageUrl("https://example.com/video.mp4")).toBe(false);
      expect(isImageUrl("https://example.com/file.pdf")).toBe(false);
      expect(isImageUrl("https://example.com/audio.mp3")).toBe(false);
    });

    it("should return false for empty URLs", () => {
      expect(isImageUrl("")).toBe(false);
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