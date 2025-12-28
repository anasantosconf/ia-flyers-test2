interface Message {
  sender: "user" | "bot";
  text: string;
}

export default function Conversation({ messages }: { messages: Message[] }) {
  return (
    <div style={{ border: "1px solid #aaa", padding: 10, maxHeight: 300, overflowY: "auto" }}>
      {messages.map((m, i) => (
        <div key={i} style={{ margin: "5px 0" }}>
          <strong>{m.sender === "user" ? "Você" : "Assistente"}:</strong> {m.text}
        </div>
      ))}
    </div>
  );
}