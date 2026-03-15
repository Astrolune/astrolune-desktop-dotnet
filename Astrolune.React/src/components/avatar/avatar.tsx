import { PersonIcon } from "@primer/octicons-react";
import "./avatar.scss";
import { ReactElement } from "react";

export interface AvatarProps
  extends Omit<
    React.DetailedHTMLProps<
      React.ImgHTMLAttributes<HTMLImageElement>,
      HTMLImageElement
    >,
    "src"
  > {
  size: number;
  src?: string | ReactElement | null;
}

export function Avatar({ size, alt, src, ...props }: AvatarProps) {
  return (
    <div className="profile-avatar" style={{ width: size, height: size }}>
      {!src ? (
        <PersonIcon size={size * 0.7} />
      ) : typeof src === "string" ? (
        <img 
          className="profile-avatar__image" 
          alt={alt} 
          src={src} 
          {...props} 
        />
      ) : (
        src
      )}
    </div>
  );
}