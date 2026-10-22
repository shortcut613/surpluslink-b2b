import { useState, useCallback } from "react";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

export function useLLMChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-msg",
      role: "assistant",
      content: "Hi! I'm the SurplusLink Assistant. How can I help you today?",
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // 1. Append user message to state
      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      try {
        // 2. Map local messages to Gemini's expected role structure
        const historyPayload = messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        // 3. Make POST request to your Express backend
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: text.trim(),
            history: historyPayload,
          }),
        });

        if (!response.ok) {
          throw new Error(`Server responded with status ${response.status}`);
        }

        const data = await response.json();

        // 4. Append AI response from backend
        const botMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.reply || "I didn't get a response. Please try again.",
        };

        setMessages((prev) => [...prev, botMsg]);
      } catch (error) {
        console.error("Error sending message to LLM backend:", error);
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Sorry, I ran into an error connecting to the backend server.",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
      }
    },
    [messages],
  );

  return {
    messages,
    isTyping,
    sendMessage,
  };
}
