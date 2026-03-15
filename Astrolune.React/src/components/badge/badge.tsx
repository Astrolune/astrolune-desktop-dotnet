import React from "react";
import "./badge.scss";

export interface BadgeProps {
  children: React.ReactNode;
  borderColor?: string;
  backgroundColor?: string;
  icon?: React.ReactNode;
  colorCircle?: string;
}

export function Badge({
  children,
  borderColor = "#ccc",
  backgroundColor = "rgba(0, 0, 0, 0.1)",
  icon,
  colorCircle,
}: BadgeProps) {
  return (
    <div
      className="badge"
      style={{
        borderColor: borderColor,
        backgroundColor: backgroundColor,
      }}
    >
      {colorCircle && (
        <span
          className="badge__circle"
          style={{ backgroundColor: colorCircle }}
        />
      )}
      {icon && <span className="badge__icon">{icon}</span>}
      {children}
    </div>
  );
}