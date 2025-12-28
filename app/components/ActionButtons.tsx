export default function ActionButtons({ onGenerate }: { onGenerate: () => void }) {
  return (
    <button onClick={onGenerate} style={{ padding: 10, marginTop: 10 }}>
      Gerar Flyer
    </button>
  );
}