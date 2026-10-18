import { useEffect, useRef, useState } from "react";

interface Props {
  client: string;
  slot: string;
  enabled: boolean;
}

export default function AdSlot({ client, slot, enabled }: Props) {
  const ad = useRef<HTMLModElement>(null);
  const [failed, setFailed] = useState(false);
  const configured =
    enabled && /^ca-pub-\d{16}$/.test(client) && /^\d+$/.test(slot);
  useEffect(() => {
    if (!configured || !ad.current || ad.current.dataset.requested) return;
    ad.current.dataset.requested = "true";
    const scriptId = "adsense-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    const request = () => {
      try {
        const host = window as Window & { adsbygoogle?: object[] };
        (host.adsbygoogle = host.adsbygoogle || []).push({});
      } catch {
        setFailed(true);
      }
    };
    const error = () => setFailed(true);
    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
      script.addEventListener("load", request, { once: true });
      script.addEventListener("error", error, { once: true });
      document.head.append(script);
    } else request();
    return () => {
      script?.removeEventListener("load", request);
      script?.removeEventListener("error", error);
    };
  }, [client, slot, configured]);

  return (
    <aside className="ad-container" aria-label="Advertisement">
      <span className="eyebrow">ADVERTISEMENT</span>
      {configured && !failed ? (
        <ins
          ref={ad}
          className="adsbygoogle"
          style={{ display: "block", width: 240, height: 250 }}
          data-ad-client={client}
          data-ad-slot={slot}
        />
      ) : (
        <div className="ad-placeholder">
          <span>↗</span>
          <p>
            A little space for
            <br />
            our future sponsors.
          </p>
          <small>
            {failed
              ? "Advertisement unavailable"
              : "AdSense · not connected yet"}
          </small>
        </div>
      )}
    </aside>
  );
}
