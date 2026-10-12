import { useEffect, useState } from "react";
import { Home } from "./Home.tsx";
import { RoomView } from "./RoomView.tsx";

const roomFromPath = () => location.pathname.match(/^\/r\/([a-z0-9]+)/)?.[1] ?? null;

export function App() {
  const [roomId, setRoomId] = useState(roomFromPath);
  useEffect(() => {
    const onPop = () => setRoomId(roomFromPath());
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, []);
  const goRoom = (id: string | null) => {
    history.pushState(null, "", id ? `/r/${id}` : "/");
    setRoomId(id);
  };
  return (
    <main className="app">
      <header className="top" onClick={() => goRoom(null)}>⚽ Futbol Düellosu</header>
      {roomId ? <RoomView roomId={roomId} onLeave={() => goRoom(null)} /> : <Home onRoom={goRoom} />}
    </main>
  );
}
