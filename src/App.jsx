import { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:5000";

const DEFAULT_NAME = "Invitado";
const DEFAULT_EMAIL = "inv@ejemplo.com";

export default function App() {
  const [userId, setUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [currentChatName, setCurrentChatName] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [editingTitle, setEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");

  const listRef = useRef(null);

  const suggestions = [
    "📜 ¿Cómo se distribuye una herencia sin testamento?",
    "📁 ¿Qué documentos necesito para un proceso de herencia?",
    "👨‍👩‍👧 ¿Cuáles son los derechos de los herederos forzosos?",
    "⏳ ¿Cuánto tiempo toma un proceso de sucesión?",
  ];

  // Scroll al final cuando cambian los mensajes
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  // ----- Helpers backend -----

  const selectChat = async (chatId, nombreChat) => {
    setCurrentChatId(chatId);
    setCurrentChatName(nombreChat);
    setEditingTitle(false);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}/messages`);
      const data = await res.json();
      const msgs = (data.messages || []).map((m) => ({
        sender: m.sender === "assistant" ? "bot" : "user",
        text: m.contenido,
        ts: m.fecha_envio || new Date().toISOString(),
      }));

      if (msgs.length === 0) {
        setMessages([
          {
            sender: "bot",
            text:
              "¡Hola! Soy tu asistente legal para consultas sobre herencia en Perú. ¿En qué puedo ayudarte hoy?",
            ts: new Date().toISOString(),
          },
        ]);
      } else {
        setMessages(msgs);
      }
    } catch (err) {
      console.error("Error al cargar mensajes:", err);
      setMessages([
        {
          sender: "bot",
          text: "No pude cargar los mensajes de este chat.",
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadChats = async (uid) => {
    try {
      const res = await fetch(`${API_BASE}/chats?user_id=${uid}`);
      const data = await res.json();
      const lista = data.chats || [];
      setChats(lista);

      if (lista.length > 0) {
        const first = lista[0];
        await selectChat(first.id, first.nombre_chat);
      } else {
        await createFirstUserAndChat();
      }
    } catch (err) {
      console.error("Error al cargar chats:", err);
      setMessages([
        {
          sender: "bot",
          text:
            "No pude cargar tu historial de chats, pero igual puedes hacer consultas 🙂",
          ts: new Date().toISOString(),
        },
      ]);
    }
  };

  const createFirstUserAndChat = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: null,
          nombre: DEFAULT_NAME,
          email: DEFAULT_EMAIL,
          nombre_chat: "Primer chat legal",
          contexto: "herencia",
        }),
      });
      const data = await res.json();
      const nuevoChat = data.chat;
      const backendUserId = data.user_id;

      if (backendUserId) {
        setUserId(backendUserId);
        localStorage.setItem("user_id", backendUserId);
      }

      setChats([nuevoChat]);
      await selectChat(nuevoChat.id, nuevoChat.nombre_chat);

      return { userId: backendUserId, chatId: nuevoChat.id };
    } catch (err) {
      console.error("Error al crear usuario/chat inicial:", err);
      setMessages([
        {
          sender: "bot",
          text:
            "No pude iniciar tu sesión de chat, intenta recargar la página.",
          ts: new Date().toISOString(),
        },
      ]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const createNewChat = async (nombreChat) => {
    if (!userId) {
      const created = await createFirstUserAndChat();
      if (!created) return null;
      return { chatId: created.chatId };
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          nombre: DEFAULT_NAME,
          email: DEFAULT_EMAIL,
          nombre_chat: nombreChat,
          contexto: "herencia",
        }),
      });
      const data = await res.json();
      const nuevoChat = data.chat;

      setChats((prev) => [nuevoChat, ...prev]);
      await selectChat(nuevoChat.id, nuevoChat.nombre_chat);

      return { chatId: nuevoChat.id };
    } catch (err) {
      console.error("Error al crear chat:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChat = async (chatId) => {
    if (!window.confirm("¿Seguro que quieres borrar este chat?")) return;

    try {
      await fetch(`${API_BASE}/chats/${chatId}`, {
        method: "DELETE",
      });

      setChats((prev) => prev.filter((c) => c.id !== chatId));

      if (chatId === currentChatId) {
        const restantes = chats.filter((c) => c.id !== chatId);
        if (restantes.length > 0) {
          const first = restantes[0];
          await selectChat(first.id, first.nombre_chat);
        } else {
          setCurrentChatId(null);
          setCurrentChatName("");
          setMessages([
            {
              sender: "bot",
              text:
                "¡Hola! Crea un nuevo chat para empezar a hacer tus consultas sobre herencia.",
              ts: new Date().toISOString(),
            },
          ]);
        }
      }
    } catch (err) {
      console.error("Error al borrar chat:", err);
    }
  };

  const renameCurrentChat = async () => {
    if (!currentChatId || !tempTitle.trim()) {
      setEditingTitle(false);
      return;
    }

    const nuevoNombre = tempTitle.trim();

    try {
      const res = await fetch(`${API_BASE}/chats/${currentChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_chat: nuevoNombre }),
      });
      const data = await res.json();

      if (!res.ok) {
        console.error("Error al renombrar chat:", data);
        return;
      }

      setCurrentChatName(nuevoNombre);
      setChats((prev) =>
        prev.map((c) =>
          c.id === currentChatId ? { ...c, nombre_chat: nuevoNombre } : c
        )
      );
    } catch (err) {
      console.error("Error al renombrar chat:", err);
    } finally {
      setEditingTitle(false);
    }
  };

  const sendMessage = async (text) => {
    let chatIdToUse = currentChatId;

    if (!chatIdToUse) {
      const created = await createNewChat("Nuevo chat");
      if (!created || !created.chatId) return;
      chatIdToUse = created.chatId;
      setCurrentChatId(chatIdToUse);
    }

    const ts = new Date().toISOString();
    const userMessage = { sender: "user", text, ts };
    setMessages((m) => [...m, userMessage]);
    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/chats/${chatIdToUse}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail =
          typeof data?.detail === "string" ? `\nDetalle: ${data.detail}` : "";
        setMessages((m) => [
          ...m,
          {
            sender: "bot",
            text: `⚠️ El servidor respondió con un error.${detail}`,
            ts: new Date().toISOString(),
          },
        ]);
        return;
      }

      const botText =
        typeof data?.respuesta === "string"
          ? data.respuesta
          : "No pude responder ahora.";

      setMessages((m) => [
        ...m,
        { sender: "bot", text: botText, ts: new Date().toISOString() },
      ]);
    } catch (e) {
      console.error("[FRONT] fetch error:", e);
      setMessages((m) => [
        ...m,
        {
          sender: "bot",
          text: "⚠️ Error al conectar con el servidor.",
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // init
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem("user_id");
      if (stored) {
        setUserId(stored);
        await loadChats(stored);
      } else {
        await createFirstUserAndChat();
      }
    };
    init();
  }, []);

  // ----- Handlers UI -----

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim();
    setInput("");
    await sendMessage(txt);
  };

  const handleSuggestion = (q) => {
    if (loading) return;
    setInput("");
    sendMessage(q);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ----- JSX -----

  return (
    <div className="page">
      <div className="wrap">
        <div className="layout">
          {/* SIDEBAR */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <div>
                <h3>Mis chats</h3>
                <span className="sidebar-sub">
                  Historial de consultas sobre herencia
                </span>
              </div>
              <button
                className="new-chat-btn"
                onClick={() => createNewChat(`Chat ${chats.length + 1}`)}
                disabled={loading}
                title="Nuevo chat"
              >
                +
              </button>
            </div>
            <ul className="chat-list">
              {chats.map((c) => (
                <li
                  key={c.id}
                  className={`chat-item ${
                    c.id === currentChatId ? "active" : ""
                  }`}
                >
                  <button
                    className="chat-item-main"
                    onClick={() => selectChat(c.id, c.nombre_chat)}
                  >
                    <span className="chat-name">{c.nombre_chat}</span>
                    <span className="chat-date">
                      {c.fecha_creacion
                        ? new Date(c.fecha_creacion).toLocaleDateString()
                        : ""}
                    </span>
                  </button>
                  <button
                    className="chat-delete"
                    onClick={() => handleDeleteChat(c.id)}
                    title="Eliminar chat"
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* MAIN */}
          <main className="main">
            <header className="hero">
              <h1>Chatbot Legal Especializado</h1>
              <p>
                Obtén respuestas inmediatas sobre herencia, sucesiones y derecho
                civil en Perú.
              </p>
            </header>

            <section className="card">
              <div className="card-header">
                <div className="card-title">
                  <div className="icon-badge">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M10 4h4a2 2 0 0 1 2 2v1h3a1 1 0 0 1 1 1v4.5a5.5 5.5 0 1 1-2 0V9h-2v1a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V9H4v10h7.126a5.5 5.5 0 0 0 1.748 2H4a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h3V6a2 2 0 0 1 2-2Zm0 2v1h4V6h-4Zm9 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
                    </svg>
                  </div>
                  <div className="card-title-text">
                    <div className="card-title-row">
                      <div className="card-title-main">
                        {editingTitle ? (
                          <input
                            autoFocus
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={renameCurrentChat}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                renameCurrentChat();
                              }
                              if (e.key === "Escape") {
                                setEditingTitle(false);
                              }
                            }}
                            className="title-input"
                          />
                        ) : (
                          <h2
                            className="card-h2"
                            onDoubleClick={() => {
                              setTempTitle(
                                currentChatName || "Nuevo chat legal"
                              );
                              setEditingTitle(true);
                            }}
                          >
                            {currentChatName ||
                              "Chatbot Legal - Herencia en Perú"}
                          </h2>
                        )}
                        {!editingTitle && currentChatId && (
                          <button
                            type="button"
                            className="edit-title-btn"
                            onClick={() => {
                              setTempTitle(
                                currentChatName || "Nuevo chat legal"
                              );
                              setEditingTitle(true);
                            }}
                            title="Editar nombre del chat"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                      <span className="card-sub">
                        Consulta tus dudas sobre herencia y derecho sucesorio.
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chips */}
              <div className="chips">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="chip"
                    onClick={() => handleSuggestion(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Conversación */}
              <div className="chat-window" ref={listRef}>
                {messages.map((m, i) => (
                  <Message key={i} sender={m.sender} text={m.text} ts={m.ts} />
                ))}
                {loading && <TypingBubble />}
              </div>

              {/* Input */}
              <div className="composer">
                <textarea
                  placeholder="Escribe tu consulta sobre herencia..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={loading}
                  rows={1}
                />
                <button
                  className="send"
                  onClick={handleSend}
                  disabled={loading || !input.trim()}
                >
                  <span>Enviar</span>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                    />
                  </svg>
                </button>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function Message({ sender, text, ts }) {
  const isUser = sender === "user";
  return (
    <div className={`msg-row ${isUser ? "right" : "left"}`}>
      {!isUser && <div className="avatar">⚖️</div>}
      <div className={`bubble ${isUser ? "user" : "bot"}`}>
        <div className="bubble-text">{text}</div>
        <div className="bubble-time">
          {new Date(ts).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      {isUser && <div className="avatar you">🧑</div>}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="msg-row left">
      <div className="avatar">⚖️</div>
      <div className="bubble bot typing">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
    </div>
  );
}