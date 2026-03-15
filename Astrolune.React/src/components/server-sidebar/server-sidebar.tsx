import { Compass, HomeIcon as House, Plus, Verified } from "lucide-react"
import { Avatar } from "../avatar/avatar"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "../hovercard/hovercard"
import type { Server } from "../../types"
import { AvatarHoverCard } from "./server-hovercard-avatar"

import "./server-sidebar.scss"
import "./server-sidebar-hovercard.scss"

export interface ServerSidebarProps {
  servers: Server[]
}

export function ServerSidebar({ servers }: ServerSidebarProps) {
  return (
    <div className="sidebar">
      <div className="home-button">
        <House color="white" />
      </div>

      {servers.map((server) => (
        <HoverCard key={server.id}>
          <HoverCardTrigger>
            <div className="avatar-wrapper">
              <Avatar size={48} src={server.avatarUrl || null} alt={server.name} />
            </div>
          </HoverCardTrigger>

          <HoverCardContent
            className="hover-card-content"
            align="center"
            sideOffset={0}
            style={{ position: "relative" }}
          >
            {server?.bannerUrl && (
              <div
                style={{
                  backgroundImage: `url(${server.bannerUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "blur(1px)",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  zIndex: -1,
                  borderRadius: "6px",
                }}
              />
            )}
            <AvatarHoverCard size={44} src={server.avatarUrl || null} alt={server.name} />
            <span className="hover-card-content-text">
              {server.name}
              <Verified color="white" size={20} />
            </span>
          </HoverCardContent>
        </HoverCard>
      ))}

      <div className="compass-button">
        <Plus color="white" />
      </div>

      <div style={{ flexGrow: 1 }}></div>

      <div style={{ transform: `translateY(-55px)` }}>
        <div className="plus-button" title="Add Server">
          <Compass color="white" />
        </div>
      </div>
    </div>
  )
}

export default ServerSidebar
