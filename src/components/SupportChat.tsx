import React, { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Bot, User, Loader2 } from "lucide-react";
import { useLLMChat } from "@/hooks/useLLMChat";
import { LogTicketModal } from "@/components/LogTicketModal";

export function SupportChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isTyping, sendMessage } = useLLMChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or typing status changes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end pointer-events-none">
      {/* Chat Window */}
      <div
        className={`pointer-events-auto mb-4 w-[350px] sm:w-[400px] overflow-hidden rounded-2xl border bg-background/80 shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out origin-bottom-right ${
          isOpen
            ? "scale-100 opacity-100 translate-y-0"
            : "scale-95 opacity-0 !pointer-events-none translate-y-4"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">SurplusLink Assistant</h3>
              <p className="text-xs text-muted-foreground">Always here to help</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="mr-1 rounded-md bg-background px-2.5 py-1 text-xs font-semibold text-foreground border shadow-sm hover:bg-muted transition-colors"
            >
              Report an Issue
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="flex h-[400px] flex-col gap-4 overflow-y-auto p-4 scroll-smooth">
          {messages.map((msg) => {
            const isBot = msg.role === "assistant";
            return (
              <div
                key={msg.id}
                className={`flex w-full items-end gap-2 ${isBot ? "justify-start" : "justify-end"}`}
              >
                {isBot && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                    <Bot size={14} />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                    isBot
                      ? "rounded-bl-sm border bg-card text-card-foreground"
                      : "rounded-br-sm bg-primary text-primary-foreground"
                  }`}
                >
                  {msg.content}
                </div>
                {!isBot && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <User size={14} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex w-full items-end gap-2 justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Bot size={14} />
              </div>
              <div className="flex max-w-[75%] items-center gap-1 rounded-2xl rounded-bl-sm border bg-card px-4 py-3.5 shadow-sm">
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]"></div>
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]"></div>
                <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-px w-full" />
        </div>

        {/* Input Area */}
        <div className="border-t bg-background/50 p-3">
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything..."
              disabled={isTyping}
              className="flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              {isTyping ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} className="ml-0.5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`pointer-events-auto group relative flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
          isOpen ? "rotate-90 bg-destructive hover:bg-destructive/90" : "rotate-0"
        }`}
      >
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping [animation-duration:3s]" />
        {isOpen ? (
          <X size={24} className="relative z-10" />
        ) : (
          <MessageCircle size={24} className="relative z-10" />
        )}
      </button>

      <LogTicketModal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} />
    </div>
  );
}
