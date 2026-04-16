import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/debug-youtube")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const apiKey = process.env.YOUTUBE_API_KEY;
        const url = new URL(request.url);
        const q = url.searchParams.get("q") ?? "Frank Sinatra Three Coins In The Fountain";

        const result: Record<string, unknown> = {
          hasKey: !!apiKey,
          keyLength: apiKey?.length ?? 0,
          keyPrefix: apiKey ? apiKey.slice(0, 6) + "..." : null,
          query: q,
        };

        if (!apiKey) {
          return new Response(JSON.stringify(result, null, 2), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const yt = new URL("https://www.googleapis.com/youtube/v3/search");
          yt.searchParams.set("part", "snippet");
          yt.searchParams.set("q", q);
          yt.searchParams.set("type", "video");
          yt.searchParams.set("videoEmbeddable", "true");
          yt.searchParams.set("maxResults", "3");
          yt.searchParams.set("key", apiKey);

          const res = await fetch(yt.toString());
          const text = await res.text();
          result.status = res.status;
          result.statusText = res.statusText;
          try {
            result.body = JSON.parse(text);
          } catch {
            result.body = text;
          }
        } catch (e) {
          result.fetchError = e instanceof Error ? e.message : String(e);
        }

        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
