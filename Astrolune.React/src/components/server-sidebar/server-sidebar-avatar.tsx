import "./server-sidebar-avatar.scss"

export interface AvatarProps {
  size: number
  src?: string | null
  alt: string
}

export function Avatar({ size, alt, src }: AvatarProps) {
  const getInitials = (text: string): string => {
    return text
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
  }

  return (
    <div className="profile-avatar" style={{ width: size, height: size }}>
      {src ? <img alt={alt} src={src || "/placeholder.svg"} /> : <span>{getInitials(alt)}</span>}
    </div>
  )
}

export default Avatar
