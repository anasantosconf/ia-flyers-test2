export default function MetricsPanel({ metrics }) {
  return (
    <div>
      <h4>Métricas</h4>
      <ul>
        {metrics?.map((m, i) => (
          <li key={i}>{m.name}: {m.value}</li>
        ))}
      </ul>
    </div>
  );
}