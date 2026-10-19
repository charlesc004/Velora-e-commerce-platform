import { useState } from 'react';
export function ProductGallery({
  images,
  name,
}: {
  images: string[];
  name: string;
}): React.JSX.Element {
  const [active, setActive] = useState(0);
  return (
    <div className="product-gallery">
      <div className="main-product-image">
        <img
          src={images[active] || images[0]}
          alt={name}
          width="900"
          height="1200"
          fetchPriority="high"
        />
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbnails">
          {images.map((image, i) => (
            <button
              key={`${image}-${i}`}
              aria-label={`View ${name} image ${i + 1}`}
              aria-pressed={active === i}
              onClick={() => setActive(i)}
            >
              <img src={image} alt={`${name}, view ${i + 1}`} width="100" height="130" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
