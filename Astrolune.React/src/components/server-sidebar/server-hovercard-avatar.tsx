import "./server-hovercard-avatar.scss";

export interface AvatarProps
  extends Omit<
    React.DetailedHTMLProps<
      React.ImgHTMLAttributes<HTMLImageElement>,
      HTMLImageElement
    >,
    "src"
  > {
  size: number;
  src?: string | null;
  alt: string;
}

export function AvatarHoverCard({ size, alt, src, ...props }: AvatarProps) {
  const getInitials = (text: string): string => {
    return text
      .split(' ')
      .map(word => word.charAt(0))
      .join('');
  };

  return (
    <div className="profile-avatar" style={{ width: size, height: size }}>
      {src ? (
        <img className="profile-avatar__image" alt={alt} src={src} {...props} />
      ) : (
        <span
          style={{
            fontWeight: "bolder"
          }}
        >
          {getInitials(alt)}
        </span>
      )}
    </div>
  );
}