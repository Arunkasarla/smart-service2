import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';

const initialMessages = [
  {
    id: 1,
    from: 'bot',
    text: 'Hi! I can help you find services like AC repair, plumbing, electrician support, or pricing guidance. Ask me anything.',
  },
];

const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    const userMessage = { id: Date.now(), from: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await response.json();
      const replyText = data.reply || data.message || 'Sorry, I could not process that request.';

      setMessages((prev) => [...prev, { id: Date.now() + 1, from: 'bot', text: replyText }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          from: 'bot',
          text: 'Unable to connect to the chat service. Please try again later.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="mb-3 w-80 max-w-[90vw] rounded-3xl border border-slate-300/70 bg-white/95 shadow-2xl shadow-slate-900/15 backdrop-blur-xl">
          <div className="flex items-center justify-between rounded-t-3xl bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              Smart Service Assistant
            </div>
            <button
              type="button"
              className="rounded-full bg-slate-700/90 p-1 transition hover:bg-slate-600"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-80 overflow-y-auto px-4 py-3 text-sm text-slate-800">
            {messages.map((message) => (
              <div key={message.id} className={`mb-3 flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 shadow-sm ${
                    message.from === 'user'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} className="rounded-b-3xl border-t border-slate-200 bg-slate-50 px-3 py-3">
            <label htmlFor="chat-input" className="sr-only">Type your message</label>
            <div className="flex items-center gap-2">
              <input
                id="chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type a question..."
                className="flex-1 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={isSending}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-900/25 transition hover:bg-slate-700"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    </div>
  );
};

export default ChatBot;
