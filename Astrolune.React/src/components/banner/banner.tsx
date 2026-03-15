import { ShareIcon, AlertIcon, StopIcon } from "@primer/octicons-react";
import "./banner.scss";
import { Link } from "../link/link";

type BannerType = "success" | "danger" | "warning";

interface BannerProps {
  type?: BannerType;
  message: string;
  link?: string;
}

export function Banner({ type = "success", message, link = "#" }: BannerProps) {
  const icon = {
    success: <ShareIcon className="banner__icon" size={16} />,
    danger: <StopIcon className="banner__icon" size={16} />,
    warning: <AlertIcon className="banner__icon" size={16} />,
  }[type];

  return (
    <header className={`banner banner--${type}`}>
      {icon}
      <Link className="banner__message" to={link}>
        {message}
      </Link>
    </header>
  );
}
