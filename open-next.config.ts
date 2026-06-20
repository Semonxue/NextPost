/**
 * OpenNext Cloudflare Configuration
 * See: https://opennext.js.org/cloudflare
 */
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // R2 incremental cache: enables Next.js ISR/caching via Cloudflare R2
  // Requires a separate R2 bucket (not the same as MEDIA bucket)
  // incrementalCache: r2IncrementalCache,
});
