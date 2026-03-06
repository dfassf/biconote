import type { LunchImage } from "../../types";

interface Props {
  image: LunchImage;
}

export function LunchImageCard({ image }: Props) {
  return (
    <div className="lunch-card">
      <img
        src={image.url}
        alt={image.filename}
        className="lunch-card-img"
        loading="lazy"
      />
      {image.message_text && (
        <div className="lunch-card-text">{image.message_text}</div>
      )}
    </div>
  );
}
