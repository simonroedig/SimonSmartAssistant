import type { MetadataRoute } from "next";

/** Private app: keep every page out of search engines. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
