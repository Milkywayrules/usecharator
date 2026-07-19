import Script from "next/script";

export function UmamiAnalytics() {
  const src = process.env.NEXT_PUBLIC_UMAMI_SRC;
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  if (!(src && websiteId)) {
    return null;
  }

  return (
    <Script
      data-website-id={websiteId}
      defer
      src={src}
      strategy="afterInteractive"
    />
  );
}
