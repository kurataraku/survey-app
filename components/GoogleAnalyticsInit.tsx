import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * GA4 gtag を初回 HTML に含めて読み込む（next/script）。
 * Network タブで googletagmanager.com へのリクエストが確認しやすい。
 * page_view の手動送信・/admin 除外は GoogleAnalytics クライアント側で実施。
 */
export function GoogleAnalyticsInit() {
  if (!GA_ID) return null;

  const config = JSON.stringify({ send_page_view: false });
  const inline = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID.replace(/'/g, "\\'")}',${config});`;

  return (
    <>
      <Script
        id="ga-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: inline }}
      />
      <Script
        id="ga-js"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
      />
    </>
  );
}
