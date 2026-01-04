"use client";
import { useEffect, useState } from "react";

export default function Activities() {
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/activities")
      .then(r => r.json())
      .then(d => setActivities(d.activities));
  }, []);

  return (
    <div style={{ flex: 1, padding: 20, background: "#f5f5f5" }}>
      <h3>Atividades</h3>
      {activities.map(a => (
        <div key={a.id}>
          <b>{a.type}</b>
          <p>{a.description}</p>
          <small>{a.status}</small>
        </div>
      ))}
    </div>
  );
}