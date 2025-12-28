interface FlyerPreviewProps {
  text: string;
  imageUrl?: string;
}

export default function FlyerPreview({ text, imageUrl }: FlyerPreviewProps) {
  return (
    <div style={{ border: "1px solid #ccc", padding: 10, marginTop: 20 }}>
      <h3>Prévia do Flyer:</h3>
      <pre style={{ whiteSpace: "pre-wrap" }}>{text}</pre>
      {imageUrl && <img src={imageUrl} alt="Flyer" style={{ marginTop: 10, maxWidth: "100%" }} />}
    </div>
  );
}