"use client";

import useSWR, { mutate } from "swr";
import { useRef, useState } from "react";
import Image from "next/image";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  imageUrl?: string;
  timestamp: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function Chat({ modelId, compact, threadId = "default", templateId }: { modelId?: string; compact?: boolean; threadId?: string; templateId?: string }) {
  const swrKey = `/api/messages?thread=${encodeURIComponent(threadId)}`;
  const { data, isLoading } = useSWR<{ thread: string; messages: ChatMessage[] }>(swrKey, fetcher, {
    refreshInterval: 0,
  });
  const { data: themesData } = useSWR<{ themes: { name: string; url: string }[] }>("/api/themes", fetcher, {
    refreshInterval: 0,
  });
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);

  const messages = data?.messages ?? [];
  
  // Get only the latest generated image/video
  const latestImage = messages.filter(m => m.imageUrl || m.videoUrl).slice(-1)[0];
  
  // Check if the latest image is inherited
  const isInherited = latestImage?.text === "Inherited from parent node";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() && !file) return;
    setPending(true);
    try {
      let res: Response;
      if (file) {
        const fd = new FormData();
        fd.append("message", message);
        fd.append("file", file);
        if (modelId) fd.append("model", modelId);
        if (selectedTheme) fd.append("theme", selectedTheme);
        if (templateId) fd.append("template", templateId);
        fd.append("thread", threadId);
        res = await fetch("/api/messages", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, theme: selectedTheme, model: modelId, thread: threadId, template: templateId }),
        });
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Request failed: ${res.status}`);
      }
      setMessage("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await mutate(swrKey);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full h-full flex flex-col chat-content">
      {/* Theme selector - compact */}
      <div className="mb-3 text-neutral-900">
        <div className="text-sm font-medium mb-2">Inspiration Themes</div>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
          {themesData?.themes?.map((t) => {
            const active = selectedTheme === t.name;
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => setSelectedTheme(active ? null : t.name)}
                className={`relative rounded-lg overflow-hidden border ${active ? "ring-2 ring-blue-500 border-blue-500" : "hover:border-foreground/40"}`}
                title={t.name}
              >
                <Image src={t.url} alt={t.name} width={256} height={256} className="w-full h-auto" />
                {active && <span className="absolute top-1 right-1 text-[10px] bg-black/70 text-white px-1 rounded">Selected</span>}
              </button>
            );
          })}
        </div>
        {selectedTheme && <div className="mt-2 text-xs opacity-80">Using theme: {selectedTheme}. Click again to unselect.</div>}
      </div>

      {/* Generated Image/Video Display - starts small and expands */}
      {!compact && (
        <div className="mb-3">
          {pending ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-600 transition-all duration-300">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-1"></div>
              <div className="text-sm">Generating...</div>
            </div>
          ) : latestImage ? (
            <div className="transition-all duration-500 ease-out">
              {isInherited && (
                <div className="mb-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                  📋 Inherited from parent node
                </div>
              )}
              {latestImage.imageUrl && (
                <Image 
                  src={latestImage.imageUrl} 
                  alt="Generated Logo" 
                  width={1024} 
                  height={1024} 
                  className="rounded-lg border w-full h-auto shadow-sm transition-all duration-500" 
                />
              )}
              {latestImage.videoUrl && (
                <video 
                  src={latestImage.videoUrl} 
                  controls 
                  className="rounded-lg border w-full h-auto shadow-sm transition-all duration-500"
                  preload="metadata"
                >
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-3 text-center text-gray-400 text-sm transition-all duration-300">
              Ready to generate
            </div>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-auto grid gap-2 flex-shrink-0">
        <textarea
          className="w-full rounded-lg border p-2 min-h-[50px] text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-neutral-900 placeholder:text-neutral-400"
          placeholder="Type a prompt or edit instruction…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            ref={inputRef}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full bg-neutral-800 text-white px-3 py-2 text-sm shadow hover:bg-neutral-900"
          >
            Add inspiration
          </button>
          {file && (
            <div className="text-xs opacity-80 flex items-center gap-2">
              <span className="truncate max-w-[200px]">{file.name}</span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="text-blue-600 hover:underline"
              >
                Remove
              </button>
            </div>
          )}
                     <button type="submit" disabled={pending} className="rounded-full bg-blue-600 text-white px-4 py-2 text-sm shadow hover:bg-blue-700 disabled:opacity-50">
             {pending ? "Generating…" : "Send"}
           </button>
        </div>
      </form>
    </div>
  );
}
