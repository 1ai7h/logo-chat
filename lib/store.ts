export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text?: string;
  imageUrl?: string; // relative URL under /outputs
  videoUrl?: string; // relative URL under /outputs
  timestamp: number;
};

export type ThreadState = {
  messages: ChatMessage[];
  lastImage?: Buffer;
  lastImageMime?: string;
};

export type SessionState = {
  threads: Map<string, ThreadState>;
};

const store = new Map<string, SessionState>();

export function getSession(sessionId: string): SessionState {
  let s = store.get(sessionId);
  if (!s) {
    s = { threads: new Map() };
    store.set(sessionId, s);
  }
  return s;
}

export function getThread(sessionId: string, threadId = "default"): ThreadState {
  const session = getSession(sessionId);
  let t = session.threads.get(threadId);
  if (!t) {
    console.warn(`⚠️ Thread ${threadId} not found, creating empty thread`);
    t = { messages: [], lastImage: undefined, lastImageMime: undefined };
    session.threads.set(threadId, t);
  } else {
    console.log(`📋 Retrieved existing thread ${threadId}:`, {
      hasLastImage: !!t.lastImage,
      lastImageSize: t.lastImage?.length || 0,
      lastImageMime: t.lastImageMime,
      messageCount: t.messages.length
    });
  }
  return t;
}

export function setLastImage(sessionId: string, threadId: string, buf: Buffer, mime: string) {
  const t = getThread(sessionId, threadId);
  t.lastImage = buf;
  t.lastImageMime = mime;
  console.log(`💾 Stored image in thread ${threadId}:`, {
    imageSize: buf.length,
    mimeType: mime
  });
}

export function addMessage(sessionId: string, threadId: string, msg: ChatMessage) {
  const t = getThread(sessionId, threadId);
  t.messages.push(msg);
}

export function getMessages(sessionId: string, threadId: string): ChatMessage[] {
  const thread = getThread(sessionId, threadId);
  console.log(`📋 Getting messages for thread ${threadId}:`, {
    messageCount: thread.messages.length,
    hasLastImage: !!thread.lastImage,
    lastImageSize: thread.lastImage?.length || 0
  });
  return thread.messages;
}

export function cloneThread(sessionId: string, sourceThread = "default", newThreadId?: string): string {
  const sid = sessionId;
  const source = getThread(sid, sourceThread);
  const id = newThreadId || `t-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  
  // Debug logging to verify source thread state
  console.log(`🔍 Cloning thread ${sourceThread} to ${id}:`, {
    hasLastImage: !!source.lastImage,
    lastImageSize: source.lastImage?.length || 0,
    lastImageMime: source.lastImageMime,
    messageCount: source.messages.length
  });
  
  // Find the latest image/video message from the source thread
  const latestImageMessage = source.messages
    .filter(m => m.imageUrl || m.videoUrl)
    .slice(-1)[0];
  
  const cloned: ThreadState = {
    messages: [...source.messages],
    // Use slice() instead of Buffer.from() for more reliable copying
    lastImage: source.lastImage ? source.lastImage.slice() : undefined,
    lastImageMime: source.lastImageMime,
  };
  
  // If there's a latest image/video message, create an inherited message to display it
  if (latestImageMessage) {
    const inheritedMessage: ChatMessage = {
      id: `${Date.now()}-inherited`,
      role: "assistant" as const,
      text: "Inherited from parent node",
      imageUrl: latestImageMessage.imageUrl,
      videoUrl: latestImageMessage.videoUrl,
      timestamp: Date.now(),
    };
    cloned.messages.push(inheritedMessage);
    console.log(`🖼️ Added inherited image message to thread ${id}:`, {
      hasImage: !!inheritedMessage.imageUrl,
      hasVideo: !!inheritedMessage.videoUrl
    });
  }
  
  const session = getSession(sid);
  session.threads.set(id, cloned);
  
  // Verify the cloned thread has the image
  console.log(`✅ Cloned thread ${id} created:`, {
    hasLastImage: !!cloned.lastImage,
    lastImageSize: cloned.lastImage?.length || 0,
    lastImageMime: cloned.lastImageMime,
    messageCount: cloned.messages.length
  });
  
  return id;
}

export function createThread(sessionId: string, threadId?: string): string {
  const id = threadId || `t-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const session = getSession(sessionId);
  if (!session.threads.has(id)) session.threads.set(id, { messages: [] });
  return id;
}

export function deleteThread(sessionId: string, threadId: string): boolean {
  const session = getSession(sessionId);
  return session.threads.delete(threadId);
}
