export default function PageAnalytics() {
  return <GoogleAnalytics />;
}

function GoogleAnalytics() {
  return (
    <>
      <script
        defer
        src="https://www.googletagmanager.com/gtag/js?id=G-MW5FD65Q2W"
      />
      <script>
        {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-MW5FD65Q2W');`}
      </script>
    </>
  );
}
